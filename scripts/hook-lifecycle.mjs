import { createInterface } from 'node:readline/promises';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { lstat } from 'node:fs/promises';
import { install, planInstall, hookClient } from '../clients/codex/install.mjs';
import { removalPlans, scanInstallations, planTransition } from '../clients/codex/lifecycle.mjs';
import { applyPlans } from '../clients/codex/hook-config.mjs';

const userHookDirectory = (client) =>
  resolve(
    client === 'codex'
      ? process.env.CODEX_HOME || join(homedir(), '.codex')
      : process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'),
  );

async function reviewAndApply(plans, client) {
  for (const plan of plans) {
    for (const item of plan.unrecognized ?? [])
      console.log(
        `Kept unrecognized hook: ${JSON.stringify(plan.file)} ${item.event}[${item.entryIndex}].hooks[${item.hookIndex}]; review manually.`,
      );
  }
  plans = plans.filter((plan) => plan.changed);
  if (!plans.length) {
    console.log('No matching changes found.');
    return;
  }
  console.log('Review the complete plan. No configuration has been changed.');
  for (const plan of plans) {
    console.log(`File: ${JSON.stringify(plan.file)}`);
    for (const removal of plan.removals ?? [])
      console.log(
        `  Remove ${removal.event}[${removal.entryIndex}].hooks[${removal.hookIndex}]: ${JSON.stringify(removal.hook)}`,
      );
    for (const addition of plan.additions ?? [])
      console.log(`  Add user-wide ${addition.event} hook: ${JSON.stringify(addition.hook)}`);
    console.log(
      plan.backup
        ? `  Exact backup: ${JSON.stringify(plan.backup)}`
        : '  Create a new hook configuration.',
    );
  }
  console.log('Unrelated hooks, checkout files, local state and prior backups will be kept.');
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log(
      'Preview only. Run in an interactive terminal to confirm; piped input cannot approve changes.',
    );
    return;
  }
  const input = createInterface({ input: process.stdin, output: process.stdout });
  let answer;
  try {
    answer = await input.question(
      'Type APPLY to perform exactly these changes, or Enter to cancel: ',
    );
  } finally {
    input.close();
  }
  if (answer !== 'APPLY') {
    console.log('Cancelled; no configuration changed.');
    return;
  }
  await applyPlans(plans);
  for (const plan of plans) console.log(`Updated: ${JSON.stringify(plan.file)}`);
  console.log(
    `Restart affected ${hookClient(client).name} sessions. Review new hooks in /hooks before reporting.`,
  );
}

function scanArguments(roots, client) {
  if (!roots.length || roots.some((root) => root.startsWith('--')))
    throw new Error('Supply explicit scan roots');
  console.log(`Scan roots: ${JSON.stringify(roots.map((root) => resolve(root)))}`);
  console.log(
    `Skipping symlinked directories, .git, node_modules, .codex and .claude. Only ${hookClient(client).directory}/${hookClient(client).files.join(' and ' + hookClient(client).directory + '/')} files are inspected.`,
  );
  return roots;
}

export async function runInstall(client) {
  try {
    const args = process.argv.slice(2);
    let result;
    if (args[0] === '--user') {
      if (args.length === 1) {
        const plan = await planInstall(userHookDirectory(client), undefined, false, client);
        await applyPlans([plan]);
        result = plan;
      } else if (args[1] === '--scan') {
        const roots = scanArguments(args.slice(2), client);
        await reviewAndApply(
          await planTransition(userHookDirectory(client), roots, client),
          client,
        );
      } else throw new Error('Expected --user [--scan ROOT [ROOT...]]');
    } else {
      const [project, endpoint, mode] = args;
      if (
        !project ||
        project.startsWith('--') ||
        args.length > 3 ||
        (mode && mode !== '--local-test')
      )
        throw new Error(
          'Expected TARGET [ENDPOINT] [--local-test], or --user [--scan ROOT [ROOT...]]',
        );
      result = await install(project, endpoint, mode === '--local-test', client);
    }
    if (result) {
      console.log(`${result.changed ? 'Prepared' : 'Already installed'}: ${result.file}`);
      console.log(
        client === 'codex'
          ? 'Open /hooks in a local Codex session and review/trust the exact user or project hook to enable it.'
          : 'Claude Code can run these hooks when the settings load. Restart affected sessions and inspect both hooks in /hooks; installation opts the selected scope into reporting.',
      );
    }
  } catch (error) {
    console.error(`Installation stopped: ${error.message}`);
    console.error(
      'No hook was trusted automatically. After a confirmed transition error, inspect listed files/backups before retrying.',
    );
    process.exitCode = 1;
  }
}

export async function runUninstall(client) {
  try {
    const args = process.argv.slice(2);
    let plans;
    if (args.length === 1 && args[0] === '--user')
      plans = await removalPlans(userHookDirectory(client), client);
    else if (args[0] === '--scan')
      plans = await scanInstallations(scanArguments(args.slice(1), client), client);
    else if (args.length === 1 && !args[0].startsWith('--')) {
      const target = resolve(args[0]);
      if (!(await lstat(target)).isDirectory()) throw new Error('Target must be a real directory');
      plans = await removalPlans(join(target, hookClient(client).directory), client);
    } else
      throw new Error(
        `Usage: node scripts/uninstall-${client === 'codex' ? 'codex' : 'claude-code'}-hook.mjs TARGET | --user | --scan ROOT [ROOT...]`,
      );
    await reviewAndApply(plans, client);
  } catch (error) {
    console.error(`Uninstallation stopped: ${error.message}`);
    console.error(
      'If an edit failed after confirmation, inspect the listed files and backups before retrying; multiple files are not one atomic transaction.',
    );
    process.exitCode = 1;
  }
}
