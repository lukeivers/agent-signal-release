# Privacy notice

Agent Signal is an opt-in experimental service operated by Luke Ivers on Cloudflare Workers and D1 Free. The local hook reads command output to recognize supported failures, but sends minimal reports rather than code, repository names or command output. The service discards unexpected JSON fields before storing an observation.

**This is not a promise of end-to-end anonymity.** Cloudflare can receive network metadata and retain database recovery history. An MCP client can expose reporting tokens in its transcript. Do not send identifying details just because the application discards extra fields.

## What a report contains

A report carries fixed categories (`github`, `git_push`, `git_https`, environment and HTTP error), an increasing sequence number and a locally generated random reporter token. REST sends that token in Authorization; manual MCP sends it as a tool argument. It is a pseudonymous bearer capability for reporting, not an account credential.

Application storage contains a SHA-256 hash of the token, the exact cohort, sequence, failure/recovery state, server timestamps, prior-failure flag and bounded budget counters. The service does not store raw outputs, command text, repository/account identifiers, names, email addresses, IPs or request headers in its application tables. Invalid requests and exceptions receive fixed errors; application code does not log raw requests or diagnostics. Worker observability is configured off.

These protections apply to the application. They cannot remove private information received by hosting ingress, security systems or client transcripts. Never place private details in request URLs, known category fields, headers or extra JSON fields.

## What stays on your computer

The hook sees tool output in memory. Its private state directory stores a hash of the session ID for filenames, a random rotating token, sequence/cooldown data and keyed hashes of destinations used to match recovery. It does not save original session/repository identifiers or output. Directories must be private (0700); files are created with 0600 permissions. Local state files are not uploaded; the token and sequence are included in reports.

The hook uses the same token during a local session and rotates it after 22 hours of use. Local state remains sensitive and can include temporary files from interrupted writes. Stop every hook using it before deleting the directory; see the [hook reference](codex-hook.md#request-timing-and-local-state). Local deletion does not erase previously submitted service records.

## Counts and retention

Reports affect matching counts for ten minutes after their latest accepted observation. Expiry from a count is not recovery or physical deletion. Ordering watermarks remain until token expiry to prevent delayed retries from reopening old reports. Tokens expire 24 hours after their encoded issue hour; budget rows have separate expiries and global daily-budget metadata can remain up to two additional days.

Cleanup is scheduled every five minutes, including when reporting is disabled. A historical hosted synthetic check observed expired rows deleted while an unexpired comparison remained. **A maximum physical-deletion delay has not been verified.** Execution failures or provider scheduling can delay cleanup; no guaranteed 24-hour erasure claim is made.

Cloudflare separately documents [D1 Time Travel recovery history](https://developers.cloudflare.com/d1/reference/time-travel/): seven days on Free and 30 days on paid plans. Deleting live rows does not establish deletion of backups. Ingress/security logs and provider-retained metadata are separate from application projection; their end-to-end retention has not been established by this project.

## Manual MCP reporting

MCP mutation tools accept the token as an argument, so the client/model transcript and tool logs may retain it. Consent to that exposure before reporting manually. Generate a fresh random token with `node clients/codex/new-capability.mjs /absolute/private/token-file`; the file is created exclusively with private permissions and the token is not printed. Rotate within 22 hours and restart sequences on rotation. Let an agent read the file only after consent; do not derive tokens from identity or reuse them across users. Prefer the local REST hook if transcript exposure is unacceptable.

Connecting MCP does not install a hook or enable automatic observation. Do not manually report the same event already handled by the hook.

## Service limits and concerns

Counts are unverified and may be forged or duplicated. There is no account linkage or device fingerprinting to establish unique people or independent failures. Shared egress can explain correlated symptoms. Reports establish reported symptom scope, not provider fault or a confirmed outage.

Hosting limits, abuse or maintenance can make the pilot unavailable, and reporting may be stopped. There is no uptime or support-response guarantee. Use [private security reporting](../SECURITY.md) for a privacy vulnerability and [support](../SUPPORT.md) for ordinary problems; never post tokens or private diagnostics in public issues.
