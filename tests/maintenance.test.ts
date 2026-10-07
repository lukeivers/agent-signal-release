import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleCleanup } from '../core/maintenance.ts';
import { handle } from '../core/http.ts';
import { now, sample, reportFixture } from './support.ts';

test('disabling reporting still allows scheduled physical deletion', async () => {
  const { db, store, a } = await reportFixture();
  await store.report({ cohort: sample, sequence: 1, state: 'failure' }, a, now);
  const env = { DB: db, REPORTING_ENABLED: 'false' };
  const blocked = await handle(
    new Request('https://example.test/api/v1/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cohort: sample }),
    }),
    env,
    now,
  );
  assert.equal(blocked.status, 503);
  const pending: Promise<void>[] = [];
  scheduleCleanup(env, { waitUntil: (work) => pending.push(work) }, now + 3 * 86_400_000);
  await Promise.all(pending);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS count FROM observations').get()?.count, 0);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS count FROM budgets').get()?.count, 0);
  db.raw.close();
});
