import { createHash, createHmac, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, lstat } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import lockfile from 'proper-lockfile';

export function classify(event) {
  if (event?.hook_event_name !== 'PostToolUse' || event.tool_name !== 'Bash') return null;
  const command = event.tool_input?.command ?? event.tool_input?.cmd;
  // Deliberately narrow. Never execute any text from the event.
  if (
    typeof command !== 'string' ||
    !/^\s*git\s+push(?:\s|$)/.test(command) ||
    /[;\n|&`<>]/.test(command) ||
    /(?:^|\s)(?:--dry-run|-[A-Za-z]*n[A-Za-z]*)(?:\s|$)/.test(command)
  )
    return null;
  const response = event.tool_response;
  const output = typeof response === 'string' ? response : response?.output;
  const exit =
    typeof response?.exit_code === 'number'
      ? response.exit_code
      : Number(/Process exited with code (\d+)/.exec(output ?? '')?.[1] ?? NaN);
  if (typeof output !== 'string') return null;
  const knownExit = Number.isSafeInteger(exit);
  const destinations = [
    ...output.matchAll(/^To (https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?)\s*$/gm),
  ];
  const updatedRef = /^\s+[0-9a-f]{3,40}\.\.[0-9a-f]{3,40}\s+\S+\s+->\s+\S+\s*$/m.test(output);
  const cleanSuccess = !/fatal:|error:|\[rejected\]|\[remote rejected\]/i.test(output);
  if (destinations.length === 1 && cleanSuccess && (knownExit ? exit === 0 : updatedRef))
    return { state: 'recovery', remote: destinations[0][1].replace(/\/$/, '') };
  // Destination and status must come from the same diagnostic, never an
  // unrelated URL printed by a pre-push hook or another remote's output.
  const failure =
    /^fatal: unable to access ['"](https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?)['"]:\s*The requested URL returned error: (502|503|504)\s*$/m.exec(
      output,
    );
  if (failure && (!knownExit || exit !== 0))
    return { state: 'failure', remote: failure[1].replace(/\/$/, ''), error: `http_${failure[2]}` };
  return null;
}
export async function observe(event, options = {}) {
  const classification = classify(event);
  if (!classification || typeof event.session_id !== 'string' || event.session_id.length > 200)
    return null;
  const origin = new URL(options.endpoint ?? process.env.AGENT_SIGNAL_ENDPOINT ?? '');
  const loopback = options.allowLoopback ?? process.env.AGENT_SIGNAL_ALLOW_LOOPBACK === '1';
  if (
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== '/' ||
    !(
      origin.protocol === 'https:' ||
      (loopback &&
        origin.protocol === 'http:' &&
        ['127.0.0.1', 'localhost'].includes(origin.hostname))
    )
  )
    return null;
  const directory =
    options.directory ??
    process.env.AGENT_SIGNAL_STATE_DIR ??
    join(homedir(), '.local', 'state', 'agent-signal');
  if (!isAbsolute(directory)) return null;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const directoryStat = await lstat(directory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink() || directoryStat.mode & 0o077)
    return null;
  const name = createHash('sha256').update(event.session_id).digest('hex');
  const file = join(directory, `${name}.json`);
  let release;
  try {
    release = await lockfile.lock(file, {
      realpath: false,
      stale: 10000,
      update: 2000,
      retries: 0,
    });
  } catch {
    return null;
  }
  const save = async (state) => {
    // Unique temporary files survive a kill without preventing future writes.
    const temporary = `${file}.${randomBytes(12).toString('hex')}.tmp`;
    await writeFile(temporary, JSON.stringify(state), { mode: 0o600, flag: 'wx' });
    await rename(temporary, file);
  };
  try {
    const now = options.now ?? Date.now();
    let state;
    try {
      const stat = await lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.mode & 0o077 || stat.size > 32_000)
        return null;
      state = JSON.parse(await readFile(file, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') return null;
    }
    if (!state || now - state.created >= 22 * 3_600_000 || typeof state.capability !== 'string') {
      state = {
        created: now,
        capability: `v1.${Math.floor(now / 3_600_000)}.${randomBytes(32).toString('base64url')}`,
        sequence: 0,
        pending: {},
      };
    }
    // No background retries. A later matching tool event may retry after cooldown.
    if (Number.isFinite(state.nextAttempt) && now < state.nextAttempt) return null;
    const defer = async () => {
      state.backoffMs = Math.min((state.backoffMs || 500) * 2, 60_000);
      state.nextAttempt = now + state.backoffMs;
      await save(state);
    };
    const destination = createHmac('sha256', state.capability)
      .update(classification.remote)
      .digest('hex');
    const pending = state.pending[destination] ?? [];
    if (classification.state === 'recovery' && !pending.length) return null;
    // Recovery closes only the previously observed error categories for this destination.
    const errors = classification.state === 'failure' ? [classification.error] : [...pending];
    if (Object.keys(state.pending).length >= 32 && !state.pending[destination]) return null;
    let answer = null;
    for (const error of errors) {
      if (!['http_502', 'http_503', 'http_504'].includes(error)) continue;
      const cohort = {
        service: 'github',
        operation: 'git_push',
        access: 'git_https',
        environment: 'local_agent',
        error,
      };
      const payload = { cohort, sequence: ++state.sequence };
      // Persist ordering before transmission, so interrupted calls never reuse a sequence.
      if (classification.state === 'failure')
        state.pending[destination] = [...new Set([...(state.pending[destination] ?? []), error])];
      else {
        // Another destination can keep this exact session/cohort outstanding.
        const elsewhere = Object.entries(state.pending).some(
          ([key, values]) => key !== destination && values.includes(error),
        );
        if (elsewhere) {
          state.pending[destination] = (state.pending[destination] ?? []).filter(
            (item) => item !== error,
          );
          if (!state.pending[destination].length) delete state.pending[destination];
          await save(state);
          continue;
        }
      }
      await save(state);
      try {
        const reply = await fetch(`${origin.origin}/api/v1/${classification.state}`, {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(800),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.capability}`,
          },
          body: JSON.stringify(payload),
        });
        if (!reply.ok) {
          await reply.body?.cancel();
          await defer();
          break;
        }
        const text = await readBoundedToolOutput(reply, 4096),
          counts = JSON.parse(text);
        if (
          [counts.outstanding, counts.otherOutstanding, counts.recovered].every(
            (value) => Number.isSafeInteger(value) && value >= 0 && value <= 20000,
          )
        ) {
          state.backoffMs = 0;
          state.nextAttempt = 0;
          await save(state);
          answer = {
            outstanding: counts.outstanding,
            otherOutstanding: counts.otherOutstanding,
            recovered: counts.recovered,
          };
          if (classification.state === 'recovery') {
            state.pending[destination] = (state.pending[destination] ?? []).filter(
              (item) => item !== error,
            );
            if (!state.pending[destination].length) delete state.pending[destination];
            await save(state);
          }
        } else {
          await defer();
          break;
        }
      } catch {
        /* Observer failure must never affect the original tool action. */
        await defer();
        break;
      }
    }
    return answer;
  } finally {
    await release();
  }
}
export async function readBoundedToolOutput(source, maximum) {
  const stream = source.body ?? source;
  const reader = typeof stream.getReader === 'function' ? stream.getReader() : null;
  let total = 0;
  const chunks = [];
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > maximum) {
          await reader.cancel();
          throw new Error('bounded');
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    for await (const chunk of stream) {
      total += chunk.length;
      if (total > maximum) throw new Error('bounded');
      chunks.push(Buffer.from(chunk));
    }
  }
  return Buffer.concat(chunks).toString('utf8');
}
