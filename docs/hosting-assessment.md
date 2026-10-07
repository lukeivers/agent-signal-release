# Sites hosting assessment — 2026-10-07

The saved candidate is undeployed, owner-only, and reporting defaults off. This assessment authorizes no deployment or public exposure.

## Verified before deployment

- Saving source does not deploy it. Sites documents every deployed URL as production; a private candidate must retain owner-only audience restrictions.
- Sites provides managed D1 storage and an MCP connection, but connecting this candidate's MCP server returns a publish-first error. Client authentication and platform access enforcement require an explicitly authorized private deployment to test.
- Sites automatically records traffic analytics. Application code does not add analytics, and the generated Worker disables its own observability. This does not disable or characterize host analytics, ingress, dispatcher or security logging.
- Reporting is disabled unless the environment explicitly enables it. Application quotas bound validated mutations, not total platform traffic, read costs or hosting usage.
- Sites documents plan-specific usage limits across all Sites. It does not establish a per-Site hard request/spend ceiling in the controls reviewed.
- The account's Site settings UI shows owner-only sharing, environment variables, domain settings and deletion, plus Analytics, Database and Scheduled tabs. The inspected Settings panel exposes no logging/analytics opt-out, backup-retention, cron or per-Site usage-cap configuration. No settings were changed.
- Expired records can be deleted by the portable cleanup operation even when ingestion is disabled. A scheduled handler exists, but the generated deployment has no cron trigger configured. Sites agent schedules are not evidence of a deterministic Worker timer.

## Unresolved gates

Before real reports: verify a deterministic cleanup trigger and cadence, actual D1 backup policy, request/header/body and MCP argument logging/redaction, automatic analytics fields/retention/controls, and applicable usage ceilings plus practical shutdown. Available connector controls do not expose these policies. Absence from the reviewed tool surface does not prove Sites lacks the capability.

A private synthetic deployment can establish database binding/migrations, access enforcement and client connectivity. It cannot prove provider log or backup retention. Use generated categories and random capabilities only; keep reporting off except during a bounded synthetic test. Do not invite real users or describe the host as privacy-cleared while policy gates remain unresolved.

Questions ready for provider clarification, not sent:

1. Can a Sites Worker use a deterministic cron trigger? What supported configuration and cleanup delay apply without scheduled model runs?
2. Which ingress, security, MCP and automatic analytics fields are retained, for how long, and can optional collection be disabled? Are Authorization and tool capabilities redacted?
3. What backup/Time Travel policy applies to Sites D1, including deleted records and Site deletion?
4. What current limits apply to this account, can one Site's request/storage usage be capped, and how quickly does restricting audience or disabling reporting take effect?

Public launch remains a separate decision after these gates. If the host cannot meet them, use the portable core on another managed host or pause the service; do not replace deterministic maintenance with recurring paid inference.

## Primary sources

- [Sites documentation](https://learn.chatgpt.com/docs/sites): production deployments, audience restrictions, automatic analytics, plan-wide limits, storage and data residency.
- [Sites administration](https://learn.chatgpt.com/docs/enterprise/sites): workspace audience and permission controls.
- [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/): always-on backup history; actual Sites-managed plan is unverified.
- [Workers logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/): Worker observability controls are narrower than all provider logging.
- [Cron triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/): a handler needs a configured trigger; its presence alone does not schedule execution.
