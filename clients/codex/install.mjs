import { lstat } from 'node:fs/promises';
import { readConfig, applyPlans } from './hook-config.mjs';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PILOT_ENDPOINT = 'https://agent-signal-701c00ab.agent-signal-701c00ab.workers.dev';
const script = fileURLToPath(new URL('./hook.mjs', import.meta.url));
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

export async function planInstall(directory, endpoint = PILOT_ENDPOINT, localTest = false) {
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
  const snapshot = await readConfig(resolve(directory));
  const { config } = snapshot;
  const hooks = config.hooks ?? {};
  const entries = hooks.PostToolUse ?? [];
  const command = `${local ? 'AGENT_SIGNAL_ALLOW_LOOPBACK=1 ' : ''}AGENT_SIGNAL_ENDPOINT=${quote(url.origin)} sh -c ${quote(`if [ -x ${quote(process.execPath)} ] && [ -r ${quote(script)} ]; then exec ${quote(process.execPath)} ${quote(script)}; fi`)}`;
  if (entries.some((entry) => entry?.hooks?.some((hook) => hook?.command === command)))
    return { ...snapshot, changed: false, command };
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
  return {
    ...snapshot,
    changed: true,
    command,
    addition: next.hooks.PostToolUse.at(-1).hooks[0],
    next,
  };
}

export async function install(project, endpoint = PILOT_ENDPOINT, localTest = false) {
  const root = resolve(project);
  if (!(await lstat(root)).isDirectory()) throw new Error('Project directory must exist');
  const plan = await planInstall(join(root, '.codex'), endpoint, localTest);
  await applyPlans([plan]);
  return { file: plan.file, changed: plan.changed, command: plan.command };
}
