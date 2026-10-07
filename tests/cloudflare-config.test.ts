import test from 'node:test';
import assert from 'node:assert/strict';
import { deploymentConfig, verifyDeployment } from '../scripts/cloudflare.mjs';
const identifiers = {
  account: 'a'.repeat(32),
  database: '12345678-1234-1234-1234-123456789012',
  name: 'signal-test',
  origin: 'https://synthetic.chatgpt.site/',
};

test('deployment preserves the stable name, safety switches and epoch on retries; public reverse cutover is blocked', () => {
  const first = deploymentConfig(identifiers, undefined, 'sites');
  assert.equal(first.vars.PUBLIC_ENABLED, 'false');
  assert.equal(first.vars.REPORTING_ENABLED, 'false');
  assert.equal(first.observability.enabled, false);
  assert.deepEqual(first.triggers.crons, ['*/5 * * * *']);
  assert.equal(
    deploymentConfig(identifiers, first, 'sites').vars.STATE_EPOCH,
    first.vars.STATE_EPOCH,
  );
  first.vars.PUBLIC_ENABLED = 'true';
  first.vars.REPORTING_ENABLED = 'true';
  first.vars.STATE_EPOCH = '2026-10-07T00:00:00.000Z';
  const next = deploymentConfig(identifiers, first, 'cloudflare');
  assert.equal(next.name, first.name);
  assert.equal(next.d1_databases[0].database_id, identifiers.database);
  assert.equal(next.vars.PUBLIC_ENABLED, 'true');
  assert.equal(next.vars.REPORTING_ENABLED, 'true');
  assert.notEqual(next.vars.STATE_EPOCH, first.vars.STATE_EPOCH);
  assert.throws(() => deploymentConfig(identifiers, next, 'sites'), /Reverse cutover/);
  assert.throws(
    () => deploymentConfig({ ...identifiers, origin: 'https://attacker.example' }, first, 'sites'),
    /Sites/,
  );
});

test('live verification rejects stale or unavailable deployments without writing a report', async () => {
  const config = deploymentConfig(identifiers, undefined, 'cloudflare');
  const endpoint = 'https://signal-test.synthetic.workers.dev/';
  await assert.rejects(verifyDeployment(endpoint, config, undefined), /PRIVATE_ACCESS_TOKEN/);
  const send: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    assert.equal(new URL(request.url).pathname, '/api/v1/check');
    assert.equal(request.headers.get('X-Agent-Signal-Private'), 'synthetic-secret');
    assert.equal(request.headers.has('authorization'), false);
    return new Response(null, {
      status: 503,
      headers: {
        'X-Agent-Signal-Backend': 'cloudflare',
        'X-Agent-Signal-Epoch': config.vars.STATE_EPOCH,
      },
    });
  };
  await verifyDeployment(endpoint, config, 'synthetic-secret', send);
  let attempts = 0;
  await verifyDeployment(
    endpoint,
    config,
    'synthetic-secret',
    async (input, init) => {
      attempts++;
      return attempts === 1 ? new Response(null, { status: 503 }) : send(input, init);
    },
    2,
  );
  assert.equal(attempts, 2);
  await assert.rejects(
    verifyDeployment(
      endpoint,
      config,
      'synthetic-secret',
      async () => new Response(null, { status: 503 }),
      1,
    ),
    /verification failed/,
  );
});

test('direct deployment needs no Sites origin and removes an inherited Sites dependency', () => {
  const direct = {
    account: identifiers.account,
    database: identifiers.database,
    name: identifiers.name,
  };
  const first = deploymentConfig(direct, undefined);
  assert.equal(first.vars.BACKEND_MODE, 'cloudflare');
  assert.equal('SITES_ORIGIN' in first.vars, false);
  const legacy = deploymentConfig(identifiers, undefined, 'sites');
  const next = deploymentConfig(direct, legacy);
  assert.equal(next.vars.BACKEND_MODE, 'cloudflare');
  assert.equal('SITES_ORIGIN' in next.vars, false);
  assert.equal(next.vars.PUBLIC_ENABLED, 'false');
});
