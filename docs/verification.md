# Verify Agent Signal locally

These checks exercise code and synthetic scenarios. They do not prove real-outage usefulness, worldwide availability, delivery latency or support in every Codex version.

## Run the required checks

With Node.js 22.13+, Python 3.10+ and Git, run from the repository root:

```sh
npm ci
npm ci --prefix clients/codex --ignore-scripts
npm run verify
npm run test:worker
npm run audit:dependencies
npm audit --prefix clients/codex --audit-level=moderate
```

`verify` should exit successfully after formatting, local documentation links, architecture/duplication, unused-code/dependency, lint, type, skipped-test and behavioral checks. The [quality reference](quality.md) describes their limits.

`test:worker` builds the actual direct Worker locally, applies the immutable SQL migration to disposable Miniflare D1 storage, and exercises concurrency, deduplication, quota rejection, recovery/replay and MCP version negotiation. The output reports successful local Worker checks. It needs local port access, but no Cloudflare login and no hosted report traffic. The temporary database is disposed afterward.

The two advisory commands need network access. Success means no unaccepted finding at that time; it is not a permanent security claim. Any exception must be exact, justified, reviewed and unexpired. The current exception register is empty.

`npm run build` only creates a local bundle. `npm run dev` starts a closed Worker on loopback with persistent local state; it does not by itself initialize a usable reporting database. Use `test:worker` for the supported disposable verification path. Deployment is a separate [operator workflow](hosting.md).

## Check installation without polluting public counts

Use the [install guide](install.md) with a disposable target directory to check configuration preparation, preservation of existing hooks and paths containing spaces. For all-projects setup, pass a temporary `CODEX_HOME` only to the test command; do not point tests at your real user configuration. Confirm cancellation/piped previews write nothing, exact backups preserve original bytes, removals keep unrelated entries, and transitions target only supplied scan roots. Inspect the generated configuration and installer output. Do not trust a test hook in an unrelated project or replay fabricated tool events against the public endpoint.

Automated installer/client tests cover configuration preservation, duplicate/symlink refusal, atomic writes/backups, missing dependencies/executable, projected requests/state, narrow classification and bounded observer failures. Crash fixtures model stale locks and abandoned temporary files; they are not evidence of actual process termination. A visible, trusted hook is configuration evidence, not proof of successful real-event reporting.

## Deployed pilot evidence — 2026-10-08

The patched pilot `v0.1.0-pilot.2` was deployed from commit `57b802aaacc31f1dcc3fb67570d7f40a4124a9ec`. Wrangler reported Worker version `55517ae8-22c7-409e-a0c7-7b4ae17266a7`. Read-only REST checks matched the direct backend and existing epoch; MCP initialization echoed `2025-06-18` and listed the three tools. No reports were submitted for that deployment check. Worker secrets were empty and Wrangler was logged out afterward.

Earlier consented hosted synthetic failure/recovery and scheduled-deletion checks established individual episodes, not a real outage, deletion deadline or general reliability guarantee. This is dated evidence, not live monitoring. Current source can be ahead of the deployed tag; release notes must distinguish source-only changes from deployments.
