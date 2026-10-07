# Converged implementation plan

Reviewed through two resumed adversarial rounds with GPT-6 Astra at medium effort on 2026-10-07. Further code review follows implementation. Private GitHub and undeployed owner-private Sites preparation are authorized. Deployment of any audience, public GitHub visibility, outreach, social posts, and directory submission remain outside this task.

## First useful artifact

Agent A gets a GitHub HTTPS push 503. Its explicitly enabled local hook classifies the error without sending command output. The service atomically upserts A's observation and returns the number of matching unexpired reports, including how many come from other reporter capabilities. If B has the same category, both agents can recognize shared evidence immediately rather than wait for a human status report. A's later successful push closes its observation; B remains outstanding. The service supplies observations, never advice.

Initial exact cohort: `github / git_push / git_https / local_agent|hosted_agent|unknown / http_502|http_503|http_504`. Start with local Codex as the verified capture surface. An MCP tool provides manual agent access; installing a skill alone is not automatic capture. Do not imply all ChatGPT surfaces can run local hooks.

## Acceptance contracts

1. One active observation per capability/cohort. Failure/recovery sequences increase. Equal sequence and state are idempotent without refreshing time; stale or conflicting sequences are rejected. Ten-minute expiry removes counts but never becomes recovery. Keep watermarks until capability expiry.
2. Locally generated 256-bit bearer capability, rotated within 22 hours, expires at its encoded hour plus 24 hours. Server stores its SHA-256 pseudonym and expiry, never the token. Anonymous reporters can forge identities; counts cannot establish independent people or root cause.
3. Project accepted enum/sequence fields before persistence. Invalid known fields get fixed generic errors. Extra details are actively discarded. Bounded bodies, no query parameters, no application request/error logging, no raw upstream output. Host logs and backups require separate verification.
4. Cap anonymous writes with atomic daily and reporter-hour quotas and early isolate admission control. These protect application state, not a guaranteed platform bill. Traffic/read quotas and abuse shutdown are launch gates. Default reporting disabled.
5. Separate synthetic adapter tests, actual installed-client hook smoke, local built Worker/D1 checks, and future hosted/user evidence. Do not silently substitute a replay for a runtime-hook smoke.
6. Use Sites managed storage/source/version support; save without deployment. Preserve portable core and source-ready MIT release. Do not change hosts automatically if hosting gates fail.

## Execution order

Private scaffold and repository → core/API/MCP/client → invariant and privacy tests → built Worker/D1 and actual hook smoke → resumed adversarial code review/fixes → private CI and protections → exact source push plus saved undeployed Sites version → stop and report launch gates.

## Bounded public experiment, after separate authorization

One coordinated announcement, one optional reminder, and personal introductions to 2–3 acquaintances with broader reach. Aim for 5–10 consenting testers plus 1–2 willing maintainers who can integrate the hook. Prepare copy and installation now, send nothing now. No paid spend, continual posting, covert per-user usage tracking, or scheduled agent marketing.

Hold a human review 30 days after launch regardless of recruitment success. Continue only with voluntary evidence of actual use/benefit and acceptable maintenance. If evidence is weak, leave useful open source, disable hosted ingestion, and archive the experiment. Synthetic testing does not count as community benefit.
