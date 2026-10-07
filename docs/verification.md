# Verification record

2026-10-07, prelaunch. All current operational evidence is synthetic/local; no real outage or customer-device evidence.

- Portable core tests use Node SQLite with the generated migration. They cover exact matching, deduplication, replay freshness, recovery, stale/conflicting sequence rejection, capability ownership/expiry, physical cleanup, quotas, input projection, generic errors, body bounds, admission, and MCP malformed requests/origins/tool errors.
- Local adapter tests cover sanitized requests/state, failure classification, ambiguous success skipped, acknowledgement failure, multi-destination recovery, observer failure, and stale crash artifacts. Crash fixtures emulate leftover lock/temp state; they do not claim actual process-termination testing.
- Built Vinext Worker with Wrangler/Miniflare D1 tested on loopback. `scripts/local-smoke.mjs` sends concurrent requests against the actual D1 adapter: 12 admitted per reporter/hour, later attempts 429, out-of-order sequences 409, duplicates remain one, distinct reporters count separately, and recovery/replay behave correctly.
- Formatting, architecture/no-raw-logging checks, lint, typecheck, and build run locally. The open-source readiness pass adds repository-local DevKit duplication/boundary/cycle/ownership gates, zero-warning lint, ShellCheck, an empty skipped-test register, explicit test type checking and a networked dependency gate. Reviewed scope/exceptions are in `quality.md` and `open-source-readiness.md`. Generated Worker manifest has `observability.enabled=false`; this does not prove upstream/provider logging disabled.
- Actual installed Codex CLI 0.159.0 smoke passed through the real PostToolUse hook and original adapter, with an approved metadata-only wrapper: synthetic Git fatal 503 produced 1 outstanding/0 other/0 recovered; a successful ref update produced 0 outstanding/1 recovered; stopping the observer left the original synthetic failed-tool result unaffected, with no hook error or injected counts. No real GitHub outage, real push, or public reporting occurred. Fixture hook configuration and private state were removed afterward.
- Runtime output had no exit metadata. Regression tests now cover that shape, bind destination and evidence within the same diagnostic/block, and exclude dry-run recovery.
- Browser review: desktop and 390×844 phone screenshots checked; phone content width 390 with no horizontal overflow. Headings and text were readable.
- Resumed Astra medium implementation review confirmed prelaunch convergence after the fixes. Private CI and saved-version outcomes are recorded in the final handoff receipt outside the source, so that the receipt can identify the exact built commit without changing it.

## Reproduce local Worker/D1 check

1. `npm ci && npm run build`.
2. `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_new_ben_urich.sql`.
3. Start `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --local --persist-to .wrangler/state --ip 127.0.0.1 --port 8799 --inspector-port 0 --var REPORTING_ENABLED:true`.
4. On a fresh synthetic local database, run `node scripts/local-smoke.mjs`. It assumes the test cohort starts empty. Never point this test at hosted production.

The scheduled cleanup function is tested in the core. A hosted cron trigger, provider retention/logging, cross-user access, and platform-wide costs remain launch gates. No production source is active.

## Open-source preparation verification

2026-10-07: stricter lint, ShellCheck, architecture/duplication rules, skipped-test gate, production/test type checks and all 12 behavioral tests pass locally. The networked dependency gate reports no unreviewed advisories: raw npm totals are 12 flagged packages, zero critical, covering the two explicitly documented tooling advisories. Neither is in the current generated Worker. No clean-audit/security-certification claim is made. The lockfile-only SPDX inventory generates successfully; installed-tree npm SBOM currently misreports a scoped Sharp override as invalid, so documentation uses the lockfile inventory.

Disposable probe repositories confirm a clean fixture passes while a renamed token-shape clone and a focused `.only` test fail their gates. The updated built Worker passes the fresh local D1 concurrency/deduplication/recovery smoke and serves the expected landing page. These are synthetic/local checks, not hosted or customer evidence.

## Cloudflare migration rehearsal — 2026-10-07

The owner authorized guarded Cloudflare preparation and the specific transfer of the private Sites service-access credential to a Cloudflare Worker secret. No credential entered GitHub, generated configuration, local files or client settings. The account's free workers.dev hostname and a D1 database were provisioned; the immutable schema was applied. Public access remained disabled throughout.

A hosted synthetic rehearsal exercised REST failure/replay and MCP checks against Sites through the stable Worker, ran the actual cutover command, verified the same address on Cloudflare D1 with a fresh window, rejected recovery credit for an unseen failure, and completed a new failure/recovery. The old Sites synthetic failure was closed. Both routes were restored to disabled reporting, and the random Cloudflare rehearsal key was removed. Cloudflare cleanup is configured every five minutes; this rehearsal does not establish a hosted physical-deletion deadline, load capacity, or real agent usefulness.

The rehearsal exposed deployment propagation and a native fetch receiver incompatibility that Node mocks did not catch. Verification now waits for matching backend/epoch; read checks may repeat, mutation writes never do. The production fetch wrapper retains its native receiver, and redirects are inspected without following them or forwarding secrets elsewhere. Regression coverage checks those behaviors, dropped upstream extras, same-address REST/MCP switching, fresh epochs, recovery semantics and count windows spanning UTC daily budgets. Provider logs/backups remain outside the application privacy claim. The Sites-generated plugin remains a separate owner-private connection; it is not the portable public MCP integration.
