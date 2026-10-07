import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, utimes, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { observe } from '../clients/codex/adapter.mjs';
// Crash artifacts emulate SIGKILL after mkdir and after temporary-file write;
// unlike a handled exception, neither can rely on finally to release the lock.
test('stale crash lock and abandoned temporary file do not permanently disable a session', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'signal-crash-'));
  const name = createHash('sha256').update('crash-session').digest('hex');
  const file = join(directory, `${name}.json`),
    lock = `${file}.lock`;
  await mkdir(lock);
  await writeFile(`${file}.abandoned.tmp`, 'partial', { mode: 0o600 });
  const old = new Date(Date.now() - 30_000);
  await utimes(lock, old, old);
  const event = {
    session_id: 'crash-session',
    hook_event_name: 'PostToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'git push' },
    tool_response: {
      exit_code: 1,
      output:
        "fatal: unable to access 'https://github.com/test/project/': The requested URL returned error: 503",
    },
  };
  try {
    assert.equal(
      await observe(event, { directory, endpoint: 'http://127.0.0.1:1', allowLoopback: true }),
      null,
    );
    const { readFile } = await import('node:fs/promises');
    assert.equal(JSON.parse(await readFile(file, 'utf8')).sequence, 1);
  } finally {
    await rm(directory, { recursive: true });
  }
});
