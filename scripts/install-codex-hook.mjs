import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { install } from '../clients/codex/install.mjs';
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [project, endpoint, mode] = process.argv.slice(2);
  if (!project || (mode && mode !== '--local-test')) {
    console.error('Usage: node scripts/install-codex-hook.mjs PROJECT [ENDPOINT] [--local-test]');
    process.exitCode = 1;
  } else {
    install(project, endpoint, mode === '--local-test')
      .then(({ file, changed }) => {
        console.log(`${changed ? 'Prepared' : 'Already installed'}: ${file}`);
        console.log(
          'Open /hooks in this project’s Codex session and review/trust the exact command to enable it.',
        );
      })
      .catch(() => {
        console.error(
          'Installation stopped. Install client dependencies first, then check the project path and existing hook configuration; no hook was trusted automatically.',
        );
        process.exitCode = 1;
      });
  }
}
