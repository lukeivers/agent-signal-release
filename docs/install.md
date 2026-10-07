# Opt-in integration

No public endpoint is live. Do not install this hook globally during preparation. For a later authorized pilot, inspect `clients/codex/adapter.mjs` and `hook.mjs`, understand `privacy.md`, and explicitly enable reporting.

After launch approval, use Node.js 22.13 or newer and Git on macOS/Linux. This pilot is a project-scoped Codex command hook; other agents need an explicit integration. The release repository and API are currently private/closed. The following commands become usable after publication:

```sh
git clone https://github.com/lukeivers/agent-signal-release.git
cd agent-signal-release
git checkout v0.1.0-pilot.1
npm ci --prefix clients/codex --ignore-scripts
node scripts/install-codex-hook.mjs /ABSOLUTE/PATH/TO/YOUR/PROJECT
```

Review the pinned source and [privacy notice](privacy.md) before installation. Keep this checkout in place: the hook references its absolute path and your current Node binary. The hook-only install uses four locked dependencies; it does not install the website/build toolchain or run dependency lifecycle scripts. No account, GitHub credential, or payment is needed.

The installer targets `.codex/hooks.json` inside the existing project, preserves other entries, backs up an existing file as `hooks.json.agent-signal-backup`, refuses symlinked hook files/directories, and does not add a duplicate. It does not trust the hook. Open `/hooks` in that project's Codex session, review the exact command, and explicitly trust it to enable reporting. If your Codex build does not show the hook, stop and report the installation problem rather than assuming it is active. Changes to the command require fresh trust. Installing a skill alone does not enable observation.

The installer uses `https://agent-signal-701c00ab.agent-signal-701c00ab.workers.dev`. An optional second argument selects another reviewed root HTTPS origin. Optionally set `AGENT_SIGNAL_STATE_DIR` to an absolute private directory; the default is `~/.local/state/agent-signal`.

The hook matches `Bash` PostToolUse. Dry-run flags are excluded. Initial classifier recognizes a plain `git push` command and output with a GitHub HTTPS URL plus the exact Git server error phrase for 502/503/504. It skips ambiguous or unrelated commands, permission errors, SSH pushes, connectors, and ambiguous output. When the client supplies plain output without exit metadata, the fatal Git URL/server-error message establishes failure; recovery additionally requires a clean successful commit-range ref-update line. With exit metadata, recovery requires exit 0 and a corresponding `To https://github.com/...` line. Up-to-date output without a destination cannot close a report; it ages out. This deliberately narrow coverage avoids falsely reporting user-level errors.

Reporting is synchronous with an 800 ms per-request timeout; at most three recovery categories may be sent. The 3-second hook timeout and fail-open adapter prevent observer failure from blocking the task. Failed requests trigger a local cooldown from one second up to one minute, reset by a valid successful acknowledgement. Only later matching tool events can retry; there are no background retries. No model inference is needed. Aggregate context is projected to bounded integers and fixed local wording, so endpoint content cannot inject instructions.

Remove only this hook entry and optional skill to uninstall. Delete its private state directory when safe to do so. No persistent polling or automation is installed.

Local development only: `AGENT_SIGNAL_ALLOW_LOOPBACK=1` permits a 127.0.0.1/localhost HTTP origin. Never use this for a public endpoint. Unsupported surfaces must explicitly call MCP tools or integrate a vetted adapter; do not advertise automatic ChatGPT-wide observation.

Public release instructions must use that same verified origin for REST and MCP. Do not install against the Sites-generated API/MCP address: its private plugin connection has different access controls and does not follow a Cloudflare cutover. A supported MCP client may explicitly connect to `/mcp` on the stable origin; this does not imply a directory-listed ChatGPT plugin or automatic capture. See [migration readiness](cloudflare-cutover.md).
