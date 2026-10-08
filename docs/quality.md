# Reproducible quality checks

`npm run verify` uses repository-local tools and rules; no owner's home directory or remote DevKit checkout is required. DevKit's JS/TS architecture and skipped-test engines are vendored unchanged from release 2.0.1. Their byte hashes are in `tools/devkit/provenance.json`. They are build-time checks, not runtime service code. The project owner supplied this local DevKit; these copies are distributed under this repository's MIT license.

## Architecture and duplication

`rules/architecture-js.json` includes every tracked or new unignored JS/TS source under clients, core, scripts and tests, plus root configuration/declaration files. Default clone thresholds are 50 tokens, five lines and 12 distinct tokens, normalizing identifiers and literals. Duplicate imports and function-free literal data are not clone findings. The scan also checks imports, cycles, callable names and selected owners for cohort validation, capability validation and storage. Named owners catch reused declarations, not differently named semantic copies; the privacy logging and portable-core checks remain separate.

Reviewed exclusions:

- Vendored DevKit engines are unchanged tooling, verified against their recorded hashes; their own internal implementation is outside this application's architecture scan.
  No application source directories are blanket-excluded. The removed framework launcher also removes its unresolved-import baseline; the current architecture baseline is empty. The remaining source is formatted and linted; vendored DevKit bytes are checked separately.

Do not raise thresholds, omit handwritten source or grow baselines to obtain a pass. Review each finding; refactor shared behavior only when the responsibilities actually belong together. An intentional exception needs a source-controlled reason. DevKit's baseline update normally only shrinks debt; growth is an explicit reviewed operation.

## Lint, types and tests

ESLint recommended JavaScript and TypeScript rules apply to all remaining handwritten source with zero warnings. TypeScript checks the portable production core and a separate test configuration. JavaScript clients/scripts are linted and behavior-tested; no full checkJs coverage is claimed. Only unchanged vendored DevKit engines are excluded from formatting/lint to preserve provenance.

The skipped-test gate has an empty register. `.only` always fails; skips/todos require explicit reasoned registration. This scanner uses documented lexical heuristics and cannot prove no dynamic skip exists. Behavioral tests and the local built-Worker smoke remain necessary.

CI has read-only repository permissions, pinned Actions commits, no deployment secrets or publication step, and does not persist checkout credentials. Secret scanning is redacted. `npm run audit:dependencies` requires network access and a current advisory database; CI runs it separately from offline verification. It fails any advisory outside exact, expiring reviewed exceptions; see the release checklist for their scope. Passing these checks is evidence, not a security certification.

## Unused source and retired integrations

Pinned Knip checks unused source, exports, dependencies and unresolved imports with explicitly listed real entrypoints. `npm run unused` is required by `npm run verify` and CI. See `knip.json`; do not declare every source file an entrypoint. The vendored DevKit engines remain hash-checked and are recognized as executable tooling entrypoints. `scripts/check-source.mjs` also rejects retired framework dependencies and starter directories. These checks do not prove every line serves a product requirement; subsystem retirement still requires explicit review of code, configuration, dependencies, credentials, docs and tests.
