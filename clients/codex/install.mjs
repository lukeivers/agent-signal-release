import { readFile, writeFile, mkdir, lstat, rename, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PILOT_ENDPOINT = 'https://agent-signal-701c00ab.agent-signal-701c00ab.workers.dev';
const script = fileURLToPath(new URL('./hook.mjs', import.meta.url));
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

export async function install(project, endpoint = PILOT_ENDPOINT, localTest = false) {
  const url = new URL(endpoint);
  const local = localTest && url.protocol === 'http:' && url.hostname === '127.0.0.1';
  if (
    (!local && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('Expected a root HTTPS endpoint (loopback requires explicit local test mode)');
  try {
    createRequire(import.meta.url).resolve('proper-lockfile');
  } catch {
    throw new Error(
      'Install hook dependencies with npm ci --prefix clients/codex --ignore-scripts first',
    );
  }
  const root = resolve(project);
  if (!(await lstat(root)).isDirectory()) throw new Error('Project directory must exist');
  const directory = join(root, '.codex');
  await mkdir(directory, { recursive: true });
  if (!(await lstat(directory)).isDirectory() || (await lstat(directory)).isSymbolicLink())
    throw new Error('Refusing a symlinked hook directory');
  const file = join(directory, 'hooks.json');
  let config = {};
  let original;
  try {
    if (!(await lstat(file)).isFile() || (await lstat(file)).isSymbolicLink())
      throw new Error('Refusing a symlinked hook file');
    original = await readFile(file, 'utf8');
    config = JSON.parse(original);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (
    !config ||
    typeof config !== 'object' ||
    Array.isArray(config) ||
    (config.hooks !== undefined &&
      (!config.hooks || typeof config.hooks !== 'object' || Array.isArray(config.hooks)))
  )
    throw new Error('Invalid existing hooks configuration');
  const hooks = config.hooks ?? {};
  const entries = hooks.PostToolUse ?? [];
  if (!Array.isArray(entries)) throw new Error('Invalid existing PostToolUse hooks');
  const command = `${local ? 'AGENT_SIGNAL_ALLOW_LOOPBACK=1 ' : ''}AGENT_SIGNAL_ENDPOINT=${quote(url.origin)} sh -c ${quote(`if [ -x ${quote(process.execPath)} ] && [ -r ${quote(script)} ]; then exec ${quote(process.execPath)} ${quote(script)}; fi`)}`;
  if (entries.some((entry) => entry?.hooks?.some((hook) => hook?.command === command)))
    return { file, changed: false, command };
  if (
    entries.some((entry) =>
      entry?.hooks?.some(
        (hook) =>
          typeof hook?.command === 'string' && hook.command.includes('/clients/codex/hook.mjs'),
      ),
    )
  )
    throw new Error(
      'An Agent Signal hook already exists; review it rather than adding a duplicate',
    );
  const next = {
    ...config,
    hooks: {
      ...hooks,
      PostToolUse: [
        ...entries,
        { matcher: 'Bash', hooks: [{ type: 'command', command, timeout: 3 }] },
      ],
    },
  };
  if (original !== undefined) {
    try {
      await writeFile(`${file}.agent-signal-backup`, original, { mode: 0o600, flag: 'wx' });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      await writeFile(`${file}.agent-signal-backup-${randomUUID()}`, original, {
        mode: 0o600,
        flag: 'wx',
      });
    }
  }
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(next, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
  return { file, changed: true, command };
}
