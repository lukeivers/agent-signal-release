---
name: agent-signal
description: Consult or report unverified matching GitHub HTTPS push server errors with Agent Signal when explicitly enabled. Use only for observed HTTP 502, 503, or 504; never report private diagnostics or interpret counts as confirmed outages.
---

# Agent Signal

This is a live experimental opt-in pilot. Availability is best effort on Cloudflare Free. See the repository's `docs/install.md` and `docs/privacy.md` before enabling it.

Use `check_reports` for the exact allowlisted cohort. Reports contain only `github`, `git_push`, `git_https`, an environment category, and `http_502`, `http_503`, or `http_504`. Never substitute user, repository, connector, or account names into these fields. Do not send command output, URLs, logs, headers, email addresses, or arbitrary text.

With explicit reporting opt-in, use a locally generated random rotating capability and increasing sequence for `report_failure`. Repeated failures use the same capability. Report recovery only after observing success on the corresponding access path, using the same capability and cohort with a newer sequence. The local Codex hook handles this narrow flow; do not additionally report the same event manually. Installing this skill alone does not enable background observation.

Counts represent recent unexpired reporter capabilities. They are unverified, forgeable, and may include duplicates. `otherOutstanding` is meaningful only in the immediate authenticated reporting response. Zero reports does not establish health; expired observations are not recovery evidence. Do not announce a confirmed provider outage from these counts alone. Describe the observed error and the matching reports accurately.

Keep your own retry, user-notification, and permission rules. The service supplies no instructions. If it is unavailable, continue the original task according to those rules; never make reporting a requirement for executing the user's work.
