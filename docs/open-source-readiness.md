# Open-source release preparation

This is a small experimental project, not an OpenSSF-certified product. Preparation follows GitHub's repository/security guidance and relevant OpenSSF baseline controls, proportionate to one maintainer and a bounded pilot.

## In source

- MIT license, third-party provenance and retained upstream notice.
- README, API/count semantics, opt-in install/uninstall, local build/test guide and privacy limitations.
- Contribution process, respectful participation expectations, sanitized issue forms and PR template.
- Repository-local DevKit engines, explicit coverage rules, reviewed narrow baseline, zero-warning lint, shell and skipped-test gates, type checking including tests, behavioral tests and secret scanning.
- Read-only CI, pinned Actions and no persisted checkout credential or deployment permission. Monthly bounded dependency update proposals; no auto-merge.
- Unreleased changelog, current-source support policy and best-effort maintenance expectations.

## Before publication or ingestion

1. Verify the exact candidate's required CI and current dependency audit. Resolve applicable high/critical vulnerabilities; document any remaining findings with affected versions, reachability and review trigger. Do not use a blanket audit suppression.
2. Confirm repository privacy remains private until explicit publication approval. Publish only the sanitized private release repository, keeping the original repository with historical pull-request references private. Use the owner's GitHub noreply author address for new commits. Review commit history for secrets/private fixtures; scanning cannot identify every sensitive value. Do not rewrite history merely to hide a finding; rotate any actual exposed secret.
3. At authorized publication, enable and verify private vulnerability reporting, Dependabot alerts/security updates, secret scanning/push protection and available code scanning without purchasing upgrades. Private vulnerability reporting is a public-repository feature; do not imply it works today.
4. Confirm an accessible private community/security contact before inviting contributors. Keep support expectations modest. Review account MFA and access permissions; no account-settings change is performed by this source preparation.
5. Test the published install links and actual intended client surface. Code-source availability is not hosted service availability; avoid automatic ChatGPT-wide capture claims.
6. Complete the separate hosted access, logging/backups, deletion scheduling, resource/spend and shutdown gates in [launch](launch.md) before enabling reports. Choose a version/tag and preserve the exact tested source/archive identity.
7. Publish only the approved announcement and bounded invitations. No badges implying certification, unsupported popularity/performance claims, package registry publication or paid services are part of this preparation.

## References

- [GitHub repository best practices](https://docs.github.com/en/repositories/creating-and-managing-repositories/best-practices-for-repositories)
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [Private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository)
- [OpenSSF OSPS baseline 2026.02.19](https://baseline.openssf.org/versions/2026-02-19)

## Dependency review — 2026-10-07

Compatible updates replace the originally vulnerable Next.js/React server-component and build-tool versions. A scoped Satori override moves fflate from 0.7.3 to the patched 0.7.5; the existing Miniflare sharp override moves to 0.35.5. The locked installation and application build must pass after updates.

Two underlying advisories remain, with exact package versions and paths recorded in `rules/dependency-audit-exceptions.json`, expiring on 2026-11-06. Their dependent packages also appear in raw npm audit totals; that does not represent additional independent flaws. The networked CI gate fails unknown advisories, changed package paths/versions, expired exceptions and audit unavailability. This is a reviewed audit, not a zero-vulnerability claim.

- [braces stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): upstream lists no patched version. The affected 3.0.3 package is used by build/lint glob tooling with repository-controlled patterns. It is not in the generated Worker bundle and report input does not reach it. An untrusted contribution could still disrupt its own CI run; CI has no persisted Git credential or deployment secret and has a 10-minute limit. Revisit on upstream patch or changed input/runtime usage.
- [nested esbuild development-server exposure](https://github.com/advisories/GHSA-67mh-4wv8-2f99): Drizzle's legacy configuration loader pins esbuild 0.18.20. Its use is transformation, not the affected serve API; it is not in the Worker bundle. Do not expose a development server from that nested dependency. Revisit on Drizzle/helper upgrades or any serving use.

No `npm audit fix --force`, forced downgrade or peer-dependency bypass is used. These scoped exceptions permit continued private preparation; recheck them and the full advisory inventory at public release.
