# Direct Cloudflare hosting and retained migration adapter

## Current launch decision

The owner approved starting the reporting service directly on Cloudflare Workers and D1, staying on Free. The dashboard's Workers plans page confirmed Free as the current plan on 2026-10-07. The approved public pilot opened on 2026-10-08; public access and reporting are enabled. The stable address remains unchanged. No domain purchase, paid activation or automatic upgrade is authorized.

Direct mode needs no Sites origin or access credential. The owner-private Sites prototype can remain separate; it is not a reporting dependency. New `prepare` configurations default to `cloudflare` mode. `node scripts/cloudflare.mjs prepare ACCOUNT_ID DATABASE_ID WORKER_NAME` prepares a closed direct deployment, followed by `migrate`, `dry-run`, and guarded deployment verification. Reporter capabilities are never hosting account credentials.

The earlier Sites-to-Cloudflare migration was rehearsed and remains available for existing integrations. The instructions below describe that legacy adapter, not the initial public deployment. Do not reintroduce its Sites access secret for the direct launch.

## Legacy stable endpoint and prepared cutover

The public pilot must advertise one verified Cloudflare `workers.dev` origin from its first release. REST uses `/api/v1/*`; MCP uses `/mcp` at that same origin. No domain purchase is required. Do not advertise the generated Sites MCP connection or Sites API as migration-stable integrations. The existing owner-private Sites plugin is a separate connection and cannot transparently be retargeted by this Worker.

The small Cloudflare Worker runs from day one. In `sites` mode it validates/projections requests locally and forwards only category/sequence and the rotating reporter capability to the owner-private Sites REST backend. MCP parsing and discovery run at the stable Worker; MCP calls use the same projected REST operations upstream. In `cloudflare` mode the exact same Worker uses its pre-provisioned D1 database. The Sites page can remain an explanation page; it is not in the new reporting path.

## Prepare before launch

1. Sign in with the pinned local Wrangler. Provision a free Workers subdomain and Agent Signal D1 database. Never rename the Worker or account subdomain after clients install it.
2. `node scripts/cloudflare.mjs prepare ACCOUNT_ID DATABASE_ID WORKER_NAME SITES_ORIGIN` creates ignored, guarded configuration. Copy the actual deployment origin into `.cloudflare/endpoint.json` as `{ "url": "https://WORKER.SUBDOMAIN.workers.dev/" }`. All IDs must come from Cloudflare; the committed all-zero database ID is only a local/dry-run placeholder.
3. `node scripts/cloudflare.mjs migrate` applies the same immutable SQL migration remotely. `node scripts/cloudflare.mjs dry-run` builds the portable Worker. Neither source code nor the database requires a framework migration.
4. Store `PRIVATE_ACCESS_TOKEN` and, **only with explicit owner authorization to export this credential**, `SITES_ACCESS_TOKEN` through Wrangler's secret stdin. Never put them in source/configuration, shell arguments, archives, logs or client settings. The latter is Sites' service-access credential, not a reporter capability. Guarded verification receives the random private token through `PRIVATE_ACCESS_TOKEN` in the deployment process environment.
5. Rehearse failure, duplicate failure, MCP check, cutover, fresh counts, recovery without a known prior failure, and new failure/recovery through the exact same URL. Restore `sites` mode before public launch, turn reporting off, remove the private rehearsal token, and close Sites reporting again. Keep synthetic and real-use evidence distinct.
6. Before opening the pilot, verify actual intended client installation against the stable address. This does not automatically install or publish a ChatGPT plugin. A public source release, opening service access, real reporting, paid activation and announcements require separate owner authorization.

Cloudflare configuration disables optional Worker observability and preview URLs and configures cleanup every five minutes. Provider security/ingress metadata and D1 backup history remain outside the application's projection boundary. A configured cron is not proof of an observed hosted deletion deadline. No paid plan, billing upgrade, domain purchase or automatic deployment pipeline is part of preparation.

## One-command cutover

Once the launch-approved configuration is in place:

```sh
node scripts/cloudflare.mjs cutover
```

This preserves the Worker name, database binding, public/reporting switches and client URL; changes `BACKEND_MODE` to `cloudflare`; creates a new server-controlled epoch; deploys; and checks the live endpoint for that backend and epoch. Repeating the command preserves the epoch. A failed deployment or verification stops with an error: inspect the actual live state before retrying. There is no automatic rollback, cross-backend replay, or dual writing. Treat deployment success and verified routing as separate facts; rollout propagation and in-flight requests prevent a promise of instant or lossless cutover.

The database is prepared in advance, but report history is deliberately not copied. A new epoch gives Cloudflare observations a new namespace, so earlier rehearsal or deployment state cannot silently reappear. Existing capabilities/sequences remain usable. A recovery without a preceding failure in this new window is not counted as a recovery. Responses include `backendEpoch`, `windowWarming` and a continuity caveat for REST and MCP. Counts rebuild over ten minutes; zero is never evidence of health.

During rollout, old in-flight requests may still land in Sites. After verifying the new backend, disable Sites reporting and privately redeploy its saved version. This retires the legacy API/MCP pool; it is housekeeping, not a prerequisite to starting the new stable-address path. New public integrations must not depend on the legacy pool. Returning public traffic to Sites after Cloudflare writes is deliberately blocked by the helper and requires a separately reviewed fresh-window procedure. Code rollback must preserve backend/epoch or disclose a new reset.

The existing 10,000 validated mutation attempts/day and 12/capability/hour limits remain unchanged after switching. Moving hosts does not raise these limits. Healthy hook sessions send no periodic checks. Aggregate queries can become read-heavy during correlated incidents, so free hosting is a pilot capacity choice, not a scale guarantee. Changing Cloudflare to paid service, increasing ceilings, or applying for open-source credits is a later owner decision.

## Shutdown

Set `REPORTING_ENABLED=false` in the ignored deployment configuration and deploy the reviewed Worker. Public discovery can remain available; data operations return `unavailable`. Set `PUBLIC_ENABLED=false` with no private token for a completely closed API, then deploy. Cleanup remains scheduled. Do not delete the Worker/subdomain as a first response: that sacrifices the stable client address. Inspect free-plan quotas/account limits separately; an application mutation ceiling does not cap all platform requests.

## Deployment source and emergency fallback

Deployment commands now require a clean checkout at an exact version tag. Unreviewed source cannot be shipped merely to stop reporting. After a deployment, ignored `.cloudflare/deployment-source.json` records the source tag/commit; `.cloudflare/deployed-bundle/` retains the built output. These local records do not independently prove the active provider version.

If CLI access or local state is unavailable, use Cloudflare's dashboard for the existing Worker and disable its workers.dev route. This is an emergency availability stop, not a verified reporting-only switch; verify the public endpoint is inaccessible afterward. Keep the Worker and database so scheduled cleanup can continue. Do not delete the database or activate a paid plan.
