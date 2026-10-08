import test from 'node:test';
import assert from 'node:assert/strict';
import { deploymentConfig, verifyDeployment } from '../scripts/cloudflare.mjs';
const identifiers = {
  account: 'a'.repeat(32),
  database: '12345678-1234-1234-1234-123456789012',
  name: 'signal-test',
};

test('direct deployment preserves identifiers, closed defaults and an existing count window', () => {
  const first = deploymentConfig(identifiers, undefined);
  assert.equal(first.vars.PUBLIC_ENABLED, 'false');
  assert.equal(first.vars.REPORTING_ENABLED, 'false');
  assert.equal(first.observability.enabled, false);
  assert.deepEqual(first.triggers.crons, ['*/5 * * * *']);
  first.vars.PUBLIC_ENABLED = 'true';
  first.vars.REPORTING_ENABLED = 'true';
  const next = deploymentConfig(identifiers, first);
  assert.equal(next.name, first.name);
  assert.equal(next.d1_databases[0].database_id, identifiers.database);
  assert.deepEqual(next.vars, first.vars);
  assert.throws(
    () =>
      deploymentConfig(identifiers, {
        ...first,
        vars: { ...first.vars, BACKEND_MODE: 'unsupported' },
      }),
    /Only direct/,
  );
});

test('live verification rejects stale or unavailable deployments without writing a report', async () => {
  const config = deploymentConfig(identifiers, undefined);
  const endpoint = 'https://signal-test.synthetic.workers.dev/';
  await assert.rejects(verifyDeployment(endpoint, config, undefined), /PRIVATE_ACCESS_TOKEN/);
  const send: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    assert.equal(new URL(request.url).pathname, '/api/v1/check');
    assert.equal(request.headers.get('X-Agent-Signal-Private'), 'synthetic-secret');
    assert.equal(request.headers.has('authorization'), false);
    assert.equal(request.headers.get('User-Agent'), 'AgentSignal-Operator/0.1');
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
      return attempts === 2 ? new Response(null, { status: 503 }) : send(input, init);
    },
    5,
  );
  assert.equal(attempts, 5);
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

test('generated deployment variables project away unexpected legacy metadata', () => {
  const first = deploymentConfig(identifiers, undefined);
  const next = deploymentConfig(identifiers, {
    ...first,
    vars: { ...first.vars, PRIVATE_EXTRA: 'discard' },
  });
  assert.equal('PRIVATE_EXTRA' in next.vars, false);
});
