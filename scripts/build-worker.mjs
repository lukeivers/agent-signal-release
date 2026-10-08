import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const child = spawnSync(
  process.execPath,
  [
    resolve('node_modules/wrangler/bin/wrangler.js'),
    'deploy',
    '--config',
    'wrangler.cloudflare.json',
    '--dry-run',
    '--outdir',
    '.cloudflare/bundle',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: 'false',
      WRANGLER_LOG_PATH: resolve('.cloudflare/logs'),
    },
  },
);
if (child.error || child.status !== 0) throw new Error('Local Worker build failed');
