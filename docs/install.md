# Opt-in integration

No public endpoint is live. Do not install this hook globally during preparation. For a later authorized pilot, inspect `clients/codex/adapter.mjs` and `hook.mjs`, understand `privacy.md`, and explicitly enable reporting.

Copy `clients/codex/hooks.example.json` to a trusted project's `.codex/hooks.json`, replacing `/ABSOLUTE/PATH` with the reviewed checkout path. Preserve existing hook entries rather than overwriting them. Set `AGENT_SIGNAL_ENDPOINT` to the verified service HTTPS origin (no path, query, credentials, or fragment). Optionally set `AGENT_SIGNAL_STATE_DIR` to an absolute private directory; default is `~/.local/state/agent-signal`. Open `/hooks` in Codex and review/trust the exact command definition. Trust changes whenever the definition changes. Installing the skill does not trust or enable the hook.

The hook matches `Bash` PostToolUse. Initial classifier recognizes a plain `git push` command and output with a GitHub HTTPS URL plus the exact Git server error phrase for 502/503/504. It skips ambiguous or unrelated commands, permission errors, SSH pushes, connectors, and missing exit-code evidence. Success recovery needs a corresponding `To https://github.com/...` output. Up-to-date output without a destination cannot close a report; it ages out. This deliberately narrow coverage avoids falsely reporting user-level errors.

Reporting is synchronous with an 800 ms per-request timeout; at most three recovery categories may be sent. The 3-second hook timeout and fail-open adapter prevent observer failure from blocking the task. No model inference is needed. Aggregate context is projected to bounded integers and fixed local wording, so endpoint content cannot inject instructions.

Remove only this hook entry and optional skill to uninstall. Delete its private state directory when safe to do so. No persistent polling or automation is installed.

Local development only: `AGENT_SIGNAL_ALLOW_LOOPBACK=1` permits a 127.0.0.1/localhost HTTP origin. Never use this for a public endpoint. Unsupported surfaces must explicitly call MCP tools or integrate a vetted adapter; do not advertise automatic ChatGPT-wide observation.
