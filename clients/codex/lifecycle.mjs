import { readdir, lstat } from 'node:fs/promises';
import { join, resolve, isAbsolute } from 'node:path';
import { readConfig } from './hook-config.mjs';
import { planInstall, hookClient } from './install.mjs';

const quoted = "'(?:[^']|'\\\\'')*'";
const outer = new RegExp(
  `^(AGENT_SIGNAL_ALLOW_LOOPBACK=1 )?AGENT_SIGNAL_ENDPOINT=(${quoted}) sh -c (${quoted})$`,
);
const legacy = new RegExp(
  `^(AGENT_SIGNAL_ALLOW_LOOPBACK=1 )?AGENT_SIGNAL_ENDPOINT=(${quoted}) (${quoted}) (${quoted})$`,
);
const inner = new RegExp(
  `^if \\[ -x (${quoted}) \\] && \\[ -r (${quoted}) \\]; then exec \\1 \\2; fi$`,
);
const unquote = (value) => value.slice(1, -1).replaceAll("'\\''", "'");

function generatedHook(hook, suffix) {
  if (
    !hook ||
    hook.type !== 'command' ||
    hook.timeout !== 3 ||
    typeof hook.command !== 'string' ||
    Object.keys(hook).some((key) => !['type', 'command', 'timeout'].includes(key))
  )
    return false;
  const match = outer.exec(hook.command) ?? legacy.exec(hook.command);
  if (!match) return false;
  const body = match.length === 5 ? [undefined, match[3], match[4]] : inner.exec(unquote(match[3]));
  if (
    !body ||
    !isAbsolute(unquote(body[1])) ||
    !isAbsolute(unquote(body[2])) ||
    !unquote(body[2]).endsWith(suffix)
  )
    return false;
  try {
    const endpoint = unquote(match[2]);
    const url = new URL(endpoint);
    return (
      endpoint === url.origin &&
      (url.protocol === 'https:' ||
        (match[1] && url.protocol === 'http:' && url.hostname === '127.0.0.1'))
    );
  } catch {
    return false;
  }
}

export async function planRemoval(directory, client = 'codex', filename) {
  const profile = hookClient(client);
  const snapshot = await readConfig(resolve(directory), filename ?? profile.userFile);
  const removals = [];
  const unrecognized = [];
  const next = { ...snapshot.config, hooks: { ...snapshot.config.hooks } };
  for (const event of profile.events) {
    if (snapshot.config.hooks?.[event] === undefined) continue;
    next.hooks[event] = snapshot.config.hooks[event].flatMap((entry, entryIndex) => {
      if (!Array.isArray(entry?.hooks)) return [entry];
      const hooks = entry.hooks.filter((hook, hookIndex) => {
        if (entry.matcher !== 'Bash' || !generatedHook(hook, profile.suffix)) {
          if (
            typeof hook?.command === 'string' &&
            /\/clients\/(?:codex|claude-code)\/hook\.mjs/.test(hook.command)
          )
            unrecognized.push({ event, entryIndex, hookIndex });
          return true;
        }
        removals.push({ event, entryIndex, hookIndex, hook });
        return false;
      });
      return hooks.length ||
        hooks.length === entry.hooks.length ||
        Object.keys(entry).some((key) => !['matcher', 'hooks'].includes(key))
        ? [{ ...entry, hooks }]
        : [];
    });
  }
  return { ...snapshot, removals, unrecognized, changed: removals.length > 0, next };
}

export async function removalPlans(directory, client = 'codex') {
  const profile = hookClient(client);
  const plans = [];
  for (const filename of profile.files) {
    const plan = await planRemoval(directory, client, filename);
    if (plan.changed || plan.unrecognized.length) plans.push(plan);
  }
  return plans;
}

export async function scanInstallations(roots, client = 'codex') {
  const profile = hookClient(client);
  const seen = new Set();
  const plans = [];
  async function visit(directory) {
    if (seen.has(directory)) return;
    if (seen.size >= 10000) throw new Error('Scan exceeds 10000 directories; use narrower roots');
    const stat = await lstat(directory);
    if (stat.isSymbolicLink()) return;
    if (!stat.isDirectory()) throw new Error('Scan root must be a directory');
    seen.add(directory);
    try {
      plans.push(...(await removalPlans(join(directory, profile.directory), client)));
    } catch (error) {
      throw new Error(
        `Cannot safely inspect ${JSON.stringify(join(directory, profile.directory))}: ${error.message}`,
      );
    }
    const children = await readdir(directory, { withFileTypes: true });
    for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
      if (
        child.isDirectory() &&
        !['.git', 'node_modules', '.codex', '.claude'].includes(child.name)
      )
        await visit(join(directory, child.name));
    }
  }
  for (const root of roots) {
    const directory = resolve(root);
    if ((await lstat(directory)).isSymbolicLink())
      throw new Error('Refusing a symlinked scan root');
    await visit(directory);
  }
  return plans;
}

export async function planTransition(userDirectory, roots, client = 'codex') {
  const global = await planInstall(resolve(userDirectory), undefined, false, client);
  const projects = (await scanInstallations(roots, client)).filter(
    (plan) => plan.file !== global.file,
  );
  if (projects.some((plan) => plan.unrecognized.length))
    throw new Error(
      `Transition needs manual review of modified/unrecognized hooks: ${JSON.stringify(projects.filter((plan) => plan.unrecognized.length).map((plan) => plan.file))}. No configuration changed.`,
    );
  return [...projects, ...(global.changed ? [global] : [])];
}
