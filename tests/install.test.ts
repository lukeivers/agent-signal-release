import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, symlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { install, PILOT_ENDPOINT } from '../clients/codex/install.mjs';

test('project installation preserves existing hooks, backs them up and is idempotent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'signal install '));
  const original = {
    custom: 'preserve',
    hooks: { Stop: [{ matcher: '*', hooks: [] }], PostToolUse: [{ matcher: 'Read', hooks: [] }] },
  };
  try {
    await mkdir(join(root, '.codex'));
    const file = join(root, '.codex/hooks.json');
    await writeFile(file, JSON.stringify(original));
    const result = await install(root);
    assert.equal(result.changed, true);
    assert(result.command.includes(PILOT_ENDPOINT));
    const config = JSON.parse(await readFile(file, 'utf8'));
    assert.deepEqual(config.hooks.Stop, original.hooks.Stop);
    assert.deepEqual(config.hooks.PostToolUse[0], original.hooks.PostToolUse[0]);
    assert.equal(config.custom, 'preserve');
    assert.equal(config.hooks.PostToolUse[1].hooks[0].timeout, 3);
    assert.equal(await readFile(file + '.agent-signal-backup', 'utf8'), JSON.stringify(original));
    assert.equal((await install(root)).changed, false);
    await assert.rejects(install(root, 'https://another.example'), /already exists/);
  } finally {
    await rm(root, { recursive: true });
  }
});

test('installation refuses malformed existing configuration, unsafe origins and symlinked hook directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'signal-invalid-'));
  try {
    await assert.rejects(install(root, 'https://example.test/?private=detail'), /HTTPS/);
    await assert.rejects(install(root, 'http://127.0.0.1:8799'), /HTTPS/);
    await mkdir(join(root, 'elsewhere'));
    await symlink(join(root, 'elsewhere'), join(root, '.codex'));
    await assert.rejects(install(root), /symlinked/);
    await rm(join(root, '.codex'));
    await mkdir(join(root, '.codex'));
    const file = join(root, '.codex/hooks.json');
    await writeFile(file, '[]');
    await assert.rejects(install(root), /Invalid existing/);
    assert.equal(await readFile(file, 'utf8'), '[]');
  } finally {
    await rm(root, { recursive: true });
  }
});

test('pilot switches preserve hosting identifiers, start a fresh count window and stop ingestion', async () => {
  const { pilotConfig } = await import('../scripts/cloudflare.mjs');
  const previous = {
    name: 'fixed',
    account_id: 'same',
    d1_databases: [{ database_id: 'same-db' }],
    vars: {
      BACKEND_MODE: 'cloudflare',
      PUBLIC_ENABLED: 'false',
      REPORTING_ENABLED: 'false',
      STATE_EPOCH: 'old',
    },
  };
  const opened = pilotConfig(previous, true, 'fresh');
  assert.equal(opened.name, previous.name);
  assert.deepEqual(opened.d1_databases, previous.d1_databases);
  assert.equal(opened.vars.PUBLIC_ENABLED, 'true');
  assert.equal(opened.vars.STATE_EPOCH, 'fresh');
  assert.equal(pilotConfig(opened, true, 'retry').vars.STATE_EPOCH, 'fresh');
  assert.equal(pilotConfig(opened, false).vars.REPORTING_ENABLED, 'false');
  assert.equal(pilotConfig(previous, false).vars.PUBLIC_ENABLED, 'false');
  assert.throws(
    () => pilotConfig({ ...previous, vars: { ...previous.vars, BACKEND_MODE: 'sites' } }, true),
    /direct/,
  );
});

async function temporaryProject(check: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "signal quote's "));
  try {
    await check(root);
  } finally {
    await rm(root, { recursive: true });
  }
}
const runNode = (args: string[], root?: string) =>
  spawnSync(process.execPath, args, { cwd: root, input: '{}', encoding: 'utf8' });
function assertQuiet(result: ReturnType<typeof spawnSync>) {
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
}

test('a missing adapter dependency is quiet and harmless at hook startup', () =>
  temporaryProject(async (root) => {
    const hook = join(root, 'hook.mjs');
    await writeFile(hook, await readFile(new URL('../clients/codex/hook.mjs', import.meta.url)));
    assertQuiet(runNode([hook]));
  }));

test('installation keeps an existing backup and atomically replaces restored configuration', () =>
  temporaryProject(async (root) => {
    await mkdir(join(root, '.codex'));
    const file = join(root, '.codex/hooks.json');
    await writeFile(file, '{"hooks":{}}');
    await writeFile(file + '.agent-signal-backup', 'original backup');
    await install(root);
    assert.equal(await readFile(file + '.agent-signal-backup', 'utf8'), 'original backup');
    assert.equal(JSON.parse(await readFile(file, 'utf8')).hooks.PostToolUse.length, 1);
  }));

test('generated command works and quietly skips a removed Node executable', () =>
  temporaryProject(async (root) => {
    const installed = await install(root);
    const run = (command: string) =>
      spawnSync('sh', ['-c', command], { input: '{}', encoding: 'utf8' });
    assertQuiet(run(installed.command));
    assertQuiet(run(installed.command.replaceAll(process.execPath, '/missing-agent-signal-node')));
  }));

test('installer rejects absent client dependencies before creating hook configuration', () =>
  temporaryProject(async (root) => {
    await writeFile(
      join(root, 'install.mjs'),
      await readFile(new URL('../clients/codex/install.mjs', import.meta.url)),
    );
    const child = runNode(
      ['--input-type=module', '-e', 'import {install} from "./install.mjs"; await install(".");'],
      root,
    );
    assert.notEqual(child.status, 0);
    assert.match(child.stderr, /Install hook dependencies/);
    await assert.rejects(readFile(join(root, '.codex/hooks.json')), { code: 'ENOENT' });
  }));

test('deployment guard rejects dirty or untagged source and accepts a clean version tag', () =>
  temporaryProject(async (root) => {
    const { requireReleaseSource } = await import('../scripts/cloudflare.mjs');
    const git = (...args: string[]) => {
      const child = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
      assert.equal(child.status, 0, child.stderr);
    };
    git('init');
    git('config', 'user.name', 'Synthetic');
    git('config', 'user.email', 'synthetic@example.test');
    await writeFile(join(root, 'source.txt'), 'reviewed');
    git('add', '.');
    git('commit', '-m', 'synthetic fixture');
    assert.throws(() => requireReleaseSource(root), /tagged/);
    git('tag', 'v0.1.0-pilot.2');
    assert.equal(requireReleaseSource(root).tag, 'v0.1.0-pilot.2');
    await writeFile(join(root, 'source.txt'), 'unreviewed');
    assert.throws(() => requireReleaseSource(root), /clean/);
  }));
