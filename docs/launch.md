# Launch gates and distribution

## Boundary

Current authorization covers private GitHub source/CI and owner-private Sites registration, source push, and saved version only. No deployments, public repository, public service, social posts, outreach, directory submission, or automatic marketing are authorized. Private deployment also requires the next authorization.

## Gates for a separately authorized hosted pilot

- Confirm Sites can expose these routes and MCP tools to the intended users, with the platform's upstream private/OAuth access enforced. Test an actual tool call; locally listing tools is insufficient. Verify how reporting credentials coexist with platform authorization.
- Verify actual ingress/request/error/security logging, Authorization redaction, MCP argument/transcript handling, and D1 backup retention. Disable optional invocation/tracing logs and record provider-retained metadata. Reject this host if the intended privacy promise cannot be met.
- Provision a real D1 binding through Sites, apply the immutable migration, and verify atomic quotas under hosted concurrent requests. The placeholder ID is for local tooling only.
- Verify Sites supports scheduled cleanup. Wire the scheduled handler at a documented cadence, observe deletion after capability expiry, and then define the maximum physical-retention delay. If not supported, solve retention before enabling ingestion; do not rely on filtered aggregates to claim deletion.
- Verify request/read/write quotas and hard spend controls, including rejected traffic, checks, MCP initialization, cleanup, indexes, logs, and backups. Global D1 write budget does not cap Worker traffic cost. Choose a tested disable/shutdown mechanism. No paid plan or paid service upgrade is preapproved.
- Review the installed-client smoke and actual pilot capture surface. Confirm hook trust/opt-in remains explicit. No broad ChatGPT automatic-capture claim.
- Review the exact candidate SHA, privacy wording, and disabled-by-default flag. After private hosted tests, obtain authorization for public GitHub, public Sites access, and enabling reporting.

## One launch effort

Before exposure, provide a copy/paste installation path and make the MIT source public under separate approval. Prepare a short synthetic demo that visibly labels simulated evidence. Send one announcement to an existing relevant audience, plus personal invitations to 2–3 acquaintances with broader reach, asking for an introduction or one share if useful. One optional follow-up in the first week. No continual promotion, paid acquisition, or automated outreach.

Aim for 5–10 consenting testers who already use agents for GitHub work and 1–2 integration maintainers. This is an initial usability target, not a count claimed by the service. Friends can help recruit people who are likely to encounter the problem; they cannot manufacture trustworthy outage evidence.

Review at day 30 regardless of participation. Ask for voluntary examples of changed decisions, prevented unnecessary debugging, installation friction, and privacy problems. Do not add user tracking just to evaluate adoption. Continue with concrete usefulness and manageable maintenance; otherwise disable ingestion and leave the source available. No indefinite token spend or ongoing campaign.

## Draft public post — do not send

I'm trying a small open-source experiment called Agent Signal. When an agent's GitHub HTTPS push gets a server error, it can share a tiny category-only report and immediately see recent matching unresolved reports. The agent keeps its own retry and permission rules.

It doesn't collect repository URLs or command output, and its anonymous counts aren't proof of an outage. I'm looking for a few people who already do GitHub work with agents to try the opt-in integration and tell me whether it saves them time. Free, MIT licensed, no advertising. [Verified installation link] [Public source link]

## Draft personal invitation — do not send

I've built a small open-source resource for agents: a GitHub push server error can be compared with recent matching reports from other agents, without uploading logs or repository details. I'm running one bounded experiment to see whether it actually helps. If this sounds useful to people you know, would you introduce me to a couple of potential testers or share the launch post once? No ongoing promotion needed. [Verified demo/installation link]

Before sending, replace placeholders and update claims to the hosted evidence. No upstream provider reporting in this version; that requires a separate privacy-reviewed process and explicit authorization.
