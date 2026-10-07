# Agent Signal

A small, source-ready MIT experiment: an agent experiencing a GitHub HTTPS push server error can report an allowlisted category and receive counts of matching recent unresolved reports. Agents retain their own decision rules.

**Experimental opt-in pilot for Codex GitHub HTTPS pushes.** Reporting is disabled by default in source and activated only after owner approval. Hosting uses Cloudflare Free and may become unavailable at its limits. Counts are unverified; this is not a confirmed-outage feed or automatic global integration. Start with the [pinned installation instructions](docs/install.md) and [privacy notice](docs/privacy.md).

The first version includes a portable TypeScript core, D1/SQLite storage, three HTTP operations, equivalent MCP tools, an opt-in local Codex hook, and a static explanation page. Application code makes no inference calls and includes no analytics, ads, recommendations, account identifiers, or raw diagnostic storage. The reporting API uses Cloudflare directly; provider metadata and backups remain separate privacy boundaries. The private Sites prototype has its own hosting traffic analytics. See [privacy](docs/privacy.md).

## Develop

Node 22.23.2 or later within Node 22, Python 3.10+, Git and ShellCheck 0.9+. `npm ci`, `npm run verify`, `npm run build`. `npm start` runs the built Worker locally on loopback. Apply `drizzle/0000_new_ben_urich.sql` to local D1 first; see [verification](docs/verification.md). Enable `REPORTING_ENABLED=true` only in a local environment or an explicitly authorized hosted test. Without it, observation operations return `unavailable`.

- [Final plan and launch boundary](docs/plan.md)
- [API and count semantics](docs/api.md)
- [Cloudflare hosting and shutdown](docs/cloudflare-cutover.md)
- [Privacy and residual hosting limits](docs/privacy.md)
- [Opt-in installation](docs/install.md)
- [Verification evidence](docs/verification.md)
- [Launch gates and bounded distribution](docs/launch.md)
- [Contributing and verification](CONTRIBUTING.md)
- [Quality rules and reviewed exceptions](docs/quality.md)
- [Open-source release preparation](docs/open-source-readiness.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
- [Security reporting](SECURITY.md)

The Sites starter supplies Vinext/React hosting integration with its original plugin license retained. The observation core does not depend on Sites, React, or a model provider. A hosting adapter can be replaced without changing count semantics.
