import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { install, planInstall } from '../clients/codex/install.mjs';
import { planTransition } from '../clients/codex/lifecycle.mjs';
import { reviewAndApply, userHookDirectory, scanArguments } from './hook-lifecycle.mjs';
import { applyPlans } from '../clients/codex/hook-config.mjs';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    let result;
    if (args[0] === '--user') {
      if (args.length === 1) {
        const plan = await planInstall(userHookDirectory());
        await applyPlans([plan]);
        result = plan;
      } else if (args[1] === '--scan') {
        const roots = scanArguments(args.slice(2));
        await reviewAndApply(await planTransition(userHookDirectory(), roots));
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
      result = await install(project, endpoint, mode === '--local-test');
    }
    if (result) {
      console.log(`${result.changed ? 'Prepared' : 'Already installed'}: ${result.file}`);
      console.log(
        'Open /hooks in a local Codex session and review/trust the exact user or project hook to enable it.',
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
