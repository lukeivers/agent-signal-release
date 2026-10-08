# Current implementation scope

Agent Signal is a public MIT-licensed, opt-in Cloudflare Workers/D1 Free pilot. It compares allowlisted GitHub HTTPS push HTTP 502/503/504 observations. The project-scoped Codex hook requires review and trust; manual MCP use is separate. Counts are unverified, not proof of outages or unique people. Agents keep their own retry and permission rules.

Only direct Cloudflare hosting is supported. Sites frontend, connectors, migration backend, metadata, framework tooling and dependencies are removed. The immutable D1 SQL migration remains because the running database uses it. Historical verification records describe earlier prototypes and are not instructions to restore them.

Acceptance requires request projection/privacy, bounded atomic budgets, safe sequencing/recovery, fail-open observer behavior, explicit installation consent, clean deployment source, and offline plus direct-Worker/D1 checks. Required source hygiene checks include lint, formatting, DevKit architecture/duplication/ownership, skipped tests, types, pinned Knip unused code/dependencies and dependency advisories. Retired code must not be retained for speculative future use.

Public access and reporting were launched with owner approval. Future releases/deployment, directory submissions and one-time outreach remain explicit operator actions; no paid hosting, automatic upgrade, continual marketing or indefinite agent monitoring is authorized. Preserve the stable origin, hosting identifiers and epoch during maintenance releases unless a reset is deliberately approved.
