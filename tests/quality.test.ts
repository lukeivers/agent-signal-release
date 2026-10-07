import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewDependencyAudit } from '../scripts/dependency-audit.mjs';

test('dependency audit exceptions are advisory, path, version and expiry specific; unknown findings block', () => {
  const url = 'https://github.com/advisories/GHSA-synthetic';
  const report = {
    metadata: { vulnerabilities: { high: 2 } },
    vulnerabilities: {
      parent: { via: ['leaf'], nodes: ['node_modules/parent'] },
      leaf: { via: [{ name: 'leaf', url, severity: 'high' }], nodes: ['node_modules/leaf'] },
    },
  };
  const exception = {
    advisory: url,
    package: 'leaf',
    severity: 'high',
    reason: 'Synthetic tool-only fixture',
    expires: '2026-11-06',
    nodes: ['node_modules/leaf'],
    versions: ['1.0.0'],
  };
  const lock = { packages: { 'node_modules/leaf': { version: '1.0.0' } } };
  const at = Date.UTC(2026, 9, 7);
  assert.deepEqual(reviewDependencyAudit(report, [exception], lock, at).blocked, []);
  assert.deepEqual(reviewDependencyAudit(report, [], lock, at).blocked, [url]);
  assert.deepEqual(
    reviewDependencyAudit(report, [exception], lock, Date.UTC(2026, 10, 6)).blocked,
    [url],
  );
  assert.deepEqual(
    reviewDependencyAudit(report, [{ ...exception, versions: ['2.0.0'] }], lock, at).blocked,
    [url],
  );
  const raised = structuredClone(report);
  raised.vulnerabilities.leaf.via[0].severity = 'critical';
  assert.deepEqual(reviewDependencyAudit(raised, [exception], lock, at).blocked, [url]);
  const changed = structuredClone(report);
  changed.vulnerabilities.leaf.via[0].url += '-new';
  assert.equal(reviewDependencyAudit(changed, [exception], lock, at).blocked.length, 1);
  changed.vulnerabilities.leaf.nodes.push('node_modules/new/leaf');
  assert.equal(reviewDependencyAudit(changed, [exception], lock, at).blocked.length, 1);
  assert.throws(() => reviewDependencyAudit({ error: {} }, [], lock, at), /unavailable/);
});
