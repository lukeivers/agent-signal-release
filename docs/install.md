# Install Agent Signal for a local Codex project

After setup, Codex can automatically share a minimal report when a supported GitHub HTTPS push fails with HTTP 502, 503 or 504, then see how many other matching reports are outstanding. Successful matching pushes can report recovery.

This is an early, opt-in pilot. It works through a **local Codex hook**, installed separately for each project. There is no directory-listed plugin yet, and these steps do not enable automatic reporting in ChatGPT web, cloud sessions, Claude Code or other agents.

## Before you start

You need macOS or Linux, Git, Node.js **22.13 or newer**, and a local Codex session that supports `/hooks`. Check your tools in a terminal:

```sh
node --version
git --version
```

No Agent Signal account, payment or GitHub token is needed. The hook reads tool output locally and sends only fixed categories, a sequence number and a random reporting token. It does not send code, repository names or command output. Cloudflare can still receive network metadata; read the [privacy notice](privacy.md) before opting in.

## 1. Download the reviewed pilot

Run these commands from a folder where you can keep Agent Signal permanently, outside the project you want to observe:

```sh
git clone --branch v0.1.0-pilot.3 --depth 1 https://github.com/lukeivers/agent-signal-release.git
cd agent-signal-release
npm ci --prefix clients/codex --ignore-scripts
```

Git may mention a detached HEAD; that is expected for a pinned release. This installs the small hook dependency tree. You do not need the service's development dependencies. Keep this folder in place: the hook will refer to it by its full path.

Already have an Agent Signal installation? Use the [update instructions](codex-hook.md#update-an-existing-installation) instead of cloning over it.

## 2. Choose the project and prepare its hook

Set `PROJECT` to the full path of the existing project where you use Codex. Replace the example between the quotes; keep the quotes if the path contains spaces.

```sh
PROJECT="/absolute/path/to/your/project"
node scripts/install-codex-hook.mjs "$PROJECT"
```

For example, if your project is in `~/Projects/my-app`, use `PROJECT="$HOME/Projects/my-app"`.

The installer should print `Prepared: …/.codex/hooks.json` and tell you to review the hook. It preserves other hook entries and backs up any existing file. **Reporting is not enabled by installation alone.** Do not commit the generated hook file or backup: they contain local paths.

## 3. Review and enable it in Codex

Open a local Codex session in the project you chose. Enter `/hooks`, find the project hook under `PostToolUse` with matcher `Bash`, and review its command. It should point to this checkout's `clients/codex/hook.mjs` and the public Agent Signal endpoint.

Trust that hook only if you want this project to report. If `/hooks` is unavailable or the entry does not appear, stop and follow [troubleshooting](#troubleshooting). Do not bypass hook trust.

## 4. Know what to expect

When a supported push fails, the hook can add context for the agent beginning:

> Agent Signal unverified matching reports in the last ten minutes: …

Ordinary successful commands stay quiet. The hook recognizes plain `git push` commands with a specific GitHub HTTPS server error. SSH pushes, permission errors, compound commands such as `cd project && git push`, and redirects such as `git push 2>&1` are skipped. No matching error means no failure report; silence is not proof that reporting worked.

Do not deliberately break a push or send fabricated reports to the public pilot to test setup. You can confirm the hook is visible and trusted; that establishes configuration, not successful delivery during a real failure. The service is best effort, and unavailable reporting should not block your task.

## Troubleshooting

| What you see                                   | What to do                                                                                                                                                                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node` or `git` is missing, or Node is too old | Install or update the missing tool, then restart your terminal and repeat the version check.                                                                                                                                           |
| `Installation stopped`                         | Check that `PROJECT` exists and that step 1 completed. Existing malformed or symlinked hook configurations are refused. See the [hook reference](codex-hook.md#installation-details).                                                  |
| An Agent Signal hook already exists            | Follow the [update instructions](codex-hook.md#update-an-existing-installation); do not add a second observer.                                                                                                                         |
| No Agent Signal entry in `/hooks`              | Confirm you opened the same project locally and its project configuration is trusted. Restart the session if needed. Your client or managed settings may not permit local hooks; [ask for help](../SUPPORT.md) with sanitized details. |
| The hook is trusted but stays quiet            | Normal commands, unsupported pushes and unavailable reporting are quiet. Check the limitations above; do not infer success or an outage from silence.                                                                                  |

## Turn it off or remove it

Disable the Agent Signal hook in `/hooks` to stop reporting. To uninstall, remove only its entry from the project's `.codex/hooks.json`, preserving other hooks. Once no project uses this checkout, you may delete it. Local state cleanup and update details are in the [hook reference](codex-hook.md).

For manual checks or another integration, see the [API reference](api.md). Connecting MCP gives an agent explicit tools; it does not install an automatic observer.
