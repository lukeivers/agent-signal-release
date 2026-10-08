import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const files = [];
function walk(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') walk(path);
    else if (/\.(ts|mjs)$/.test(path)) files.push(path);
  }
}
walk('core');
walk('clients');
for (const path of files) {
  const source = readFileSync(path, 'utf8');
  if (/console\.|process\.stderr/.test(source))
    throw new Error(`Raw logging is forbidden in privacy boundary: ${path}`);
  if (path.startsWith('core/') && /from ['"](?:next|node:|\.\.\/app|\.\.\/clients)/.test(source))
    throw new Error(`Nonportable core import: ${path}`);
}
const cloudflare = JSON.parse(readFileSync('wrangler.cloudflare.json', 'utf8'));
if (
  cloudflare.observability.enabled !== false ||
  cloudflare.workers_dev !== false ||
  cloudflare.preview_urls !== false ||
  cloudflare.vars.PUBLIC_ENABLED !== 'false' ||
  cloudflare.vars.REPORTING_ENABLED !== 'false' ||
  cloudflare.triggers.crons[0] !== '*/5 * * * *'
)
  throw new Error('Cloudflare template must stay closed with cleanup enabled');
console.log('Privacy logging, architecture, and closed Cloudflare configuration checks passed.');

const provenance = JSON.parse(readFileSync('tools/devkit/provenance.json', 'utf8'));
for (const [file, hash] of Object.entries(provenance.sha256)) {
  if (
    createHash('sha256')
      .update(readFileSync(join('tools/devkit', file)))
      .digest('hex') !== hash
  )
    throw new Error(`Vendored DevKit integrity mismatch: ${file}`);
}

const retiredDirectories = ['app', 'build', 'lib', 'db', '.openai'];
for (const path of retiredDirectories)
  if (existsSync(path)) throw new Error(`Retired starter directory must not be restored: ${path}`);
const dependencies = JSON.parse(readFileSync('package.json', 'utf8'));
const retiredPackages =
  /^(next|react|react-dom|react-server-dom-webpack|vinext|vite|drizzle-kit|drizzle-orm|tailwindcss|raw-body|json-rpc-2.0|@openai\/sites|@cloudflare\/vite-plugin|@vitejs\/|@tailwindcss\/)/;
for (const name of Object.keys({ ...dependencies.dependencies, ...dependencies.devDependencies }))
  if (retiredPackages.test(name))
    throw new Error(`Retired framework dependency must not be restored: ${name}`);
