# OpenAI Build Week 2026 — Drawsy contribution record

This document separates the pre-existing Drawsy product from the work being prepared for submission to [OpenAI Build Week](https://openai.devpost.com/). It follows the official rule that an existing project is evaluated only on meaningful extensions created after the submission period began.

## Eligibility boundary

- **Submission window opened:** July 13, 2026 at 9:00 AM PT / 9:30 PM IST.
- **First qualifying commit:** [`09f6903d`](https://github.com/adarshnagrikar14/drawsy-ai/commit/09f6903d) — Drawsy AI chat component, committed July 13 at 9:57 PM IST.

At the first documentation pass, qualifying work contained 44 committed changes across 38 files: 7,441 additions and 294 deletions. Git history remains the canonical evidence as the project continues through the submission window.

## What existed before Build Week

The submission does **not** claim the following as new Build Week work:

- the Excalidraw editor, scene model, packages, collaboration foundation, or upstream history;
- Drawsy's initial product shell and workspace navigation;
- the base Canvas, Project, Kanban, Presentation, Jira, and Connectors surfaces; or
- connector routing and basic connection state that existed before the Build Week extensions.

These foundations made the Build Week extensions possible, but they are not part of the judged delta.

## What was built during Build Week

### July 13–14: the canvas-aware Codex experience

- Added a professional, persistent Drawsy AI sidebar that reflows the workspace rather than obscuring it.
- Connected the client to the Drawsy agent bridge and exposed current-surface session metadata.
- Added streaming tool/reasoning activity, Markdown, sanitization, code blocks, KaTeX, copy controls, settings, attachments, tag menus, and polished composer behavior.
- Added canvas read/apply operations with current-canvas scope.
- Added selection context capture: a visual crop, element bounds, and original source images travel together for multimodal tasks.
- Added agent-driven image replacement and presentation-canvas sessions.

### July 14–15: connected context without forced prompts

- Added account-aware `@` tagging and turn-scoped grants for connected sources.
- Added resource tagging for Drawsy Kanban and Jira.
- Improved visible tool states so reads, searches, canvas actions, and resource actions are understandable while they run.
- Expanded source metadata for Gmail, Calendar, Drive, GitHub, Notion, Slack, Read AI, Fireflies, and AWS as those provider paths were introduced.

### July 16: visual project files and live software

- Defined and implemented `DRAW.md` v1: mixed Markdown and Mermaid become native, editable Excalidraw content without AI or network access.
- Made rendering non-destructive and idempotent: new content lands beside existing work; re-renders replace only generated elements in place.
- Added interactive live previews as draggable, resizable canvas windows with trusted URL validation and hot-reload support.
- Added surface-aware behavior so non-canvas tabs use Codex normally without inventing canvas context.

### July 17: hosted reliability and product finish

- Added hosted preview origin support and production client endpoints.
- Added OpenCode alongside Codex behind the same Drawsy MCP contract, including runtime discovery of free tool-capable models and session-only provider-key model selection.
- Improved AI progress cleanup, connector geometry, toolbar responsiveness, theme synchronization, canvas-response error handling, and non-retryable sync behavior.
- Added targeted tests for Markdown, connector APIs, `DRAW.md`, live previews, Kanban ordering, canvas comments, themes, and core editor integration.

## How Codex and GPT-5.6 were used

Codex running GPT-5.6 was the implementation partner throughout the qualifying work. The collaboration was iterative rather than a single generated scaffold.

**Codex accelerated:**

- repository and architecture review across the Excalidraw client and supporting service contracts;
- implementation of the React/TypeScript UI, API clients, MCP-facing canvas protocol, deterministic renderer, live-preview layer, and regression tests;
- investigation of OAuth callbacks, connector scopes, sandbox boundaries, remote previews, storage CORS, payload limits, and deployment failures;
- tight edit–typecheck–test–deploy loops while preserving concurrent work already present in the repository; and
- official-documentation research for provider integrations and runtime behavior.

**The product owner made the key decisions:**

- the assistant must make room beside the canvas rather than overlay it;
- the active surface is the default scope and unrelated workspaces are not automatically exposed;
- `C` attaches selected visual context while preserving normal behavior when nothing is selected;
- source tags add optional capability without changing an untagged request;
- `DRAW.md` is deterministic, mixed Markdown/Mermaid, non-destructive, and editable;
- live previews are native-feeling canvas elements, local to the coding session, and never collaboration-synced; and
- connector and canvas behavior must fail honestly rather than force a flattering result.

Timestamped Codex task logs and the required `/feedback` Codex Session ID will be supplied through the Devpost submission. They are not embedded in the public repository because task history can contain local paths and operational context.

## Technical implementation

The qualifying client work is concentrated in:

- `excalidraw-app/components/DrawsyAIChat.tsx` and `.scss` — assistant experience, composer, events, attachments, tags, and tool progress;
- `excalidraw-app/data/DrawsyAgentApi.ts` — typed agent/session/canvas protocol;
- `excalidraw-app/data/DrawDocument.ts` — `DRAW.md` parser and Excalidraw renderer;
- `excalidraw-app/components/LivePreviewLayer.tsx` and `data/LivePreview.ts` — interactive preview surface and URL/resize rules;
- `excalidraw-app/components/connectorCatalog.tsx` and `data/ConnectorsApi.ts` — source metadata, account discovery, and turn grants; and
- `excalidraw-app/App.tsx` — surface orchestration, canvas operations, selection capture, image replacement, presentation support, and preview attachment.

The public repository is the Drawsy web client. The five supporting private repositories listed below are shared with `testing@devpost.com` and `build-week-event@openai.com` for judging. The smaller storage-signer service currently remains part of the internal deployment bundle rather than a separate GitHub repository.

### Supporting repository evidence

The five supporting repositories remain private pending a dedicated security and public-release review. Judges receive direct access.

- [`drawsy-ai-backend`](https://github.com/adarshnagrikar14/drawsy-ai-backend): pre-existing service meaningfully extended after the cutoff with AI grants, provider execution, first-party resource tools, remote MCP providers, GitHub App access, and AWS cross-account inventory.
- [`drawsy-ai-mcp`](https://github.com/adarshnagrikar14/drawsy-ai-mcp): created entirely during the submission window as the surface-scoped Codex and Drawsy MCP bridge.
- [`draws-ai-wss`](https://github.com/adarshnagrikar14/draws-ai-wss): pre-existing Excalidraw collaboration fork; Build Week changes are limited to Node 22 and deployment packaging.
- [`drawsy-ai-store`](https://github.com/adarshnagrikar14/drawsy-ai-store): pre-existing Excalidraw store fork; Build Week changes are limited to hosted CORS typing, deployment packaging, and production-secret hygiene.
- [`drawsy-ai-libraries`](https://github.com/adarshnagrikar14/drawsy-ai-libraries): pre-existing Excalidraw library catalog with no qualifying Build Week commits; included as a runtime dependency, not claimed as new work.

## Reproduce and evaluate

- **Hosted product:** [drawsy.adarsh.rocks](https://drawsy.adarsh.rocks)
- **Local client:** follow [README.md](./README.md#local-development)
- **Validation:** `yarn test:typecheck`, `yarn test:app --watch=false`, and `yarn build`
- **Demo video:** to be supplied on the Devpost submission as a public YouTube link

The hosted product is the recommended evaluation path because AI, connectors, storage, collaboration, and isolated previews depend on the supporting services.

## Open-source foundation

Drawsy builds on [Excalidraw](https://github.com/excalidraw/excalidraw) under the MIT License. The submission enhances the underlying open-source project rather than presenting it as original Build Week work. Upstream history, copyright, and license notices are preserved.
