import { lstat } from 'node:fs/promises';
import { readConfig, applyPlans } from './hook-config.mjs';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PILOT_ENDPOINT = 'https://agent-signal-701c00ab.agent-signal-701c00ab.workers.dev';
export function hookClient(client = 'codex') {
  if (client === 'codex')
    return {
      name: 'Codex',
      directory: '.codex',
      userFile: 'hooks.json',
      projectFile: 'hooks.json',
      files: ['hooks.json'],
      events: ['PostToolUse'],
      suffix: '/clients/codex/hook.mjs',
      script: fileURLToPath(new URL('./hook.mjs', import.meta.url)),
    };
  if (client === 'claude-code')
    return {
      name: 'Claude Code',
      directory: '.claude',
      userFile: 'settings.json',
      projectFile: 'settings.local.json',
      files: ['settings.json', 'settings.local.json'],
      events: ['PostToolUse', 'PostToolUseFailure'],
      suffix: '/clients/claude-code/hook.mjs',
      script: fileURLToPath(new URL('../claude-code/hook.mjs', import.meta.url)),
    };
  throw new Error('Unsupported hook client');
}
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

export async function planInstall(
  directory,
  endpoint = PILOT_ENDPOINT,
  localTest = false,
  client = 'codex',
  filename,
) {
  const profile = hookClient(client);
  const script = profile.script;
  filename ??= profile.userFile;
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
  const snapshot = await readConfig(resolve(directory), filename);
  const { config } = snapshot;
  const hooks = config.hooks ?? {};
  const command = `${local ? 'AGENT_SIGNAL_ALLOW_LOOPBACK=1 ' : ''}AGENT_SIGNAL_ENDPOINT=${quote(url.origin)} sh -c ${quote(`if [ -x ${quote(process.execPath)} ] && [ -r ${quote(script)} ]; then exec ${quote(process.execPath)} ${quote(script)}; fi`)}`;
  const signalHook = (hook) =>
    typeof hook?.command === 'string' &&
    /\/clients\/(?:codex|claude-code)\/hook\.mjs/.test(hook.command);
  const existing = profile.events.flatMap((event) =>
    (hooks[event] ?? []).flatMap((entry) =>
      (entry?.hooks ?? []).filter(signalHook).map((hook) => ({ event, entry, hook })),
    ),
  );
  // Claude settings layers are additive; a sibling file must not add a second observer.
  const guards = [];
  for (const sibling of profile.files.filter((file) => file !== filename)) {
    const other = await readConfig(resolve(directory), sibling);
    guards.push(other);
    if (
      profile.events.some((event) =>
        (other.config.hooks?.[event] ?? []).some((entry) => entry?.hooks?.some(signalHook)),
      )
    )
      throw new Error(
        `An Agent Signal hook already exists in ${JSON.stringify(other.file)}; review it rather than adding a duplicate`,
      );
  }
  if (existing.length) {
    if (
      existing.length === profile.events.length &&
      profile.events.every(
        (event) =>
          existing.filter(
            (item) =>
              item.event === event &&
              item.entry.matcher === 'Bash' &&
              item.hook.type === 'command' &&
              item.hook.timeout === 3 &&
              item.hook.command === command &&
              Object.keys(item.hook).every((key) => ['type', 'command', 'timeout'].includes(key)),
          ).length === 1,
      )
    )
      return { ...snapshot, changed: false, command };
    throw new Error(
      'An Agent Signal hook already exists; review it rather than adding a duplicate',
    );
  }
  const addition = { type: 'command', command, timeout: 3 };
  const additions = profile.events.map((event) => ({ event, hook: addition }));
  const next = { ...config, hooks: { ...hooks } };
  for (const event of profile.events)
    next.hooks[event] = [...(hooks[event] ?? []), { matcher: 'Bash', hooks: [addition] }];
  return {
    ...snapshot,
    guards,
    changed: true,
    command,
    addition,
    additions,
    next,
  };
}

export async function install(
  project,
  endpoint = PILOT_ENDPOINT,
  localTest = false,
  client = 'codex',
) {
  const profile = hookClient(client);
  const root = resolve(project);
  if (!(await lstat(root)).isDirectory()) throw new Error('Project directory must exist');
  const plan = await planInstall(
    join(root, profile.directory),
    endpoint,
    localTest,
    client,
    profile.projectFile,
  );
  await applyPlans([plan]);
  return { file: plan.file, changed: plan.changed, command: plan.command };
}
