import { createInterface } from 'node:readline/promises';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { applyPlans } from '../clients/codex/hook-config.mjs';

export const userHookDirectory = () => resolve(process.env.CODEX_HOME || join(homedir(), '.codex'));

export async function reviewAndApply(plans) {
  for (const plan of plans) {
    for (const item of plan.unrecognized ?? [])
      console.log(
        `Kept unrecognized hook: ${JSON.stringify(plan.file)} PostToolUse[${item.entryIndex}].hooks[${item.hookIndex}]; review manually.`,
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
        `  Remove PostToolUse[${removal.entryIndex}].hooks[${removal.hookIndex}]: ${JSON.stringify(removal.hook)}`,
      );
    if (plan.addition)
      console.log(`  Add user-wide PostToolUse hook: ${JSON.stringify(plan.addition)}`);
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
    'Restart affected Codex sessions. Review any new user hook in /hooks before reporting.',
  );
}

export function scanArguments(roots) {
  if (!roots.length || roots.some((root) => root.startsWith('--')))
    throw new Error('Supply explicit scan roots');
  console.log(`Scan roots: ${JSON.stringify(roots.map((root) => resolve(root)))}`);
  console.log(
    'Skipping symlinked directories, .git and node_modules. Only .codex/hooks.json files are inspected.',
  );
  return roots;
}
