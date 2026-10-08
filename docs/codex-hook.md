# Codex hook reference

For first-time setup, use [installation](install.md). This page describes the separately installed local hook, not a directory-listed plugin.

## Installation details

The installer writes `<target>/.codex/hooks.json`: use your home directory as the target for user-wide installation at `~/.codex/hooks.json`, or a project directory for project-only installation. The published pilot.3 installer supports both without a code update. It does not resolve a custom `CODEX_HOME`.

It preserves existing entries and atomically replaces the configuration. If that file already exists, it saves an exact backup beside it as `hooks.json.agent-signal-backup`, or a uniquely suffixed backup if that name is taken. It refuses malformed configurations, symlinked hook files/directories and a second Agent Signal observer in the target file. It leaves trust to the user.

The command pins the current Node executable and the checkout's absolute hook path. It quietly skips observation if either disappears; absent adapter dependencies also produce no hook output. Local paths appear in the hook configuration and backup, so keep them out of commits and issue reports. The installer is the supported configuration method; there is no separate hand-edited example to keep in sync.

User hooks apply across projects using that user configuration; project hooks also require trusted project configuration. Both require hook trust. Codex loads matching hooks from all sources, so do not enable duplicate Agent Signal entries across user, project, inline or plugin configuration. OpenAI documents [hook inspection and trust through `/hooks`](https://learn.chatgpt.com/docs/hooks). Client versions and managed policies can affect availability. A visible, trusted hook establishes configuration, not network delivery.

## Update an existing installation

1. Disable the installed Agent Signal hook(s) in `/hooks`, checking the user or project source as applicable.
2. Review the desired version's [release notes](https://github.com/lukeivers/agent-signal-release/releases). In the existing Agent Signal checkout, fetch tags, then check out the reviewed tag. Stop if Git reports local changes; preserve them rather than resetting or overwriting them.
3. Run `npm ci --prefix clients/codex --ignore-scripts` from that checkout.
4. If the Node executable, checkout location or installed command changed, remove only the old Agent Signal entry from the user or project hook file, then run the installer from the new location with the same scope using [step 2 of installation](install.md#2-choose-all-projects-or-one-project). Otherwise rerunning the installer should report `Already installed`.
5. Review and enable the hook in `/hooks` again. Changed hook definitions require fresh trust. The source checkout is live: replacing its files changes what the existing hook executes, even when its command text stays the same.

Do not install a second hook for the same event or manually report an event already observed by the hook.

## Recognized events

Only `Bash` `PostToolUse` events beginning with plain `git push` are considered. Compound commands, shell redirections and recognized unquoted dry-run flags (`--dry-run` or a short option containing `n`) are skipped. Failure needs Git's exact fatal GitHub HTTPS access message with HTTP 502, 503 or 504 and, if supplied, a nonzero exit code. SSH, other providers, connector failures, authentication and permission failures are outside this pilot.

Recovery needs a single GitHub HTTPS destination and clean success output. With explicit exit metadata, exit 0 is required; without it, a successful commit-range ref-update line is required. Up-to-date output without a destination cannot close a report. If another destination in the same session remains failed for that category, one successful push does not clear the shared observation. Silence and expiry do not establish recovery.

## Request timing and local state

A matching event may send a request with an 800 ms timeout; one recovery event may close up to three error categories. The installed hook timeout is three seconds. It fails quietly when observation cannot complete and leaves the original tool action intact. Dropped or delayed requests can mean incomplete counts; no worldwide delivery or latency guarantee is claimed.

Failed requests start a local cooldown of one second, doubling up to one minute. Only a later matching event can retry; there is no timer, polling task or background retry. A valid acknowledgement resets the cooldown. Returned context contains bounded integers and fixed wording, not instructions supplied by the endpoint.

State defaults to `~/.local/state/agent-signal`. It contains a hash of the session ID, a random token, sequence/cooldown data and keyed hashes used to match destinations. On the next matching event at least 22 hours after token creation, the token rotates; shared capability expiry is measured from its encoded issue hour. State directories must be private (0700), files are created with 0600 permissions, and original repository/session identifiers and output are not saved. Interrupted writes can leave temporary files; they do not contain raw output but remain sensitive local state. See [privacy](privacy.md) for service retention.

After disabling/removing every hook using it, you may delete this state directory, or the private directory you selected yourself. It can be shared by several project installations, so do not delete it while another hook still needs it. Local deletion does not remove already submitted service records or provider backups.

## Optional configuration

The installer accepts a reviewed root HTTPS origin as its second argument. Its default is `https://agent-signal-701c00ab.agent-signal-701c00ab.workers.dev`. Origins with credentials, a path, query or fragment are refused.

The adapter reads `AGENT_SIGNAL_STATE_DIR` for an absolute private state directory. This variable must be present in the hook process; setting it in an unrelated terminal does not guarantee Codex will inherit it. Changed hook commands require review and trust again.

For isolated developer tests, the installer accepts `--local-test` after an explicit loopback endpoint. The adapter then permits localhost/127.0.0.1 HTTP. Do not use that mode for public reporting; use [local verification](verification.md) instead of injecting fake events into production.
