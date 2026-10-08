import test from 'node:test';
import assert from 'node:assert/strict';
import { gatewayFetch, type GatewayEnvironment } from '../core/cloudflare-worker.ts';
import { Sqlite, now, sample, token } from './support.ts';
function gatewayFixture() {
  const db = new Sqlite();
  const env: GatewayEnvironment = {
    DB: db,
    BACKEND_MODE: 'cloudflare',
    PUBLIC_ENABLED: 'false',
    REPORTING_ENABLED: 'true',
    PRIVATE_ACCESS_TOKEN: 'synthetic-private-guard'.repeat(3),
    STATE_EPOCH: new Date(now).toISOString(),
  };
  const call = (path: string, data: unknown, guard = true) =>
    gatewayFetch(
      new Request(`https://signal.example.workers.dev${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
          ...(guard ? { 'X-Agent-Signal-Private': env.PRIVATE_ACCESS_TOKEN! } : {}),
        },
        body: JSON.stringify(data),
      }),
      env,
      now,
    );
  return { db, env, call };
}
test('direct gateway keeps private access closed and rejects unsupported backend or invalid epoch', async () => {
  const f = gatewayFixture();
  try {
    assert.equal((await f.call('/api/v1/check', { cohort: sample }, false)).status, 503);
    assert.equal((await f.call('/api/v1/check', { cohort: sample })).status, 200);
    f.env.PUBLIC_ENABLED = 'true';
    assert.equal((await f.call('/api/v1/check', { cohort: sample }, false)).status, 200);
    f.env.BACKEND_MODE = 'sites';
    assert.equal((await f.call('/api/v1/check', { cohort: sample })).status, 503);
    f.env.BACKEND_MODE = 'cloudflare';
    f.env.STATE_EPOCH = new Date(now + 1).toISOString();
    assert.equal((await f.call('/api/v1/check', { cohort: sample })).status, 503);
  } finally {
    f.db.raw.close();
  }
});
test('direct REST and MCP share projected D1 state and a fresh epoch omits earlier observations', async () => {
  const f = gatewayFixture();
  try {
    const secret = 'synthetic-private-diagnostic';
    const response = await f.call('/api/v1/failure', {
      cohort: { ...sample, email: secret },
      sequence: 1,
      diagnostic: secret,
    });
    assert.equal(response.headers.get('X-Agent-Signal-Backend'), 'cloudflare');
    assert.equal(((await response.json()) as { outstanding: number }).outstanding, 1);
    const rpc = await f.call('/mcp', {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'check_reports', arguments: { cohort: sample } },
    });
    const body = (await rpc.json()) as { result: { structuredContent: { outstanding: number } } };
    assert.equal(body.result.structuredContent.outstanding, 1);
    assert(!JSON.stringify(f.db.raw.prepare('SELECT * FROM observations').all()).includes(secret));
    f.env.STATE_EPOCH = new Date(now - 1).toISOString();
    const reset = await f.call('/api/v1/recovery', { cohort: sample, sequence: 2 });
    assert.equal(((await reset.json()) as { recovered: number }).recovered, 0);
  } finally {
    f.db.raw.close();
  }
});
