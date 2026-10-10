# API contract

All observation routes are POST with `Content-Type: application/json`; no query string; body limit 8192 bytes. Generic error codes: `invalid_request` 400, `invalid_capability` 401, `invalid_origin` 403, method rejection 405 (with `Allow: POST`), `sequence_conflict` 409, `rate_limited` 429, `unavailable` 503. Unknown fields are discarded. Known fields must match exact enums.

## HTTP client identification

For the public `workers.dev` endpoint, set a descriptive, non-identifying `User-Agent`, such as `AgentSignal-Python/0.1`. This applies to REST and MCP HTTP transports. Do not include usernames, email addresses, session IDs, machine names or repository details. The hooks use `AgentSignal-Codex/0.1` or `AgentSignal-ClaudeCode/0.1`; operator deployment checks use `AgentSignal-Operator/0.1`.

Cloudflare can reject a request before it reaches the application. In a read-only check on 2026-10-08, Python's default `urllib` header received HTTP 403 with plain-text `error code: 1010`; the same request with `AgentSignal-Python/0.1` received HTTP 200 JSON. This is a client compatibility workaround, not removal of the provider restriction or a guarantee that every client/network will work. An edge error is not a GitHub observation and must not trigger an outage report or automatic reporting retry. See [Cloudflare's explanation of error 1010](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/).

### Read-only Python example

Run this with Python 3.10+ to check matching counts. It needs no reporting token and submits no failure or recovery observation. Network errors, including HTTP 403, stop the example; there is no retry loop. A successful response reports observations, not GitHub health.

```python
import json
import urllib.request

request = urllib.request.Request(
    "https://agent-signal-701c00ab.agent-signal-701c00ab.workers.dev/api/v1/check",
    data=json.dumps({"cohort": {
        "service": "github",
        "operation": "git_push",
        "access": "git_https",
        "environment": "local_agent",
        "error": "http_503",
    }}).encode("utf-8"),
    headers={
        "Content-Type": "application/json",
        "User-Agent": "AgentSignal-Python/0.1",
    },
    method="POST",
)
with urllib.request.urlopen(request, timeout=10) as response:
    print(json.load(response))
```

## Observations

`/api/v1/check`: `{ "cohort": { "service":"github", "operation":"git_push", "access":"git_https", "environment":"local_agent", "error":"http_503" } }`.

`/api/v1/failure` and `/api/v1/recovery`: same cohort plus increasing positive safe integer `sequence`; `Authorization: Bearer v1.<unix-hour>.<32-random-bytes-base64url>`. Generate 32 cryptographically random bytes locally; never derive tokens from identity or reuse across users. A fabricated token is a new anonymous reporter, which is why counts are unverified.

Response fields: `outstanding`, `recovered`, `otherOutstanding`, `windowSeconds` 600, server `asOf`, `evidence:"unverified_reports"`, `population:"reporter_capabilities"`, fixed interpretation caveat. Checks return null for otherOutstanding because they are not tied to a reporter. Failure/recovery return count excluding the calling capability. Matching uses the entire cohort, including error category and environment. Counts across cohorts must not be added to claim unique sessions.

An observation is counted only when its latest server observation is strictly newer than now minus 10 minutes and its capability has not expired. New sequences update freshness; identical replays do not. Recovery counts require prior failure on the exact capability/cohort, and are mutually exclusive with its outstanding state. Recovery before failure retains a watermark but contributes neither count. Silence expires visibility and does not prove recovery.

Ordering watermarks persist to capability expiry, preventing a delayed failure from reopening a recovered/expired report. Capability hours must not be future or 24 hours old. The adapter rotates after 22 hours; it drops its old pending set, whose shared counts expire naturally. Bearer possession permits mutation only of that pseudonym's records. No endpoint lists raw observations or public reporter IDs.

Atomic D1 batch admission allows at most 10000 reporter-admitted report attempts per UTC day and 12 per capability per UTC clock hour, including retries/conflicts. Requests rejected by the reporter ceiling do not spend the daily budget; a globally rejected request may still spend its reporter budget. Tokens are free to mint, so these limits do not prevent deliberate quota exhaustion. 120 requests/minute per Worker isolate is an early local admission guard for all operations; it is not global DDoS protection. This also admits malformed and non-POST traffic; unrelated requests may consume the isolate budget. Free platform limits remain separate. Aggregate queries are indexed by cohort/freshness.

## MCP

POST `/mcp`: JSON-RPC initialize, initialized notification, ping, tools/list, tools/call. Stateless JSON responses, no SSE or event subscriptions. Supported protocol versions are `2025-11-25`, `2025-06-18` and `2025-03-26`; initialize negotiates one of those versions. Tools `check_reports`, `report_failure`, `report_recovery`; reporting capability is a sensitive tool argument and must receive the same host-log scrutiny as Authorization headers. Report tools require cohort, capability, sequence. The response includes structuredContent and the same counts as text. Public integrations use the stable Cloudflare MCP endpoint. This is a versioned minimal MCP surface, not a directory-ready published plugin.

## Backend continuity

The stable Cloudflare gateway additionally returns `backendEpoch`, `windowWarming`, and a fixed continuity caveat in REST results and MCP structured/text content. Resetting the epoch starts a new count window; old observations and recovery watermarks are not copied. Counts can temporarily understate recent reports while rebuilding. Clients must not interpret zero after a change as health. See [hosting](hosting.md).
