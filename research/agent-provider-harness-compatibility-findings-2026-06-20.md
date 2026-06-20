# Agent Provider Harness Compatibility Findings

Date: 2026-06-20

Correction: earlier notes discussed OpenRouter as the third agent provider. That was the wrong target. The correct target is OpenCode.

Scope: Codex app-server, OpenCode server/CLI/SDK, Claude Code/Agent SDK, and Excal AI's provider-neutral agent gateway.

## Short Answer

| Question | Verified answer |
| --- | --- |
| Is OpenCode closer to Codex/Claude Code than OpenRouter? | Yes. OpenCode is an AI coding agent with CLI, TUI, web, IDE, server, SDK, sessions, agents, MCP, permissions, and providers. |
| Does OpenCode have an app-server equivalent? | Yes, functionally. `opencode serve` runs a headless HTTP server with OpenAPI 3.1, SSE events, sessions, messages, files, tools, MCP, provider auth, and permissions. |
| Is it the same protocol as Codex app-server? | No. Codex uses JSON-RPC app-server; OpenCode uses HTTP/OpenAPI + SSE. |
| Can we run one Codex agent and one OpenCode agent per user on EC2? | Yes, as separate sandboxed runner adapters. |
| Can both use Excal AI MCPs? | Yes. Codex supports MCP; OpenCode supports local and remote MCP servers. |
| Is OpenRouter still relevant? | Only as a model/provider route inside OpenCode or another harness, not as the main agent harness. |

## Provider Matrix

| Harness | Server/runtime | Programmatic API | MCP | Agents | Permissions | Provider support | Fit for Excal AI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Codex | `codex app-server` | JSON-RPC over stdio/ws/unix | Yes | Yes | Sandbox + approvals | OpenAI/custom providers | Very strong |
| OpenCode | `opencode serve` / `opencode web` | HTTP OpenAPI + SDK + SSE | Yes | Primary agents + subagents | allow/ask/deny rules | 75+ providers via AI SDK/models.dev | Very strong |
| Claude Code | Claude Code / Agent SDK / Managed Agents | SDK/CLI/hosted agents | Yes | Yes | SDK/runtime permissions | Anthropic + supported backends | Strong |
| OpenRouter | API/provider routing | HTTP model API | Not a full coding harness | No verified coding harness | No verified local sandbox | Many models | Use under a harness, not as harness |

## OpenCode Verified Findings

Official docs verified:

- OpenCode is an open source AI coding agent available as terminal, desktop app, and IDE extension.
- It can be installed as `opencode-ai`.
- `opencode serve` runs a headless HTTP server.
- The server exposes an OpenAPI 3.1 endpoint.
- The server has SSE event streams.
- The SDK `@opencode-ai/sdk` is a type-safe JS/TS client for the server.
- `createOpencode()` can start both server and client.
- `createOpencodeClient()` can connect to an existing server.
- OpenCode supports sessions, session fork, session diff, revert, summarize, abort, messages, async prompts, shell commands, files, LSP, formatters, MCP, provider auth, tools, agents, logging, and TUI control APIs.
- OpenCode supports local and remote MCP servers.
- MCP tools become available to the LLM alongside built-in tools.
- OpenCode has primary agents and subagents.
- Built-in primary agents include Build and Plan.
- Build has all tools enabled.
- Plan is restricted and asks for file edits and bash by default.
- OpenCode permissions support `allow`, `ask`, and `deny`.
- Permissions can be granular for bash/edit/read/external directories.
- OpenCode supports 75+ LLM providers via AI SDK and models.dev.
- OpenCode stores provider credentials at `~/.local/share/opencode/auth.json`.
- `opencode web` provides browser access and shares sessions/state with attached terminal clients.
- `OPENCODE_SERVER_PASSWORD` protects `serve` and `web` with HTTP Basic auth.

Official sources:

- https://opencode.ai/docs/
- https://opencode.ai/docs/server/
- https://opencode.ai/docs/sdk/
- https://opencode.ai/docs/mcp-servers/
- https://opencode.ai/docs/agents/
- https://opencode.ai/docs/permissions/
- https://opencode.ai/docs/providers/
- https://opencode.ai/docs/web/
- https://opencode.ai/docs/cli/

## New Correct Architecture

```text
Excal AI Canvas
  -> Right Agent Panel
  -> Agent Gateway
      -> Codex Runner Adapter
          -> codex app-server
      -> OpenCode Runner Adapter
          -> opencode serve
      -> Claude Runner Adapter
          -> Claude Agent SDK / Claude Code
      -> Shared Excal AI MCP client/tools
      -> Session DB
      -> Approval service
      -> Workspace files
      -> Sandbox manager
```

## EC2 Runner Scenario

Correct current plan:

```text
One authenticated user
  -> one isolated project/workspace folder
  -> one Codex runner container if selected
  -> one OpenCode runner container if selected
  -> preinstalled Excal AI MCP config
  -> provider credentials mounted per user
  -> canvas context passed through Agent Gateway
```

Codex side:

```text
container
  -> codex app-server --stdio
  -> Agent Gateway speaks JSON-RPC
```

OpenCode side:

```text
container
  -> opencode serve --hostname 127.0.0.1 --port <port>
  -> Agent Gateway speaks HTTP/OpenAPI + SSE
```

## Why OpenCode Fits Better Than OpenRouter

OpenCode gives us:

- agent runtime
- sessions
- messages
- diff/revert
- file APIs
- shell command API
- MCP management/status
- agents/subagents
- permission rules
- web/server mode
- SDK
- provider abstraction

OpenRouter gives model access. OpenCode gives an agent harness.

So the corrected provider/harness stack is:

```text
Codex | OpenCode | Claude Code
```

Not:

```text
Codex | Claude Code | OpenRouter
```

## Excal AI Integration Meaning

The product becomes:

```text
Infinite canvas
  + MCP-controlled workspace/tools
  + sandboxed per-user agent runners
  + Codex/OpenCode/Claude switcher
  + app generation from canvas/frame/context
  + repo/IaC/Jira/Kanban actions
```

OpenCode can participate directly, not as a weak fallback.

## Important Implementation Differences

| Concern | Codex | OpenCode |
| --- | --- | --- |
| Protocol | JSON-RPC app-server | HTTP/OpenAPI + SSE |
| Server command | `codex app-server` | `opencode serve` |
| Browser mode | Codex client surfaces | `opencode web` |
| SDK | Codex SDK | `@opencode-ai/sdk` |
| Sessions | Thread/turn | Session/message |
| MCP | Configured in Codex | `mcp` config + API |
| Permissions | sandbox/approval policy | `permission`: allow/ask/deny |
| Provider auth | Codex auth/API/custom provider | `opencode auth`, auth.json, env/.env |

## What Is Still Not Verified

- Whether OpenCode has container sandboxing built in equivalent to Codex sandbox. Docs verify permissions, not full OS sandbox.
- Whether OpenCode has a wire-compatible Codex app-server protocol. It does not appear to; it uses HTTP/OpenAPI.
- Whether OpenCode credentials can safely be multi-tenant as-is. We should treat `auth.json` like a secret.
- Whether OpenCode server Basic auth is enough for production. It is not enough for our product; put it behind Agent Gateway auth.

## Final Status

New scenario is better than the OpenRouter version.

OpenCode is a real peer harness:

```text
Codex app-server
OpenCode serve
Claude Agent SDK / Claude Code
```

For Excal AI, build one Agent Gateway and adapters for each harness. Keep Excal AI MCPs, canvas diff approval, files, Jira, IaC, repo management, and user memory outside the provider. That is the stable product layer.

