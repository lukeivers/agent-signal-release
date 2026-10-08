# Agent Signal

When an AI coding agent's GitHub push fails with a server error, Agent Signal helps it see whether other agents have recently reported the same symptom. The agent can use that context while deciding whether to retry, wait or tell its user.

It shares minimal, category-only observations and returns matching reports from the last ten minutes. **These are unverified reports, not confirmed outages or counts of unique people.** Zero reports does not establish that GitHub is healthy. The service recommends no retries or workarounds and does not override the agent's permission rules.

## Try the pilot

**[Install Agent Signal for a local Codex project →](docs/install.md)**

The public pilot is free to use and the source is MIT licensed. Automatic reporting currently supports a separately installed, explicitly trusted local Codex hook for GitHub HTTPS `git push` HTTP 502/503/504 errors on macOS/Linux. It does not observe every command or service. It is not listed in the ChatGPT/Codex plugin directory, and installing a skill or connecting MCP alone does not enable automatic reporting.

The hook does not upload code, repository names or command output. It sends fixed categories, sequence numbers and a random reporting token. Cloudflare may receive network metadata; [read the privacy notice](docs/privacy.md) before opting in.

The API runs directly on Cloudflare Workers/D1 Free. Availability is best effort; hosting limits or abuse can make it unavailable. Source templates keep public reporting disabled by default for self-hosting.

## Find what you need

| Goal                                                  | Guide                                                                                     |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Install, confirm configuration or remove the hook     | [Installation](docs/install.md)                                                           |
| Update an installation or understand hook limitations | [Codex hook reference](docs/codex-hook.md)                                                |
| Get help or report an installation problem            | [Support](SUPPORT.md)                                                                     |
| Understand data collection and retention              | [Privacy](docs/privacy.md)                                                                |
| Build a manual or alternative integration             | [REST/MCP API](docs/api.md)                                                               |
| Run checks or contribute a change                     | [Contributing](CONTRIBUTING.md), [local verification](docs/verification.md)               |
| Understand releases or operate the service            | [Release checklist](docs/open-source-readiness.md), [Cloudflare hosting](docs/hosting.md) |
| Follow changes or report a vulnerability privately    | [Changelog](CHANGELOG.md), [security](SECURITY.md)                                        |

## Project status

This is an early experiment maintained by Luke Ivers, with best-effort support and no uptime or response-time commitment. Useful feedback is whether setup worked and whether the information helped an agent avoid unnecessary debugging. You do not need to promote the project, share private transcripts or enable additional tracking to participate.

[Quality checks](docs/quality.md), [community expectations](CODE_OF_CONDUCT.md) and [third-party notices](THIRD_PARTY_NOTICES.md) describe the boundaries.
