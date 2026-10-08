import { resolve, join } from 'node:path';
import { lstat } from 'node:fs/promises';
import { planRemoval, scanInstallations } from '../clients/codex/lifecycle.mjs';
import { reviewAndApply, userHookDirectory, scanArguments } from './hook-lifecycle.mjs';

try {
  const args = process.argv.slice(2);
  let plans;
  if (args.length === 1 && args[0] === '--user') plans = [await planRemoval(userHookDirectory())];
  else if (args[0] === '--scan') {
    plans = await scanInstallations(scanArguments(args.slice(1)));
  } else if (args.length === 1 && !args[0].startsWith('--')) {
    const target = resolve(args[0]);
    if (!(await lstat(target)).isDirectory()) throw new Error('Target must be a real directory');
    plans = [await planRemoval(join(target, '.codex'))];
  } else
    throw new Error(
      'Usage: node scripts/uninstall-codex-hook.mjs TARGET | --user | --scan ROOT [ROOT...]',
    );
  await reviewAndApply(plans);
} catch (error) {
  console.error(`Uninstallation stopped: ${error.message}`);
  console.error(
    'If an edit failed after confirmation, inspect the listed files and backups before retrying; multiple files are not one atomic transaction.',
  );
  process.exitCode = 1;
}
