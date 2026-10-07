# Contributing

Agent Signal is an early, single-maintainer experiment. Luke Ivers maintains it; review and support are best effort, with no response-time or uptime commitment. Small, focused changes are easier to review. Discuss new services, capture surfaces, data collection or hosting changes before implementing them. Issues and pull requests become the discussion channels when the repository is public.

## Set up and verify

Use Node 22.23.2 or later within Node 22, Python 3.10 or later, Git, and ShellCheck 0.10 or later. On macOS, install ShellCheck with `brew install shellcheck`; on Debian/Ubuntu use `sudo apt-get install shellcheck`. No global DevKit installation is needed.

```sh
npm ci
npm run verify
npm run build
```

The verification command checks formatting, token-shape duplication, dependency boundaries and cycles, named ownership, privacy logging, ESLint with zero warnings, shell scripts, TypeScript (including tests), unregistered skipped tests and behavioral tests. See [quality rules](docs/quality.md) for scope and limitations. CI also scans Git history for secrets and runs `npm run audit:dependencies` against current advisories. The advisory check needs network access; documented exceptions expire and cannot hide unrelated findings. Follow [local Worker verification](docs/verification.md) for the HTTP/D1 integration scenario. Never run synthetic reports against a public service.

## Submit a change

Use a branch and a pull request. Explain the user-visible outcome, relevant checks and remaining limitations. Add regression coverage for meaningful behavioral changes; prose-only edits do not need invented tests. Preserve the disabled ingestion default, fail-open hook, explicit installation consent and launch boundaries. Do not add raw diagnostics, repository URLs, session IDs, account identifiers or telemetry to the reporting service.

Use synthetic examples in issues and tests. A sanitized error category, version, platform and minimal reproduction are enough to start. Do not paste commands, tool transcripts, headers, bearer capabilities, private repository names or state files. Follow [SECURITY.md](SECURITY.md) for vulnerabilities. AI-assisted contributions receive the same review and evidence requirements as other contributions.

Contribute only material you are authorized to share, under the project's MIT license, preserving third-party notices. No CLA, mandatory account enrollment or contribution volume is required. Maintainer review decides acceptance; passing CI does not authorize deployment or publication.
