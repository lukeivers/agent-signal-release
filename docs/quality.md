# Reproducible quality checks

`npm run verify` uses repository-local tools and rules; no owner's home directory or remote DevKit checkout is required. DevKit's JS/TS architecture and skipped-test engines are vendored unchanged from release 2.0.1. Their byte hashes are in `tools/devkit/provenance.json`. They are build-time checks, not runtime service code. The project owner supplied this local DevKit; these copies are distributed under this repository's MIT license.

## Architecture and duplication

`rules/architecture-js.json` includes every tracked or new unignored JS/TS source under app, build, clients, core, db, lib, scripts and tests, plus root configuration/declaration files. Default clone thresholds are 50 tokens, five lines and 12 distinct tokens, normalizing identifiers and literals. Duplicate imports and function-free literal data are not clone findings. The scan also checks imports, cycles, callable names and selected owners for cohort validation, capability validation and storage. Named owners catch reused declarations, not differently named semantic copies; the privacy logging and portable-core checks remain separate.

Reviewed exclusions:

- Vendored DevKit engines are unchanged tooling, verified against their recorded hashes; their own internal implementation is outside this application's architecture scan.
- The four Sites shell scripts are covered by ShellCheck instead of the JS parser. Three SC2016 annotations in the pnpm helper preserve intended child-shell arguments or pnpm environment placeholders; they do not suppress other shell findings.
- CSS is formatting-reviewed, built and visually reviewed, not parsed by the JS architecture engine. Generated output and ignored starter samples are not shipped project source.
- `cloudflare:` and `virtual:` are explicit hosting/runtime import namespaces. Ordinary undeclared packages still fail.

There is one narrowly recorded boundary finding: `scripts/run-framework.mjs` dynamically imports a URL selected only from two fixed, installed CLI paths according to the local execution profile. DevKit cannot statically resolve that expression. It accepts no user-selected import URL. The exact expression hash/count is recorded in `rules/architecture-baseline-js.json`; edits and additional findings require review. There is no clone baseline or blanket exclusion of tests, clients or starter JS/TS code.

Do not raise thresholds, omit handwritten source or grow baselines to obtain a pass. Review each finding; refactor shared behavior only when the responsibilities actually belong together. An intentional exception needs a source-controlled reason. DevKit's baseline update normally only shrinks debt; growth is an explicit reviewed operation.

## Lint, types and tests

ESLint applies Next.js core-web-vitals/TypeScript rules to project source and fails on any warning. Vendored DevKit engines are outside ESLint/Prettier to preserve their bytes. Starter UI exceptions apply only to unused, ignored registry components; they are not exemptions for the observation code. TypeScript checks production TS and a separate tests configuration; JavaScript adapters are linted and behavior-tested, not claimed to have full `checkJs` coverage.

The skipped-test gate has an empty register. `.only` always fails; skips/todos require explicit reasoned registration. This scanner uses documented lexical heuristics and cannot prove no dynamic skip exists. Behavioral tests and the local built-Worker smoke remain necessary.

CI has read-only repository permissions, pinned Actions commits, no deployment secrets or publication step, and does not persist checkout credentials. Secret scanning is redacted. `npm run audit:dependencies` requires network access and a current advisory database; CI runs it separately from offline verification. It fails any advisory outside exact, expiring reviewed exceptions; see the release checklist for their scope. Passing these checks is evidence, not a security certification.
