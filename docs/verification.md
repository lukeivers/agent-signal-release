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

For Claude Code, use the [Claude install/uninstall guide](claude-code.md) and a temporary `CLAUDE_CONFIG_DIR` for global-install tests. Both `PostToolUseFailure` and `PostToolUse` must be configured. Local synthetic tests should use an explicit loopback endpoint with `--local-test`, never the public pilot.

## Claude Code evidence — 2026-10-10

Claude Code 2.1.294 ran two separate plain `git push` tool calls using a disposable fake Git executable: one simulated HTTP 503 failure, then one successful ref update written to stderr. The actual project installer configured both hooks; Claude loaded that local settings file. The candidate hook sent failure then recovery to the actual locally built Worker with disposable Miniflare D1 storage. Claude received count context showing one outstanding report, then zero outstanding and one recovered; D1 held one recovery observation at sequence two. No real push or hosted report was sent. This establishes the synthetic installed-client flow, not real-outage usefulness, every Claude version, or interactive workspace/hook approval UI.

A separate temporary-terminal rehearsal verified cancellation preserving original bytes, confirmed project-to-user transition and user uninstall for both event hooks, unrelated settings preservation and exact backups. Real user/project hooks were not changed. Regression checks cover client capability separation, successful events refusing failure reports, sibling settings changes, malformed/symlinked settings and piped previews. No backend source, provider settings or deployment changed.

A single read-only check with `User-Agent: AgentSignal-ClaudeCode/0.1` returned HTTP 200 from the public pilot with the existing epoch. It submitted no observation; this checks header acceptance, not hosted mutation delivery.

## Deployed pilot evidence — 2026-10-08

The patched pilot `v0.1.0-pilot.2` was deployed from commit `57b802aaacc31f1dcc3fb67570d7f40a4124a9ec`. Wrangler reported Worker version `55517ae8-22c7-409e-a0c7-7b4ae17266a7`. Read-only REST checks matched the direct backend and existing epoch; MCP initialization echoed `2025-06-18` and listed the three tools. No reports were submitted for that deployment check. Worker secrets were empty and Wrangler was logged out afterward.

Earlier consented hosted synthetic failure/recovery and scheduled-deletion checks established individual episodes, not a real outage, deletion deadline or general reliability guarantee. This is dated evidence, not live monitoring. Current source can be ahead of the deployed tag; release notes must distinguish source-only changes from deployments.

## HTTP compatibility evidence — 2026-10-08

The [Python example](api.md#read-only-python-example) was executed unchanged from the documentation with Python 3.9.6 and returned HTTP 200 JSON from the existing pilot. Separate read-only requests using `AgentSignal-Codex/0.1` and `AgentSignal-Operator/0.1` also returned 200 with the existing epoch; an identified malformed check returned 400, and identified MCP initialization negotiated `2025-06-18`. No failure/recovery reports were submitted and no Worker configuration was changed.

Python's default `urllib` header still received HTTP 403 with plain-text `error code: 1010`. The accepted free-hosting approach supports explicitly identified clients; it does not remove this provider restriction or establish compatibility for every client/network. Local hook tests capture the real outgoing header for both failure and recovery, alongside the existing payload privacy checks. Operator tests verify its fixed header without sending reports.
