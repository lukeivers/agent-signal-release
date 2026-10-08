import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export async function temporaryProject(check: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "signal quote's "));
  try {
    await check(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
