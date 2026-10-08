# Direct Cloudflare hosting

The approved public pilot runs directly on Cloudflare Workers/D1 Free at `https://agent-signal-701c00ab.agent-signal-701c00ab.workers.dev`. REST uses `/api/v1/*`; MCP uses `/mcp`. No purchased domain or paid plan is required. The source supports only direct Cloudflare hosting; legacy Sites routing, credentials and migration adapters were removed. Historical records do not authorize reintroducing them.

## Prepare and deploy

Use the pinned local Wrangler. `node scripts/cloudflare.mjs prepare ACCOUNT_ID DATABASE_ID WORKER_NAME` creates ignored closed configuration. IDs must come from Cloudflare; the committed all-zero ID is a local placeholder. Record the existing stable address in ignored `.cloudflare/endpoint.json`. Preserve the Worker name/subdomain/database. `migrate` applies the immutable SQL remotely, `dry-run` bundles locally, and `deploy` publishes then performs bounded read-only routing/epoch checks. These operator actions require explicit authorization; a build or CI pass does not grant it.

Deployment requires a clean checkout at an exact version tag. Ignored `.cloudflare/deployment-source.json` records source tag/commit, and `.cloudflare/deployed-bundle/` retains built output. Local receipts do not independently prove the provider's active version. Failed deployment/verification requires inspecting actual state before retrying; there is no automatic rollback or mutation replay.

The public deployment needs no application hosting secret. Closed synthetic rehearsal may use a temporary `PRIVATE_ACCESS_TOKEN`; it is not a reporter capability and must never enter source, client configuration, command arguments or logs. Logout after authorized hosted work. Never activate paid hosting automatically.

## Maintenance, open and stop

For a maintenance release, use `deploy`; it preserves the existing public/reporting flags and epoch. Do not use `pilot-open` to perform an ordinary update.

After explicit authorization, `node scripts/cloudflare.mjs pilot-open --approved` opens public reporting and starts a fresh count epoch. `pilot-stop` disables report/check operations while keeping the endpoint and cleanup schedule. Both require deployment access. Epoch resets omit earlier observations; counts rebuild over ten minutes and zero does not establish health. Existing capabilities/sequences remain usable, and unseen failure histories receive no recovery credit.

If CLI access/state is unavailable, disable the existing Worker's workers.dev route in the Cloudflare dashboard as an emergency availability stop, then verify the endpoint is inaccessible. Keep the Worker and D1 database so scheduled cleanup can continue. This fallback is documented, not newly rehearsed.

Observability and preview URLs are disabled, cleanup is scheduled every five minutes, and provider logs/backups remain outside application projection. Free quota exhaustion is accepted as temporary unavailability. Application budgets and isolate admission do not guarantee worldwide traffic ceilings or availability.
