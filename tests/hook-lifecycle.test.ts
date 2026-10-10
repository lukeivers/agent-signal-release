import { temporaryProject } from './install-fixture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, rm, symlink, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { install } from '../clients/codex/install.mjs';
import { planRemoval, scanInstallations, planTransition } from '../clients/codex/lifecycle.mjs';
import { applyPlans } from '../clients/codex/hook-config.mjs';

test('removal recognizes generated hooks but preserves unrelated and modified commands', () =>
  temporaryProject(async (root) => {
    await install(root);
    const file = join(root, '.codex/hooks.json');
    const config = JSON.parse(await readFile(file, 'utf8'));
    const owned = config.hooks.PostToolUse[0].hooks[0];
    const other = { type: 'command', command: 'echo /clients/codex/hook.mjs', timeout: 3 };
    const modified = { ...owned, command: owned.command + ' && echo changed' };
    config.custom = 'keep';
    config.hooks.PostToolUse[0].hooks.push(other, modified);
    config.hooks.Stop = [{ hooks: [] }];
    const original = JSON.stringify(config);
    await writeFile(file, original);
    const plan = await planRemoval(join(root, '.codex'));
    assert.equal(plan.removals.length, 1);
    await applyPlans([plan]);
    const next = JSON.parse(await readFile(file, 'utf8'));
    assert.deepEqual(next.hooks.PostToolUse[0].hooks, [other, modified]);
    assert.equal(next.custom, 'keep');
    assert.deepEqual(next.hooks.Stop, config.hooks.Stop);
    assert(plan.backup);
    assert.equal(await readFile(plan.backup, 'utf8'), original);
    assert.equal((await planRemoval(join(root, '.codex'))).changed, false);
  }));

test('scan stays inside supplied roots, deduplicates overlap and skips symlinks and dependencies', () =>
  temporaryProject(async (root) => {
    const project = join(root, 'projects', 'one');
    const ignored = join(root, 'projects', 'node_modules', 'two');
    const outside = join(root, 'outside');
    for (const path of [project, ignored, outside]) {
      await mkdir(path, { recursive: true });
      await install(path);
    }
    await symlink(outside, join(root, 'projects', 'linked'));
    const found = await scanInstallations([join(root, 'projects'), project]);
    assert.deepEqual(
      found.map((plan) => plan.file),
      [join(project, '.codex/hooks.json')],
    );
  }));

test('changed or symlinked configuration aborts the complete preflight before edits', () =>
  temporaryProject(async (root) => {
    const paths = [join(root, 'one'), join(root, 'two')];
    for (const path of paths) {
      await mkdir(path);
      await install(path);
    }
    const plans = await scanInstallations([root]);
    const first = await readFile(plans[0].file, 'utf8');
    await writeFile(plans[1].file, '{"hooks":{}}');
    await assert.rejects(applyPlans(plans), /changed/);
    assert.equal(await readFile(plans[0].file, 'utf8'), first);
    await rm(plans[1].file);
    await symlink(plans[0].file, plans[1].file);
    await assert.rejects(planRemoval(join(paths[1], '.codex')), /symlink/);
  }));

test('transition removes project copies and preserves existing user hooks in a custom Codex home', () =>
  temporaryProject(async (root) => {
    const project = join(root, 'projects', 'one');
    const user = join(root, 'custom codex home');
    await mkdir(project, { recursive: true });
    await install(project);
    await mkdir(user);
    await writeFile(join(user, 'hooks.json'), '{"hooks":{"Stop":[{"hooks":[]}]}}');
    const plans = await planTransition(user, [join(root, 'projects')]);
    assert.equal(plans.length, 2);
    assert.equal(plans[1].addition.type, 'command');
    await applyPlans(plans);
    assert.equal(
      JSON.parse(await readFile(join(project, '.codex/hooks.json'), 'utf8')).hooks.PostToolUse
        .length,
      0,
    );
    const next = JSON.parse(await readFile(join(user, 'hooks.json'), 'utf8'));
    assert.deepEqual(next.hooks.Stop, [{ hooks: [] }]);
    assert.equal(next.hooks.PostToolUse.length, 1);
    assert.equal((await planTransition(user, [join(root, 'projects')])).length, 0);
  }));

for (const client of ['codex', 'claude-code'])
  test(`${client} uninstall and migration CLIs show exact plans but cannot apply through piped input`, () =>
    temporaryProject(async (root) => {
      await install(root, undefined, false, client);
      const file = join(
        root,
        client === 'codex' ? '.codex/hooks.json' : '.claude/settings.local.json',
      );
      const original = await readFile(file, 'utf8');
      const user = join(root, 'fresh custom home');
      for (const args of [
        [`scripts/uninstall-${client}-hook.mjs`, root],
        [`scripts/install-${client}-hook.mjs`, '--user', '--scan', root],
      ]) {
        const result = spawnSync(process.execPath, args, {
          encoding: 'utf8',
          input: 'APPLY\n',
          env: { ...process.env, CODEX_HOME: user, CLAUDE_CONFIG_DIR: user },
        });
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /Remove PostToolUse/);
        assert(result.stdout.includes(JSON.stringify(file)));
        assert.match(result.stdout, /Preview only/);
        assert.equal(await readFile(file, 'utf8'), original);
        await assert.rejects(
          readFile(join(user, client === 'codex' ? 'hooks.json' : 'settings.json')),
          { code: 'ENOENT' },
        );
      }
    }));

test('legacy pilot.1 hooks with quoted paths can be removed, modified ones block transition', () =>
  temporaryProject(async (root) => {
    await mkdir(join(root, '.codex'));
    const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
    const legacy = {
      type: 'command',
      timeout: 3,
      command: `AGENT_SIGNAL_ENDPOINT='https://example.test' ${quote("/node's path/node")} ${quote("/checkout's path/clients/codex/hook.mjs")}`,
    };
    const file = join(root, '.codex/hooks.json');
    await writeFile(
      file,
      JSON.stringify({ hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [legacy] }] } }),
    );
    assert.equal((await planRemoval(join(root, '.codex'))).removals.length, 1);
    await writeFile(
      file,
      JSON.stringify({
        hooks: {
          PostToolUse: [
            { matcher: 'Bash', hooks: [{ ...legacy, command: legacy.command + ' extra' }] },
          ],
        },
      }),
    );
    await assert.rejects(planTransition(join(root, 'new user home'), [root]), /manual review/);
    await assert.rejects(readFile(join(root, 'new user home/hooks.json')), { code: 'ENOENT' });
  }));

test('guarded hooks from a relocated checkout with apostrophes are recognized', () =>
  temporaryProject(async (root) => {
    const directory = join(root, "checkout's path", 'clients', 'codex');
    await mkdir(directory, { recursive: true });
    for (const file of ['install.mjs', 'hook-config.mjs'])
      await copyFile(new URL('../clients/codex/' + file, import.meta.url), join(directory, file));
    await symlink(
      fileURLToPath(new URL('../clients/codex/node_modules', import.meta.url)),
      join(directory, 'node_modules'),
    );
    const child = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const { install } = await import(${JSON.stringify(pathToFileURL(join(directory, 'install.mjs')).href)}); await install(${JSON.stringify(root)});`,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(child.status, 0, child.stderr);
    assert.equal((await planRemoval(join(root, '.codex'))).removals.length, 1);
  }));
