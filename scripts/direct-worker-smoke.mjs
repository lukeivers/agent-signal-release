import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    scriptPath: new URL('.cloudflare/bundle/cloudflare-worker.js', root).pathname,
    compatibilityDate: '2026-10-07',
    d1Databases: ['DB'],
    bindings: {
      BACKEND_MODE: 'cloudflare',
      PUBLIC_ENABLED: 'true',
      REPORTING_ENABLED: 'true',
      STATE_EPOCH: '2026-10-07T00:00:00.000Z',
    },
  }),
);
try {
  const db = await mf.getD1Database('DB');
  const schema = await readFile(new URL('drizzle/0000_new_ben_urich.sql', root), 'utf8');
  for (const sql of schema.split(';').filter((x) => x.trim())) await db.prepare(sql).run();
  globalThis.fetch = (input, init) => mf.dispatchFetch(input, init);
  process.argv[2] = 'http://127.0.0.1:8799';
  await import('./local-smoke.mjs');
  const response = await mf.dispatchFetch('http://127.0.0.1:8799/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18' },
    }),
  });
  assert.equal((await response.json()).result.protocolVersion, '2025-06-18');
  const before = await db
    .prepare("SELECT used FROM budgets WHERE key LIKE 'global:%'")
    .first('used');
  const reporter = await db
    .prepare("SELECT key FROM budgets WHERE key LIKE 'reporter:%' AND used=12 LIMIT 1")
    .first('key');
  assert(reporter);
  assert.equal(before, 20);
  console.log(
    JSON.stringify({
      directCloudflareWorker: true,
      syntheticLocalD1: true,
      mcpNegotiation: true,
      reporterRejectedRequestsExcludedFromGlobalBudget: true,
    }),
  );
} finally {
  await mf.dispose();
}
