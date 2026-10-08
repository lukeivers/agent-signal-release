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

At the prelaunch checkpoint, scheduled cleanup was tested locally. Later hosted synthetic evidence and pilot activation are recorded below; provider retention, costs and real-use utility remain separate limitations.

## Open-source preparation verification

2026-10-07: stricter lint, ShellCheck, architecture/duplication rules, skipped-test gate, production/test type checks and all 12 behavioral tests pass locally. The networked dependency gate reports no unreviewed advisories: raw npm totals are 12 flagged packages, zero critical, covering the two explicitly documented tooling advisories. Neither is in the current generated Worker. No clean-audit/security-certification claim is made. The lockfile-only SPDX inventory generates successfully; installed-tree npm SBOM currently misreports a scoped Sharp override as invalid, so documentation uses the lockfile inventory.

Disposable probe repositories confirm a clean fixture passes while a renamed token-shape clone and a focused `.only` test fail their gates. The updated built Worker passes the fresh local D1 concurrency/deduplication/recovery smoke and serves the expected landing page. These are synthetic/local checks, not hosted or customer evidence.

## Cloudflare migration rehearsal — 2026-10-07

The owner authorized guarded Cloudflare preparation and the specific transfer of the private Sites service-access credential to a Cloudflare Worker secret. No credential entered GitHub, generated configuration, local files or client settings. The account's free workers.dev hostname and a D1 database were provisioned; the immutable schema was applied. Public access remained disabled throughout.

A hosted synthetic rehearsal exercised REST failure/replay and MCP checks against Sites through the stable Worker, ran the actual cutover command, verified the same address on Cloudflare D1 with a fresh window, rejected recovery credit for an unseen failure, and completed a new failure/recovery. The old Sites synthetic failure was closed. Both routes were restored to disabled reporting, and the random Cloudflare rehearsal key was removed. Cloudflare cleanup is configured every five minutes; this rehearsal does not establish a hosted physical-deletion deadline, load capacity, or real agent usefulness.

The rehearsal exposed deployment propagation and a native fetch receiver incompatibility that Node mocks did not catch. Verification now waits for matching backend/epoch; read checks may repeat, mutation writes never do. The production fetch wrapper retains its native receiver, and redirects are inspected without following them or forwarding secrets elsewhere. Regression coverage checks those behaviors, dropped upstream extras, same-address REST/MCP switching, fresh epochs, recovery semantics and count windows spanning UTC daily budgets. Provider logs/backups remain outside the application privacy claim. The Sites-generated plugin remains a separate owner-private connection; it is not the portable public MCP integration.

## Direct Cloudflare risk checks — 2026-10-07

The account dashboard confirmed Workers Free as the selected current plan. No paid upgrade was performed. The owner approved removing the Sites reporting dependency and starting directly on Cloudflare D1 at the existing stable address.

Scheduled deletion was observed with four disposable synthetic D1 rows: one observation/budget pair expired at 19:28:06 UTC; a read at 19:31:16 found both gone while the unexpired comparison pair remained. The comparison pair was then removed. Reporting stayed closed during this test. This verifies one scheduled deletion episode, not a maximum deletion SLA or erasure from provider backups.

Local failure tests seed an in-memory budget at its ceiling and simulate 429, 503, network errors and a stalled endpoint. No hosted quota is exhausted. REST/MCP reject the exhausted mutations without changing observations. The hook aborts the stalled request after approximately 800 ms and makes no automatic retry; failed attempts defer later matching events with an exponential one-second-to-one-minute cooldown. A valid acknowledgement resets it. Healthy events make no requests.

The required formatting, duplication/architecture, lint, shell, type and skipped-test checks pass with 23 behavioral tests. Evidence remains synthetic; it does not demonstrate real outage usefulness or high-volume capacity.

The guarded direct-host request included a synthetic email and diagnostic marker. A separate remote D1 read confirmed the current-epoch observation existed, all stored columns were allowlisted, and neither extra marker nor an original bearer capability appeared in application rows. The rehearsal's multi-statement database inspection failed; the separate single-query inspection supplied the privacy evidence. Deployment propagation also caused transient old-version responses, so hosted shutdown was verified separately before secret removal. Both `SITES_ACCESS_TOKEN` and `PRIVATE_ACCESS_TOKEN` were then confirmed absent, and anonymous API access returned 503. The Sites origin is absent from the direct configuration. No full direct REST/MCP success claim is added for this risk-check episode; the earlier migration rehearsal supplies that separate evidence.

## Final pilot candidate rehearsal — 2026-10-07

