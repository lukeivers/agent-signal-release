import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../core/store.ts';
import { identity, cohort, WINDOW_MS, CAPABILITY_MS } from '../core/contract.ts';
import { handle } from '../core/http.ts';
import { Sqlite, now, sample, token, reportFixture } from './support.ts';

test('same reporter retries, exact cohort isolation, recovery and ordering', async () => {
  const { db, store, a, b } = await reportFixture();
  const send = (sequence: number, state: 'failure' | 'recovery', time = now) =>
    store.report({ cohort: sample, sequence, state }, a, time);
  assert.equal((await send(1, 'failure')).outstanding, 1);
  await send(1, 'failure', now + 30_000);
  assert.equal(db.raw.prepare('SELECT observed FROM observations').get()?.observed, now);
  assert.equal(
    (await store.report({ cohort: sample, sequence: 1, state: 'failure' }, b, now))
      .otherOutstanding,
    1,
  );
  assert.equal((await store.check({ ...sample, environment: 'hosted_agent' }, now)).outstanding, 0);
  assert.equal((await send(2, 'recovery')).outstanding, 1);
  assert.equal((await send(2, 'recovery')).recovered, 1);
  await assert.rejects(send(1, 'failure'), /sequence_conflict/);
  await assert.rejects(send(2, 'failure'), /sequence_conflict/);
  assert.equal((await send(3, 'failure')).recovered, 0);
});
test('expiry differs from recovery; watermarks retained until capability expiry then deleted', async () => {
  const db = new Sqlite(),
    store = new Store(db),
    a = await identity(token(), now);
  await store.report({ cohort: sample, sequence: 1, state: 'failure' }, a, now);
  assert.deepEqual(await store.check(sample, now + WINDOW_MS), {
    outstanding: 0,
    recovered: 0,
    otherOutstanding: null,
  });
  await store.cleanup(now + WINDOW_MS);
  assert.equal(db.raw.prepare('SELECT count(*) AS n FROM observations').get()?.n, 1);
  await store.report({ cohort: sample, sequence: 1, state: 'failure' }, a, now + WINDOW_MS);
  assert.equal((await store.check(sample, now + WINDOW_MS)).outstanding, 0);
  await store.cleanup(now + CAPABILITY_MS);
  assert.equal(db.raw.prepare('SELECT count(*) AS n FROM observations').get()?.n, 0);
  await assert.rejects(identity(token(), now + CAPABILITY_MS), /invalid_capability/);
});
test('bearer ownership and atomic quota ceilings', async () => {
  const { db, store, a, b } = await reportFixture();
  await store.report({ cohort: sample, sequence: 1, state: 'failure' }, a, now);
  await store.report({ cohort: sample, sequence: 1, state: 'recovery' }, b, now);
  assert.equal((await store.check(sample, now)).outstanding, 1);
  assert.equal((await store.check(sample, now)).recovered, 0);
  for (let sequence = 2; sequence <= 12; sequence++)
    await store.report({ cohort: sample, sequence, state: 'failure' }, a, now);
  await assert.rejects(
    store.report({ cohort: sample, sequence: 13, state: 'failure' }, a, now),
    /rate_limited/,
  );
  db.raw.prepare('UPDATE budgets SET used=10000 WHERE key LIKE ?').run('global:%');
  await assert.rejects(
    store.report({ cohort: sample, sequence: 2, state: 'failure' }, b, now),
    /rate_limited/,
  );
  assert.equal((await store.check(sample, now)).outstanding, 1);
});
const req = (path: string, data: unknown, capability = token()) =>
  new Request(`https://example.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${capability}` },
    body: JSON.stringify(data),
  });
