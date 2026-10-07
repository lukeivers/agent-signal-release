# Launch gates and distribution

## Boundary

Current authorization covers private GitHub source/CI, owner-private Sites synthetic deployment, and direct Cloudflare Free hosting, guarded synthetic testing and private source release preparation. Public source/service access, real reporting, social posts, outreach, directory submissions and paid activation remain separately authorized actions.

Before public source publication, complete [open-source release preparation](open-source-readiness.md).

## Launch review

- Verify the stable Cloudflare address serves both REST and MCP directly against Cloudflare D1, without a Sites access credential. Publish installation instructions using only that stable address. Review [cutover](cloudflare-cutover.md).
- Keep privacy claims limited to application projection/storage. Disclose provider ingress/security metadata, any optional Sites page traffic analytics, MCP capability transcript exposure, and backups rather than claiming those are absent.
- Distinguish the configured cleanup schedule from an observed physical-deletion deadline. An explicitly disclosed limitation can accompany a consented pilot; expiry is not deletion.
- Identify current application and hosting ceilings and test the disable mechanism. Confirm the account remains on Workers Free; quota exhaustion is accepted as temporary unavailability. A prepared migration has been superseded by direct Cloudflare hosting; no paid activation or automatic upgrade is preapproved.
- Confirm hook trust/opt-in and the actual supported client connection. No broad ChatGPT automatic-capture or independent-outage claim.
- Review the exact candidate SHA, updated wording and disabled-by-default flags. Then obtain authorization for public GitHub, public Sites page/stable API access, enabling reporting, and the exact one-time announcement/outreach.

Hosted concurrency, cleanup-delay and load evidence can improve the release assessment, but missing evidence must be stated honestly rather than turned into unsupported performance or privacy claims.

## One launch effort

Before exposure, provide a copy/paste installation path and make the MIT source public under separate approval. Prepare a short synthetic demo that visibly labels simulated evidence. Send one announcement to an existing relevant audience, plus personal invitations to 2–3 acquaintances with broader reach, asking for an introduction or one share if useful. One optional follow-up in the first week. No continual promotion, paid acquisition, or automated outreach.

Aim for 5–10 consenting testers who already use agents for GitHub work and 1–2 integration maintainers. This is an initial usability target, not a count claimed by the service. Friends can help recruit people who are likely to encounter the problem; they cannot manufacture trustworthy outage evidence.

Review at day 30 regardless of participation. Ask for voluntary examples of changed decisions, prevented unnecessary debugging, installation friction, and privacy problems. Do not add user tracking just to evaluate adoption. Continue with concrete usefulness and manageable maintenance; otherwise disable ingestion and leave the source available. No indefinite token spend or ongoing campaign.

## Draft public post — do not send

I'm trying a small open-source experiment called Agent Signal. When an agent's GitHub HTTPS push gets a server error, it can share a tiny category-only report and immediately see recent matching unresolved reports. The agent keeps its own retry and permission rules.

It doesn't collect repository URLs or command output, and its anonymous counts aren't proof of an outage. I'm looking for a few people who already do GitHub work with agents to try the opt-in integration and tell me whether it saves them time. Free, MIT licensed, no advertising. https://github.com/lukeivers/agent-signal-release/blob/main/docs/install.md

## Draft personal invitation — do not send

I've built a small open-source resource for agents: a GitHub push server error can be compared with recent matching reports from other agents, without uploading logs or repository details. I'm running one bounded experiment to see whether it actually helps. If this sounds useful to people you know, would you introduce me to a couple of potential testers or share the launch post once? No ongoing promotion needed. https://github.com/lukeivers/agent-signal-release/blob/main/docs/install.md

Before sending, verify publication and installation at the tagged release. No upstream provider reporting in this version; that requires a separate privacy-reviewed process and explicit authorization.

## Operator commands — approval required before opening

The prepared release is `v0.1.0-pilot.1`. Keep the original `lukeivers/agent-signal` repository private permanently; publish only the sanitized `lukeivers/agent-signal-release` repository. After explicit launch approval, reauthenticate Wrangler, verify Workers Free and no Worker secrets, publish this release repository, enable GitHub private vulnerability reporting and available free security checks, create the tag/release, then run:

```sh
node scripts/cloudflare.mjs pilot-open --approved
```

This retains the deployed address and database, opens reporting and begins a fresh ten-minute count window. Verify REST and MCP using a small synthetic canary, then remove that canary's exact observation and reporter-budget keys. Verify the public installation from the tag before announcing. Never publish ignored deployment configuration or credentials. Log Wrangler out after verification.

To stop ingestion without deleting source or moving the endpoint:

```sh
node scripts/cloudflare.mjs pilot-stop
```

The stop command keeps the public endpoint available but returns unavailable for reporting/checks; scheduled deletion continues. It requires deployment access, so reauthenticate if logged out. A failed deployment/verification requires inspecting active state before retrying. The per-isolate admission cap and application budgets do not constitute a global traffic or billing firewall. Stay on Free; do not enable paid hosting to keep the pilot alive.

Do not post either draft automatically. Choose one audience and up to three recipients with Luke before any sending. A day-30 review is a human checkpoint, not an installed recurring agent task.
