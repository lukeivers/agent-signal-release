import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function reviewDependencyAudit(report, exceptions, lock, now = Date.now()) {
  if (report.error || !report.metadata || !report.vulnerabilities)
    throw new Error('Dependency audit unavailable or malformed');
  const blocked = new Set();
  const accepted = new Set();
  const inspected = new Set();
  function inspect(name) {
    if (inspected.has(name)) return;
    inspected.add(name);
    const finding = report.vulnerabilities[name];
    if (!finding || !Array.isArray(finding.via) || !Array.isArray(finding.nodes))
      throw new Error('Dependency advisory graph malformed');
    for (const via of finding.via) {
      if (typeof via === 'string') {
        inspect(via);
        continue;
      }
      if (!via?.url || !via.name) throw new Error('Dependency advisory malformed');
      const exception = exceptions.find((rule) => rule.advisory === via.url && rule.package === name);
      const expires = Date.parse(exception?.expires ?? '');
      const scoped = exception && exception.reason && exception.severity === via.severity && expires > now && finding.nodes.length > 0 &&
        finding.nodes.every((path) => exception.nodes.includes(path) &&
          exception.versions.includes(lock.packages?.[path]?.version));
      if (scoped) accepted.add(via.url);
      else blocked.add(via.url);
    }
  }
  for (const name of Object.keys(report.vulnerabilities)) inspect(name);
  return { blocked: [...blocked].sort(), accepted: [...accepted].sort(), counts: report.metadata.vulnerabilities };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['audit', '--json', '--cache', resolve('.sites-runtime/audit-cache')], {
      encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024,
    });
    if (result.error || ![0, 1].includes(result.status)) throw new Error('Dependency audit request failed');
    const report = JSON.parse(result.stdout);
    const exceptions = JSON.parse(readFileSync('rules/dependency-audit-exceptions.json', 'utf8'));
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
    const reviewed = reviewDependencyAudit(report, exceptions, lock);
    console.log(JSON.stringify(reviewed, null, 2));
    if (reviewed.blocked.length) process.exitCode = 1;
  } catch {
    console.error('Dependency audit failed or unavailable; this is not a clean audit.');
    process.exitCode = 1;
  }
}
