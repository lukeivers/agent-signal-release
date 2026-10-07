import test from 'node:test';
import assert from 'node:assert/strict';
import { gatewayFetch, type GatewayEnvironment } from '../core/cloudflare-worker.ts';
import { handle } from '../core/http.ts';
import { sitesBackend } from '../core/sites-backend.ts';
import { now, sample, token, Sqlite } from './support.ts';

test('the production fetch path preserves its native receiver and never follows upstream redirects', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async function (this: typeof globalThis, _input, init) {
      assert.equal(this, globalThis);
      assert.equal(init?.redirect, 'manual');
      calls++;
      return calls === 1
        ? Response.json({ outstanding: 0, recovered: 0, otherOutstanding: null })
        : Response.redirect('https://untrusted.example/', 302);
    };
    const env = {
      BACKEND_MODE: 'sites',
      PUBLIC_ENABLED: 'true',
      REPORTING_ENABLED: 'true',
      SITES_ORIGIN: 'https://synthetic.chatgpt.site',
      SITES_ACCESS_TOKEN: 'synthetic-secret',
      STATE_EPOCH: new Date(now).toISOString(),
    };
    const response = await gatewayFetch(
      new Request('https://signal.example.workers.dev/api/v1/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort: sample }),
      }),
      env,
      now,
    );
    assert.equal(response.status, 200);
    await assert.rejects(
      sitesBackend(env.SITES_ORIGIN, env.SITES_ACCESS_TOKEN).check(sample, now),
      { message: 'unavailable' },
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});

type Answer = {
  outstanding: number;
  recovered: number;
  result: { structuredContent: { outstanding: number; recovered: number } };
};
async function answer(response: Response): Promise<Answer> {
  return (await response.json()) as Answer;
}

function gatewayFixture() {
  const sites = new Sqlite(),
    direct = new Sqlite();
  const env: GatewayEnvironment = {
    DB: direct,
    BACKEND_MODE: 'sites',
    PUBLIC_ENABLED: 'false',
    REPORTING_ENABLED: 'true',
    PRIVATE_ACCESS_TOKEN: 'private-test-access'.repeat(3),
    SITES_ACCESS_TOKEN: 'synthetic-sites-secret',
    SITES_ORIGIN: 'https://synthetic.chatgpt.site',
    STATE_EPOCH: new Date(now).toISOString(),
  };
  const forwarded: Request[] = [];
  const send: typeof fetch = async (input, init) => {
    const request = new Request(input, init) as Request;
    forwarded.push(request.clone() as Request);
    return handle(request, { DB: sites, REPORTING_ENABLED: 'true' }, now);
  };
  const call = (path: string, body: unknown, authenticated = true) =>
    gatewayFetch(
      new Request(`https://signal.example.workers.dev${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
          Cookie: 'private-account',
          'X-Forwarded-For': '192.0.2.1',
          ...(authenticated ? { 'X-Agent-Signal-Private': env.PRIVATE_ACCESS_TOKEN! } : {}),
        },
        body: JSON.stringify(body),
      }),
      env,
      now,
      send,
    );
  return { sites, direct, env, forwarded, call };
}

test('one endpoint serves REST and MCP across a fresh-window cutover without forwarding private extras', async () => {
  const f = gatewayFixture();
  try {
    assert.equal((await f.call('/api/v1/check', { cohort: sample }, false)).status, 503);
    const failed = await f.call('/api/v1/failure', {
      cohort: { ...sample, email: 'private@example.test' },
      sequence: 1,
      diagnostic: 'secret',
    });
    assert.equal((await answer(failed)).outstanding, 1);
    assert.deepEqual(await f.forwarded[0].json(), { cohort: sample, sequence: 1 });
    assert.deepEqual([...f.forwarded[0].headers.keys()].sort(), [
      'authorization',
      'content-type',
      'oai-sites-authorization',
    ]);
    const rpc = (name: string, sequence?: number) => ({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name,
        arguments: { cohort: sample, capability: token(), sequence, diagnostic: 'secret' },
      },
      privateMetadata: 'secret',
    });
    assert.equal(
      (await answer(await f.call('/mcp', rpc('check_reports')))).result.structuredContent
        .outstanding,
      1,
    );
    f.env.BACKEND_MODE = 'cloudflare';
    const checked = await f.call('/mcp', rpc('check_reports'));
    assert.equal(checked.headers.get('X-Agent-Signal-Warming'), 'true');
    assert.equal((await answer(checked)).result.structuredContent.outstanding, 0);
    const recovered = await f.call('/mcp', rpc('report_recovery', 2));
    assert.equal((await answer(recovered)).result.structuredContent.recovered, 0);
    assert.equal(
      (await answer(await f.call('/api/v1/failure', { cohort: sample, sequence: 3 }))).outstanding,
      1,
    );
    const forwardedBefore = f.forwarded.length;
    f.env.STATE_EPOCH = new Date(now - 1).toISOString();
    assert.equal((await answer(await f.call('/api/v1/check', { cohort: sample }))).outstanding, 0);
    assert.equal(f.forwarded.length, forwardedBefore);
    assert.equal(f.sites.raw.prepare('SELECT COUNT(*) AS n FROM observations').get()?.n, 1);
  } finally {
    f.sites.raw.close();
    f.direct.raw.close();
  }
});

test('upstream projection permits a window spanning two UTC budgets but rejects malformed counts and strips extras', async () => {
  const send: typeof fetch = async (_input, init) => {
    assert.equal(init?.redirect, 'manual');
    return Response.json({
      outstanding: 15000,
      recovered: 0,
      otherOutstanding: null,
      privateExtra: 'discard',
    });
  };
  const backend = sitesBackend('https://synthetic.chatgpt.site', 'synthetic-secret', send);
  assert.deepEqual(await backend.check(sample, now), {
    outstanding: 15000,
    recovered: 0,
    otherOutstanding: null,
  });
  const malformed = sitesBackend(
    'https://synthetic.chatgpt.site',
    'synthetic-secret',
    async () => new Response('private-response'),
  );
  await assert.rejects(malformed.check(sample, now), { message: 'unavailable' });
});

test('upstream failures are bounded, do not leak response data, and are never replayed or routed to the other database', async () => {
  const f = gatewayFixture();
  try {
    let calls = 0;
    const send: typeof fetch = async () => {
      calls++;
      return Response.json({ error: 'private-diagnostic' }, { status: 502 });
    };
    const request = new Request('https://signal.example.workers.dev/api/v1/failure', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token()}`,
        'X-Agent-Signal-Private': f.env.PRIVATE_ACCESS_TOKEN!,
      },
      body: JSON.stringify({ cohort: sample, sequence: 1 }),
    });
    const response = await gatewayFetch(request, f.env, now, send);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'unavailable' });
    assert.equal(calls, 1);
    assert.equal(f.direct.raw.prepare('SELECT COUNT(*) AS n FROM observations').get()?.n, 0);
    f.env.BACKEND_MODE = 'typo';
    assert.equal((await f.call('/api/v1/check', { cohort: sample })).status, 503);
    f.env.BACKEND_MODE = 'sites';
    f.env.SITES_ORIGIN = 'https://attacker.example';
    assert.equal((await f.call('/api/v1/check', { cohort: sample })).status, 503);
  } finally {
    f.sites.raw.close();
    f.direct.raw.close();
  }
});