The project-scoped installer preserves existing hooks, saves an exact backup, refuses symlinked/malformed hook configuration and duplicate installation, and leaves trust to the user. A separate hook-only lockfile installs four dependencies with lifecycle scripts disabled; its audit reports zero findings. CI now installs and audits that dependency tree in addition to the development tree.

An installed command in a disposable project ran the production stdin hook through an owner-only loopback relay which attached the temporary private guard to the hosted Cloudflare endpoint. An unrelated event made no request. A synthetic GitHub HTTPS 503 produced one outstanding report; a matching synthetic recovery produced zero outstanding/one recovered. MCP read the same hosted D1 state. Remote D1 inspection found no original bearer, synthetic repository/person, or diagnostic email. Only two mutations were sent in the successful episode. This is a synthetic command-line integration check, not new evidence of real outage utility or universal Codex-version support.

The first attempt returned no context; its cause was not captured. The bounded repeat succeeded, with relay-to-Worker responses measured at 227 and 233 ms. These measurements are not a latency guarantee; dropped acknowledgements and best-effort reporting remain disclosed limitations. Each episode restored private access and disabled reporting, removed its temporary Worker secret and synthetic observation/reporter-budget rows, and verified anonymous API status 503. Scheduled cleanup stays enabled.

All 26 behavioral tests, formatting, DevKit duplication/architecture, privacy logging, ESLint, ShellCheck, type and skipped-test checks pass. Production build and portable Worker dry-run pass. The development audit retains the two previously reviewed tooling advisories; no new advisory exception is added. Launch/stop commands are prepared but have not opened reporting. Deployment verification requires three consecutive matching read-only responses, with a bounded propagation window; this does not prove convergence at every edge worldwide.

## Publication-day dependency refresh — 2026-10-08

The launch-time audit reported six newly indexed Next.js advisories after the previous candidate's audit passed. Next.js and its lint configuration were patched from 16.3.6 to 16.3.8. The refreshed scoped audit has no new blockers and retains only the two existing documented tooling exceptions; all 26 tests, required quality gates and the build pass. Public source publication occurred before the failed refresh result was handled, but reporting/API activation was held closed during remediation. The portable direct Cloudflare observation core does not import Next.js.

## Public pilot activation — 2026-10-08

The sanitized release repository and `v0.1.0-pilot.1` were published with owner approval, then direct Cloudflare reporting opened with epoch `2026-10-08T11:07:11.552Z`. REST/MCP and the installed production hook completed a hosted synthetic failure/recovery episode. The exact canary records and local state were removed; Wrangler was logged out after verification. The account was observed on Workers Free with no Worker secrets. These are dated observations, not a current account-state guarantee or evidence of real outage usefulness. Earlier sections describe historical prelaunch states.

## Independent-review remediation — 2026-10-08

Three new regressions failed before remediation: quiet hook startup with a missing adapter, exhausted-reporter daily budget isolation, and supported MCP version negotiation. The fixes pass those regressions and tests for absent dependencies/executable, preserved existing backups, dirty/untagged deployment refusal, and isolate admission across fresh environment objects.

All 34 tests and formatting, DevKit duplication/boundary/cycle/ownership checks, raw-logging checks, zero-warning ESLint, ShellCheck, production/test type checks and skipped-test gate pass. Production build and the portable direct-Worker bundle pass. A disposable Miniflare instance loaded that direct bundle and the immutable D1 migration: concurrency, deduplication, recovery/replay, reporter-first budgets and MCP negotiation passed with synthetic local data. No hosted quota or production reports were used. The dependency gate reports no unreviewed findings; the same two scoped tooling exceptions remain, and the isolated client audit reports zero vulnerabilities.

These fixes are source changes pending a new reviewed release and deployment. Existing installations retain the old command until users reinstall and re-trust it. No live service/account settings, paid plan, announcement or directory submission was changed during this remediation. The old tag remains immutable.

## Standalone source and hygiene gates — 2026-10-08

After the owner's correction, removed all Sites/framework source and legacy forwarding paths. 32 current behavioral tests pass (four removed legacy-adapter cases replaced by two direct-gateway cases), as do formatting, zero-warning lint, types, skipped tests and DevKit architecture with an empty baseline and zero findings. The committed direct-Worker Miniflare/D1 smoke passes and is required in CI. Knip has zero unused source/export/dependency findings. Temporary negative probes confirmed an orphan source file and an unused dependency declaration each fail its gate; both fixtures were removed/restored afterward.

The locked root package inventory shrank from 698 entries to 264, including platform-specific optional tooling entries. Both root and isolated client advisory audits report zero findings; obsolete exceptions were removed. The private Sites project itself was not deleted or accessed. Current-source removal does not rewrite immutable earlier tags or Git history, or change the active Worker until deployment.
