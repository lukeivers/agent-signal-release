# Install Agent Signal for local Claude Code

Agent Signal can report supported GitHub HTTPS push HTTP 502/503/504 errors and matching recovery from Claude Code. This is an opt-in local hook for macOS/Linux, not a Claude chat integration or marketplace plugin. Counts are unverified reports, not confirmed outages.

## 1. Download the reviewed release

You need Git, Node.js 22.13+ and local Claude Code with `/hooks`. This integration was rehearsed with Claude Code 2.1.294; other versions and managed policies can affect hook availability. Check `node --version`, `git --version` and `claude --version` first.

Keep the checkout outside the project you want to observe:

```sh
git clone --branch v0.1.0-pilot.6 --depth 1 https://github.com/lukeivers/agent-signal-release.git
cd agent-signal-release
npm ci --prefix clients/codex --ignore-scripts
```

The dependency command is intentional: both clients share the runtime and its locked dependencies in `clients/codex`. Keep this checkout in place; generated commands refer to its absolute path. No Agent Signal account, payment or GitHub token is needed. Read [privacy](privacy.md) before opting in. Do not upload generated settings, backups or local state.

## 2. Choose all projects or one project

Running either installer opts the chosen scope into reporting when Claude loads these settings. Claude can run configured hooks automatically in a trusted session; `/hooks` lets you inspect them and is not a guaranteed separate enable step. Its workspace trust and managed policy still apply.

### All projects for your user

For a new installation, run from the Agent Signal checkout:

```sh
node scripts/install-claude-code-hook.mjs --user
```

Expect `Prepared: …/settings.json` at `~/.claude/settings.json`, or inside the `CLAUDE_CONFIG_DIR` selected in that terminal. Use the same configuration directory as your Claude sessions. This opts current and future local projects using that user configuration into supported reporting. It does not apply to other computers, users or cloud sessions.

Already installed in projects? Use the [confirmed transition](#switch-project-installations-to-all-projects) below. User and project hooks are additive; keep one Agent Signal observer per session.

### One project

Use the full path of your existing project:

```sh
node scripts/install-claude-code-hook.mjs "/absolute/path/to/your/project"
```

Expect `Prepared: …/.claude/settings.local.json`. Project installation uses the local settings file because the hook command contains paths specific to your machine. Existing settings and unrelated hooks are preserved, with exact backups beside edited files. Do not commit the generated file or its backups. If Git does not already ignore them, add their paths to your project's ignore rules before committing; this installer does not change ignore rules.

The installer refuses Agent Signal copies in the same directory's other settings file. It cannot discover every hook in another scope or plugin; check `/hooks` yourself before enabling reporting.

## 3. Review the two hooks

Open or restart Claude Code in a trusted project using the selected configuration. Enter `/hooks` and inspect the `Bash` hooks under **both `PostToolUseFailure` and `PostToolUse`**. Their commands should point to this checkout's `clients/claude-code/hook.mjs` and the public Agent Signal endpoint. Review and accept any hook/workspace prompts only if you want this reporting scope. The installer does not bypass Claude's permissions or managed policy.

The first hook handles a failed command; the second handles recovery. Ordinary commands and successful pushes with no locally pending report remain quiet. Supported commands begin with plain `git push`; SSH, authentication failures, compound commands such as `cd project && git push`, shell redirects, interrupted commands and recognized dry-run flags are skipped. Recovery requires a matching GitHub destination and a successful ref-update line; “Everything up-to-date” alone does not close a report.

A matching acknowledged report can add context beginning “Agent Signal unverified matching reports in the last ten minutes”. A visible hook establishes configuration, not delivery. Do not create fake reports or deliberately fail a real push to test the public service. If reporting fails, the hook stays quiet and the original task continues.

## Switch project installations to all projects

Close affected Claude sessions. From the Agent Signal checkout, supply only the folders you want inspected:

```sh
node scripts/install-claude-code-hook.mjs --user --scan "$HOME/Projects"
```

Several roots may follow `--scan`. The script inspects both `.claude/settings.json` and `.claude/settings.local.json` under those roots, lists exact hook removals and backups, and previews the two user hooks. **No files change until you type `APPLY` in the interactive terminal.** Enter cancels; piped input only previews. Modified/unrecognized Agent Signal hooks stop the transition for manual review.

Scans skip symlinked directories, `.git`, `node_modules`, `.codex` and `.claude` while descending, and stop at 10,000 visited directories. They inspect each project's `.claude` files explicitly, without descending into those configuration directories. Copies outside supplied roots, plugin hooks and managed settings are outside the scan. Malformed, unreadable or symlinked configurations stop inspection. Check `/hooks` for remaining observers afterward.

Edits preserve unrelated settings and use exact backups and atomic file replacement. Multiple files are not one transaction; after an I/O failure, inspect every listed file and backup before retrying. Restart Claude and review the user hooks after applying.

Transition backups can contain private settings and local paths, including copies beside shared `settings.json` files. Keep them out of commits and public issue reports.

## Disable or uninstall

Disable the Agent Signal entries in `/hooks` where available and close affected sessions before changing their configuration. From the Agent Signal checkout:

```sh
node scripts/uninstall-claude-code-hook.mjs --user
```

For one project:

```sh
node scripts/uninstall-claude-code-hook.mjs "/absolute/path/to/your/project"
```

To scan specified project folders, including folders outside your usual defaults:

```sh
node scripts/uninstall-claude-code-hook.mjs --scan "$HOME/Projects" "/another/project/folder"
```

Each command lists exact entries and backup locations before requiring interactive `APPLY`. Both generated event hooks are removed; modified/unrecognized copies remain for manual review. User removal inspects both settings files in the selected user directory; project removal inspects both files in that project's `.claude` directory. Removing a project hook does not stop a user hook. Restart sessions afterward.

Recognition matches the installer's command shape, not cryptographic proof of origin. Review every previewed command and path before confirming removal.

The scripts keep unrelated settings, configuration files, old backups, checkout files and local state. Once no hook uses the checkout, you may remove it. State defaults to `~/.local/state/agent-signal`; stop **both Codex and Claude Code hooks** using it before deleting that shared directory. Local deletion does not erase service records or provider backups.

Review project ignore rules for any new backup files before committing. Uninstall previews and backups may contain private settings and local paths; do not post them in public issues.

## Update and troubleshoot

To update, disable the hooks, close affected sessions, review the [release notes](https://github.com/lukeivers/agent-signal-release/releases), fetch tags and check out the reviewed tag. Stop if Git reports local changes; preserve them. Rerun `npm ci --prefix clients/codex --ignore-scripts`. If the Node executable, checkout path or hook command changed, uninstall the old entries with confirmation and reinstall at the same scope. Otherwise reinstalling should say `Already installed`. Review `/hooks` and restart before reporting. Updating checkout files changes what an existing hook executes even if its command text stays the same.

If installation stops, check dependencies, paths and malformed/symlinked settings. A partial or modified Agent Signal installation needs review rather than a second copy. If `/hooks` has no entries, check the config directory, selected project and managed policy, then restart. Quiet operation alone does not indicate a fault or successful delivery. Use [support](../SUPPORT.md) with sanitized version and step information, never settings or private logs.

The same [request deadline, cooldown and retention boundaries](codex-hook.md#request-timing-and-local-state) apply to both clients. Each client gets separate random capabilities even if session IDs coincide; running both clients does not establish independent people. See [Anthropic's hook reference](https://code.claude.com/docs/en/hooks) for settings layers and hook behavior.
