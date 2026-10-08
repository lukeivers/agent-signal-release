# Changelog

## v0.1.0-pilot.2 — 2026-10-08

- Remove Sites frontend/connectors, legacy backend, project metadata and framework tooling; retain only the direct Cloudflare Worker and opt-in clients.
- Require pinned Knip unused-code/dependency checks and direct Worker/D1 smoke in CI; remove obsolete advisory and architecture exceptions.

- Quiet hook startup even when dependencies or its pinned executable disappear; dependency preflight and atomic installation with collision-safe backups.
- Correct MCP version negotiation, clearer tool descriptions/annotations and protocol-shaped admission errors.
- Reporter-first budget admission, isolate-scoped request guard, deployment source guard, and client dependency updates.
- Correct live-pilot documentation and explicit classifier/install limitations.

## v0.1.0-pilot.1 — 2026-10-08

- Category-only GitHub HTTPS push failure and recovery observations, exact recent counts, portable core and D1 storage.
- Opt-in local Codex hook, project-scoped installer with isolated locked dependencies, and manual MCP tools; reporting disabled by default.
- Explicit pilot launch/stop commands with bounded read-only deployment verification.
- Reproducible lint, duplication, boundary, skipped-test, shell, type and behavior checks.

The public source and direct Cloudflare pilot launched with owner approval. Anonymous counts remain unverified; no announcement or directory submission is implied by release.