test('privacy projection, bounds, generic errors, disabled default and MCP aggregate parity', async () => {
  const db = new Sqlite(),
    env = { DB: db, REPORTING_ENABLED: 'true' },
    secret = 'alice@example.test/private-repo/token-123';
  const payload = {
    cohort: { ...sample, email: secret },
    sequence: 1,
    diagnostic: secret,
    headers: { secret },
  };
  assert.deepEqual(cohort(payload.cohort), sample);
  const reply = await handle(req('/api/v1/failure', payload), env, now);
  assert.equal(reply.status, 200);
  const serialized =
    JSON.stringify(db.raw.prepare('SELECT * FROM observations').all()) +
    JSON.stringify(db.raw.prepare('SELECT * FROM budgets').all()) +
    (await reply.text());
  assert(!serialized.includes(secret));
  assert(!serialized.includes(token()));
  assert.equal(
    (
      await handle(
        req('/api/v1/failure', { ...payload, cohort: { ...sample, service: secret } }),
        env,
        now,
      )
    ).status,
    400,
  );
  assert.equal(
    (await handle(req('/api/v1/failure', { ...payload, sequence: 2 }, token('b')), { DB: db }, now))
      .status,
    503,
  );
  assert.equal(
    (await handle(req('/api/v1/failure', { diagnostic: 'x'.repeat(9000) }), env, now)).status,
    400,
  );
  assert.equal(
    (await handle(req('/api/v1/check?secret=bad', { cohort: sample }), env, now)).status,
    400,
  );
  const rpc = await handle(
    req('/mcp', {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'check_reports', arguments: { cohort: sample, diagnostic: secret } },
    }),
    env,
    now,
  );
  const rpcBody = (await rpc.json()) as { result: { structuredContent: { outstanding: number } } };
  assert.equal(rpcBody.result.structuredContent.outstanding, 1);
  const broken = {
    prepare() {
      throw new Error(secret);
    },
  };
  assert.equal(
    await (
      await handle(
        req('/api/v1/check', { cohort: sample }),
        { DB: broken as unknown as Sqlite, REPORTING_ENABLED: 'true' },
        now,
      )
    ).text(),
    '{"error":"unavailable"}',
  );
});
test('early admission caps reads and invalid traffic before parsing', async () => {
  const env = {};
  for (let n = 0; n < 120; n++) await handle(req('/api/v1/check', {}), env, now);
  assert.equal((await handle(req('/api/v1/check', {}), env, now)).status, 429);
  assert.equal((await handle(req('/api/v1/check', {}), env, now + 60_000)).status, 503);
});

test('MCP rejects malformed mutations and origins; transport and tool errors are separate', async () => {
  const db = new Sqlite(),
    env = { DB: db, REPORTING_ENABLED: 'true' };
  const call = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'report_failure',
      arguments: { cohort: sample, sequence: 1, capability: token() },
    },
  };
  const badId = await handle(req('/mcp', { ...call, id: null }), env, now);
  assert.equal(badId.status, 400);
  const notification = { ...call } as Record<string, unknown>;
  delete notification.id;
  assert.equal((await handle(req('/mcp', notification), env, now)).status, 400);
  assert.equal(db.raw.prepare('SELECT count(*) AS n FROM observations').get()?.n, 0);
  assert.equal((await handle(new Request('https://example.test/mcp'), env, now)).status, 405);
  const foreign = req('/mcp', call);
  foreign.headers.set('Origin', 'https://malicious.test');
  assert.equal((await handle(foreign, env, now)).status, 403);
  const unsupported = req('/mcp', call);
  unsupported.headers.set('MCP-Protocol-Version', 'unsupported');
  assert.equal((await handle(unsupported, env, now)).status, 400);
  const invalid = await handle(
    req('/mcp', {
      ...call,
      params: { ...call.params, arguments: { ...call.params.arguments, sequence: 0 } },
    }),
    env,
    now,
  );
  const error = (await invalid.json()) as { result: { isError: boolean } };
  assert.equal(invalid.status, 200);
  assert.equal(error.result.isError, true);
});

test('exhausted local budget rejects REST and MCP mutations without changing stored observations', async () => {
  const { db, store, a } = await reportFixture();
  try {
    await store.report({ cohort: sample, sequence: 1, state: 'failure' }, a, now);
    db.raw.prepare('UPDATE budgets SET used=10000 WHERE key LIKE ?').run('global:%');
    const before = db.raw.prepare('SELECT * FROM observations').all();
    const env = { DB: db, REPORTING_ENABLED: 'true' };
    const rest = await handle(req('/api/v1/recovery', { cohort: sample, sequence: 2 }), env, now);
    assert.equal(rest.status, 429);
    assert.deepEqual(await rest.json(), { error: 'rate_limited' });
    const rpc = await handle(
      req('/mcp', {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'report_recovery',
          arguments: { cohort: sample, sequence: 2, capability: token() },
        },
      }),
      env,
      now,
    );
    const body = (await rpc.json()) as { result: { isError: boolean } };
    assert.equal(body.result.isError, true);
    assert.deepEqual(db.raw.prepare('SELECT * FROM observations').all(), before);
  } finally {
    db.raw.close();
  }
});
