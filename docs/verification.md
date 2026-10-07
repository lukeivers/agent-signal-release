# Verification record

2026-10-07, prelaunch. All current operational evidence is synthetic/local; no real outage or customer-device evidence.

- Portable core tests use Node SQLite with the generated migration. They cover exact matching, deduplication, replay freshness, recovery, stale/conflicting sequence rejection, capability ownership/expiry, physical cleanup, quotas, input projection, generic errors, body bounds, admission, and MCP malformed requests/origins/tool errors.
- Local adapter tests cover sanitized requests/state, failure classification, ambiguous success skipped, acknowledgement failure, multi-destination recovery, observer failure, and stale crash artifacts. Crash fixtures emulate leftover lock/temp state; they do not claim actual process-termination testing.
- Built Vinext Worker with Wrangler/Miniflare D1 tested on loopback. `scripts/local-smoke.mjs` sends concurrent requests against the actual D1 adapter: 12 admitted per reporter/hour, later attempts 429, out-of-order sequences 409, duplicates remain one, distinct reporters count separately, and recovery/replay behave correctly.
- Formatting, architecture/no-raw-logging checks, lint, typecheck, and build run locally. Generated Worker manifest has `observability.enabled=false`; this does not prove upstream/provider logging disabled.
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
