import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { temporaryProject } from './install-fixture.ts';
import { install, planInstall } from '../clients/codex/install.mjs';
import { removalPlans, scanInstallations, planTransition } from '../clients/codex/lifecycle.mjs';
import { applyPlans } from '../clients/codex/hook-config.mjs';

test('Claude installation refuses a sibling settings change after planning', () =>
  temporaryProject(async (root) => {
    const directory = join(root, '.claude');
    const plan = await planInstall(
      directory,
      undefined,
      false,
      'claude-code',
      'settings.local.json',
    );
    await mkdir(directory);
    await writeFile(join(directory, 'settings.json'), '{"permissions":{"allow":["Read"]}}');
    await assert.rejects(applyPlans([plan]), /changed/);
    await assert.rejects(readFile(plan.file), { code: 'ENOENT' });
  }));

test('Claude project install preserves local settings and both hooks uninstall with exact backup', () =>
  temporaryProject(async (root) => {
    const directory = join(root, '.claude');
    await mkdir(directory);
    const file = join(directory, 'settings.local.json');
    const original = JSON.stringify({
      permissions: { allow: ['Read'] },
      env: { KEEP: 'yes' },
      hooks: { PostToolUse: [{ matcher: 'Read', hooks: [] }], Stop: [{ hooks: [] }] },
    });
    await writeFile(file, original);
    await install(root, undefined, false, 'claude-code');
    assert.equal((await install(root, undefined, false, 'claude-code')).changed, false);
    const config = JSON.parse(await readFile(file, 'utf8'));
    assert.deepEqual(config.permissions, { allow: ['Read'] });
    assert.equal(config.env.KEEP, 'yes');
    assert.equal(config.hooks.PostToolUse.length, 2);
    assert.equal(config.hooks.PostToolUseFailure.length, 1);
    assert.equal(await readFile(file + '.agent-signal-backup', 'utf8'), original);
    const beforeRemoval = await readFile(file, 'utf8');
    const plans = await removalPlans(directory, 'claude-code');
    assert.equal(plans[0].removals.length, 2);
    await applyPlans(plans);
    assert.equal(await readFile(plans[0].backup!, 'utf8'), beforeRemoval);
    const removed = JSON.parse(await readFile(file, 'utf8'));
    assert.deepEqual(removed.hooks.PostToolUse, [{ matcher: 'Read', hooks: [] }]);
    assert.deepEqual(removed.hooks.PostToolUseFailure, []);
    assert.equal(removed.env.KEEP, 'yes');
  }));

test('Claude refuses additive sibling duplicates, malformed hooks and unsafe settings', () =>
  temporaryProject(async (root) => {
    const directory = join(root, '.claude');
    await mkdir(directory);
    const global = await planInstall(directory, undefined, false, 'claude-code');
    await applyPlans([global]);
    await assert.rejects(install(root, undefined, false, 'claude-code'), /already exists/);
    await writeFile(global.file, JSON.stringify({ hooks: { PostToolUseFailure: {} } }));
    await assert.rejects(install(root, undefined, false, 'claude-code'), /Invalid existing/);
    await writeFile(global.file, '{}');
    await symlink(global.file, join(directory, 'settings.local.json'));
    await assert.rejects(install(root, undefined, false, 'claude-code'), /symlink/);
  }));

test('Claude transition scans both project settings layers and preserves modified hooks', () =>
  temporaryProject(async (root) => {
    const projects = join(root, 'projects'),
      first = join(projects, 'one'),
      second = join(projects, 'two');
    await mkdir(first, { recursive: true });
    await mkdir(second, { recursive: true });
    await install(first, undefined, false, 'claude-code');
    const old = await planInstall(join(second, '.claude'), undefined, false, 'claude-code');
    await applyPlans([old]);
    const user = join(root, 'claude home');
    const plans = await planTransition(user, [projects, first], 'claude-code');
    assert.equal(plans.length, 3);
    assert.deepEqual(
      plans[2].additions.map((item: { event: string }) => item.event),
      ['PostToolUse', 'PostToolUseFailure'],
    );
    await applyPlans(plans);
    assert.equal((await scanInstallations([projects], 'claude-code')).length, 0);
    assert.equal((await planTransition(user, [projects], 'claude-code')).length, 0);
    const file = join(user, 'settings.json'),
      config = JSON.parse(await readFile(file, 'utf8'));
    config.hooks.PostToolUseFailure[0].hooks[0].command += ' && echo changed';
    await writeFile(file, JSON.stringify(config));
    const removal = await removalPlans(user, 'claude-code');
    assert.equal(removal[0].unrecognized[0].event, 'PostToolUseFailure');
    assert.equal(removal[0].removals.length, 1);
  }));

test('Claude user installer uses the custom config home', () =>
  temporaryProject(async (root) => {
    const user = join(root, 'custom claude home');
    const result = spawnSync(process.execPath, ['scripts/install-claude-code-hook.mjs', '--user'], {
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_CONFIG_DIR: user },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      JSON.parse(await readFile(join(user, 'settings.json'), 'utf8')).hooks.PostToolUseFailure
        .length,
      1,
    );
  }));
