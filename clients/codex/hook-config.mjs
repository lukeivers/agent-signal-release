import { lstat, readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export async function readConfig(directory, filename = 'hooks.json') {
  if (!['hooks.json', 'settings.json', 'settings.local.json'].includes(filename))
    throw new Error('Invalid hook configuration filename');
  const file = join(directory, filename);
  let original;
  try {
    const dir = await lstat(directory);
    if (!dir.isDirectory() || dir.isSymbolicLink())
      throw new Error('Refusing a symlinked hook directory');
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Refusing a symlinked hook file');
    original = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const config = original === undefined ? {} : JSON.parse(original);
  if (
    !config ||
    typeof config !== 'object' ||
    Array.isArray(config) ||
    (config.hooks !== undefined &&
      (!config.hooks || typeof config.hooks !== 'object' || Array.isArray(config.hooks)))
  )
    throw new Error('Invalid existing hooks configuration');
  for (const event of ['PostToolUse', 'PostToolUseFailure'])
    if (config.hooks?.[event] !== undefined && !Array.isArray(config.hooks[event]))
      throw new Error(`Invalid existing ${event} hooks`);
  let backup;
  if (original !== undefined) {
    backup = file + '.agent-signal-backup';
    try {
      await lstat(backup);
      backup += '-' + randomUUID();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return { directory, filename, file, original, config, backup };
}

async function unchanged(plan) {
  for (const snapshot of [plan, ...(plan.guards ?? [])]) {
    const current = await readConfig(snapshot.directory, snapshot.filename);
    if (current.original !== snapshot.original)
      throw new Error('Hook configuration changed; preview again');
  }
}

export async function applyPlans(plans) {
  const changes = plans.filter((plan) => plan.changed);
  // Validate every snapshot before the first edit; each file is rechecked before replacement.
  for (const plan of changes) await unchanged(plan);
  for (const plan of changes) {
    await mkdir(plan.directory, { recursive: true });
    await unchanged(plan);
    if (plan.original !== undefined)
      await writeFile(plan.backup, plan.original, { mode: 0o600, flag: 'wx' });
    const temporary = plan.file + '.' + randomUUID() + '.tmp';
    try {
      await writeFile(temporary, JSON.stringify(plan.next, null, 2) + '\n', {
        mode: 0o600,
        flag: 'wx',
      });
      await unchanged(plan);
      await rename(temporary, plan.file);
    } finally {
      await rm(temporary, { force: true });
    }
  }
}
