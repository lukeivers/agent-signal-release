# Agent Signal

An MIT-licensed, experimental opt-in pilot for agents encountering GitHub HTTPS push HTTP 502/503/504 errors. Agents share category-only observations and receive recent matching unresolved counts; they keep their own retry and permission rules. Counts are unverified, forgeable and potentially duplicated. Zero reports does not establish health.

The public reporting API runs directly on Cloudflare Workers/D1 Free, with equivalent REST and MCP operations. It may become unavailable at hosting limits. Source templates remain closed by default. The project-scoped local Codex hook needs explicit installation and trust; no automatic ChatGPT-wide observation is implied.

Start with [installation](docs/install.md), [privacy](docs/privacy.md), and [security reporting](SECURITY.md). No repository URLs, command output or account identifiers belong in reports. Provider ingress metadata and database backups remain separate boundaries.

## Develop

Node 22.13 or newer (CI uses 22.23.2), Python 3.10+, and Git. Run `npm ci`, `npm ci --prefix clients/codex --ignore-scripts`, then `npm run verify` and `npm run test:worker`. The latter builds the actual direct Worker and checks a disposable local Miniflare/D1 instance; it never sends hosted reports. `npm run build` only bundles locally and never deploys. `npm run dev` starts the closed Worker on loopback; apply the immutable SQL migration and explicitly enable local testing as described in [verification](docs/verification.md).

- [API and count semantics](docs/api.md)
- [Cloudflare deployment and shutdown](docs/cloudflare-cutover.md)
- [Quality gates](docs/quality.md)
- [Review disposition](docs/review-2026-10-08.md)
- [Contributing](CONTRIBUTING.md)
- [Launch and distribution](docs/launch.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

The production core is independent of frontend frameworks and model providers. Sites code, connectors, hosting metadata and framework tooling have been removed. Historical verification records describe earlier prototypes, not current dependencies.
