# Contributing

Small, focused fixes and clear installation feedback are welcome. Luke Ivers maintains this early experiment with best-effort review; see [support expectations](SUPPORT.md) and [community expectations](CODE_OF_CONDUCT.md). Discuss new services, capture surfaces, data collection or hosting changes in an issue before implementing them.

## Set up locally

Use Node.js 22.13 or newer, Python 3.10 or newer, and Git. From a checkout of the repository:

```sh
npm ci
npm ci --prefix clients/codex --ignore-scripts
npm run verify
npm run test:worker
```

The first installation is for development tooling; the second is for the independently locked hook client. No global DevKit installation, Cloudflare account or production credential is needed. The Worker smoke uses disposable local D1 state and fabricated reports. See [verification](docs/verification.md) for expected results and [quality checks](docs/quality.md) for coverage.

## Submit a change

Use a branch and pull request. Explain the problem, resulting behavior, relevant evidence and limitations. Add regression coverage for meaningful behavioral changes; prose-only edits need no invented tests. Verify documented commands and links when changing setup instructions. CI also checks current dependency advisories and scans history for secrets.

Preserve the disabled-by-default source configuration, quiet observer failure, explicit reporting consent and hook trust. Keep reports limited to the existing allowlist. Do not add raw diagnostics, repository URLs, session/account identifiers or telemetry to the service. Use synthetic inputs in issues and tests; follow [security reporting](SECURITY.md) for vulnerabilities.

Contribute only material you are authorized to share under the MIT license, retaining applicable third-party notices. AI-assisted contributions need the same review and evidence as other contributions. No CLA or contribution quota is required. Maintainer review decides acceptance; passing CI does not authorize deployment, directory submission or outreach.

## Remove what a change retires

Remove obsolete code, dependencies, configuration, tests, comments and active instructions in the same change that replaces a subsystem. Retained compatibility needs a current requirement and explicit maintainer agreement. Preserve immutable migrations that the running database needs; Git history already retains removed drafts and prototypes.

Pinned Knip checks unused files, exports, dependencies and unresolved imports in `npm run verify`. Its entrypoints must correspond to real service, client, operator, test or quality-check workflows. Do not make every source file an entrypoint or hide findings with broad exclusions. New exceptions need a narrow reason and review. Source checks also reject retired framework packages/directories and tracked runtime caches/logs.

Before publishing changes, use the [release checklist](docs/open-source-readiness.md) to reconcile installation, privacy, support, API, version and service claims.
