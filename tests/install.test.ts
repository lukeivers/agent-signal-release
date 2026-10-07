import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, symlink } from 'node:fs/promises';
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
  assert.throws(
    () => pilotConfig({ ...previous, vars: { ...previous.vars, BACKEND_MODE: 'sites' } }, true),
    /direct/,
  );
});
