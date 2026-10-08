import { Store, type Database } from './store.ts';

export function scheduleCleanup(
  env: { DB?: Database },
  context: { waitUntil(work: Promise<void>): void },
  now = Date.now(),
) {
  // Stopping ingestion must not stop deletion of previously accepted records.
  if (env.DB) context.waitUntil(new Store(env.DB).cleanup(now).catch(() => undefined));
}
