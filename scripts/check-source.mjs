import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const files = [];
function walk(root) { for (const entry of readdirSync(root, { withFileTypes: true })) { const path = join(root, entry.name); if (entry.isDirectory()) walk(path); else if (/\.(ts|mjs)$/.test(path)) files.push(path); } }
walk('core'); walk('clients');
for (const path of files) {
  const source = readFileSync(path, 'utf8');
  if (/console\.|process\.stderr/.test(source)) throw new Error(`Raw logging is forbidden in privacy boundary: ${path}`);
  if (path.startsWith('core/') && /from ['"](?:next|node:|\.\.\/app|\.\.\/clients)/.test(source)) throw new Error(`Nonportable core import: ${path}`);
}
const manifest = JSON.parse(readFileSync('.openai/hosting.json', 'utf8'));
if (manifest.d1 !== 'DB' || !manifest.capabilities.includes('mcp')) throw new Error('Missing storage/MCP manifest');
if (!readFileSync('vite.config.ts', 'utf8').includes('observability: { enabled: false }')) throw new Error('Worker observability must default off');
console.log('Privacy logging, architecture, and hosting manifest checks passed.');
