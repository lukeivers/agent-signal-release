# Install Agent Signal for local Codex

After setup, Codex can automatically share a minimal report when a supported GitHub HTTPS push fails with HTTP 502, 503 or 504, then see how many other matching reports are outstanding. Successful matching pushes can report recovery.

This is an early, opt-in pilot. It works through a **local Codex hook**, installed once for all your local projects or only for a specific project. There is no directory-listed plugin yet, and these steps do not enable automatic reporting in ChatGPT web, cloud sessions, Claude Code or other agents.

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
git clone --branch v0.1.0-pilot.4 --depth 1 https://github.com/lukeivers/agent-signal-release.git
cd agent-signal-release
npm ci --prefix clients/codex --ignore-scripts
```

Git may mention a detached HEAD; that is expected for a pinned release. This installs the small hook dependency tree. You do not need the service's development dependencies. Keep this folder in place: the hook will refer to it by its full path.

Already have an Agent Signal installation? Use the [update instructions](codex-hook.md#update-an-existing-installation) instead of cloning over it.

## 2. Choose all projects or one project

Choose one scope. Both use the same reviewed hook; all-projects installation opts every local project using your user configuration into supported reporting.

### All projects for your user

For a new installation, run from the Agent Signal checkout:

```sh
node scripts/install-codex-hook.mjs --user
```

The installer should print `Prepared: …/hooks.json` at your user configuration location: `~/.codex` by default, or the directory selected by `CODEX_HOME` in that terminal. Use the same configuration location as your Codex sessions. It preserves other user hooks and backs up any existing file. This applies to current and future local projects using that user configuration, not other users, computers or cloud sessions.

Already installed per project? Use the [confirmed transition](#switch-from-project-hooks-to-all-projects) below instead. Codex [runs matching hooks from all sources](https://learn.chatgpt.com/docs/hooks); a user hook does not replace project hooks. Keep just one Agent Signal observer active per session.

### One specific project

Set `PROJECT` to the full path of the existing project where you use Codex. Replace the example between the quotes; keep the quotes if the path contains spaces.

```sh
PROJECT="/absolute/path/to/your/project"
node scripts/install-codex-hook.mjs "$PROJECT"
```

For example, if your project is in `~/Projects/my-app`, use `PROJECT="$HOME/Projects/my-app"`.

The installer should print `Prepared: …/.codex/hooks.json`, referring to the chosen project. It preserves other project hooks and backs up any existing file.

For either scope, **reporting is not enabled by installation alone.** The installer tells you to review the hook. Do not commit the generated hook file or backup: they contain local paths.

## 3. Review and enable it in Codex

Open or restart a local Codex session: any project for all-projects setup, or the chosen project for single-project setup. Enter `/hooks`, find the user or project hook under `PostToolUse` with matcher `Bash`, and review its source and command. It should point to this checkout's `clients/codex/hook.mjs` and the public Agent Signal endpoint.

Trust that hook only if you want the selected scope to report. If `/hooks` is unavailable or the entry does not appear, stop and follow [troubleshooting](#troubleshooting). Do not bypass hook trust.

## 4. Know what to expect

When a supported push fails, the hook can add context for the agent beginning:

> Agent Signal unverified matching reports in the last ten minutes: …

Ordinary successful commands stay quiet. The hook recognizes plain `git push` commands with a specific GitHub HTTPS server error. SSH pushes, permission errors, compound commands such as `cd project && git push`, and redirects such as `git push 2>&1` are skipped. No matching error means no failure report; silence is not proof that reporting worked.

Do not deliberately break a push or send fabricated reports to the public pilot to test setup. You can confirm the hook is visible and trusted; that establishes configuration, not successful delivery during a real failure. The service is best effort, and unavailable reporting should not block your task.

## Troubleshooting

| What you see                                   | What to do                                                                                                                                                                                                                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node` or `git` is missing, or Node is too old | Install or update the missing tool, then restart your terminal and repeat the version check.                                                                                                                                                                                            |
| `Installation stopped`                         | Check that the target home/project directory exists and that step 1 completed. Existing malformed or symlinked hook configurations are refused. See the [hook reference](codex-hook.md#installation-details).                                                                           |
| An Agent Signal hook already exists            | Follow the [update instructions](codex-hook.md#update-an-existing-installation); do not add a second observer.                                                                                                                                                                          |
| No Agent Signal entry in `/hooks`              | Check the user/project source path. For project setup, open the same project locally and confirm its project configuration is trusted. Restart the session if needed. Your client or managed settings may not permit local hooks; [ask for help](../SUPPORT.md) with sanitized details. |
| The hook is trusted but stays quiet            | Normal commands, unsupported pushes and unavailable reporting are quiet. Check the limitations above; do not infer success or an outage from silence.                                                                                                                                   |

## Switch from project hooks to all projects

First update the checkout to this release using the [update instructions](codex-hook.md#update-an-existing-installation). Close affected Codex sessions while changing configuration. From the Agent Signal checkout, specify the folders containing your projects:

```sh
node scripts/install-codex-hook.mjs --user --scan "$HOME/Projects"
```

You can supply several folders after `--scan`. The script scans only those folders, lists each matching project hook's exact file and entry, and previews the user-wide hook it will prepare. It uses the same removal logic as uninstallation. **Nothing changes until you type `APPLY` in the interactive terminal.** Enter cancels; piped input only shows the preview. Review every path, command and backup location first.

The scan skips symlinked directories, `.git` and `node_modules`, and stops at 10,000 directories. It inspects `.codex/hooks.json`, not inline TOML or plugin hooks. Unreadable, malformed or symlinked configurations stop the transition. Modified/unrecognized Agent Signal-like hooks require manual review. A scan cannot establish that no copies exist outside its scope: check `/hooks` for remaining observers before enabling the user hook.

After applying, restart Codex and review the user hook under `/hooks`. Unrelated hooks are kept and edited files get exact backups. Each replacement is atomic, but several files are not one transaction: on failure, inspect the previewed files and backups before retrying.

## Turn it off or remove it

Disable the Agent Signal hook in `/hooks` to stop it immediately. Close affected sessions, then run the appropriate command from the Agent Signal checkout:

```sh
node scripts/uninstall-codex-hook.mjs --user
```

For a single project:

```sh
node scripts/uninstall-codex-hook.mjs "/absolute/path/to/your/project"
```

To find and remove project installations under specified folders:

```sh
node scripts/uninstall-codex-hook.mjs --scan "$HOME/Projects"
```

Each command previews exact matching entries and backup locations, then requires interactive `APPLY`. Modified/unrecognized hooks are reported and left alone. The scripts preserve unrelated hooks, configuration files, old backups, the checkout and local state; they do not revoke stored Codex hook trust. A project removal does not stop a user hook. Restart sessions afterward so they reload configuration.

Once no hook uses this checkout, you may delete it. State cleanup and restoration details are in the [hook reference](codex-hook.md#removal-and-backups). Never post uninstall previews or backups in public issues; they contain local paths and may contain private configuration.

For manual checks or another integration, see the [API reference](api.md). Connecting MCP gives an agent explicit tools; it does not install an automatic observer.
