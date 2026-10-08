# Release checklist

Use this checklist for a concrete candidate, not as a claim that the project is certified or production-ready. [Current verification](verification.md) distinguishes local checks from dated hosted evidence.

## Review the source and documentation together

- Trace each source/tooling entrypoint to a supported service, client, operator, test or quality-check workflow. Remove obsolete implementations, dependencies, configuration, comments, examples and active instructions. Keep the immutable D1 SQL migration that the running database requires.
- Inspect the tracked inventory and staged diff. Keep caches, logs, hook backups, local paths, deployment configuration and credentials out of source. Secret scanning cannot identify every private value; review fixtures and history as well.
- Reconcile the README, install guide, hook/API reference, privacy, support, security policy and changelog with the exact candidate. Check local links and heading anchors. Run installation in a disposable project, including a path with spaces. Describe the expected result and distinguish configuration from successful reporting.
- Keep the local-hook installation and directory-plugin story separate. A future listed package must not depend on bundled lifecycle hooks under the current [OpenAI submission rules](https://developers.openai.com/plugins/deploy/submission). Directory approval and compatibility are separate work; do not imply they exist.

## Verify the candidate

Run the [documented local checks](verification.md), both dependency audits and required hosted CI/CodeQL. Resolve concrete security/privacy defects before release. Advisory exceptions must be exact, justified, reviewed and unexpired; the current register is empty. Do not suppress new findings or broaden baselines to make a release pass.

Lint, formatting, duplication, unused-code checks and tests are evidence of their respective scope. They do not prove usefulness, absence of every defect or end-to-end anonymity. Keep license/provenance notices accurate for both the development and hook dependency trees. No certification badge or unsupported performance claim is warranted.

## Publish a reviewed release

1. Obtain maintainer authorization for the candidate and intended external actions. Merging source, creating a release, deploying the service, submitting a plugin and sending announcements are distinct actions.
2. Update the changelog and installation tag together in the candidate, then merge the green candidate and record its full commit SHA. Tag the exact reviewed commit and verify that tag resolves to it before creating the prerelease. Preserve existing published tags; corrections get a new version.
3. Write release notes explaining what changed for users, whether an installed hook needs updating/review, and whether the hosted service changed. Link to the current readable install guide and the version-pinned source. A documentation-only update need not deploy the Worker.
4. If deployment is approved, follow [hosting](hosting.md): deploy a clean tagged checkout, preserve the existing endpoint/database/reporting flags/epoch during maintenance unless a change is explicitly approved, record the Worker version, run bounded read checks and log out. Never assume a failed command implies nothing happened; inspect active state before retrying.
5. Confirm public links, issue/support routes and private security reporting work before inviting users. Keep account access protected and use available free repository security features; no paid upgrades or account-setting changes are implied by this checklist.

The source on `main` may be newer than the deployed tag. Keep dated hosted evidence and release notes explicit about that difference. Do not describe local or synthetic checks as a real-outage success story.

## Communicate once, then evaluate

Use the [distribution plan](launch.md) for a brief invitation and bounded pilot feedback. No automated outreach, recurring promotion or ongoing agent monitoring is installed. Maintainer support and review remain best effort.

## Basis

- [Diátaxis: task-focused how-to guides](https://www.diataxis.fr/how-to-guides/)
- [Google: procedures and expected results](https://developers.google.com/style/procedures)
- [GitHub: releases and tags](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
- [GitHub: contributor guidelines](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors)
- [OpenSSF: project security baseline](https://baseline.openssf.org/versions/2026-08-28)
- [Open Source Guides: maintainer expectations](https://opensource.guide/best-practices/)
