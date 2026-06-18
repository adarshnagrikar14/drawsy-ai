# Excalidraw AI + Plus Self-Hosting Findings

Last updated: 2026-06-18

## Short Answer

This repo is mainly the **free canvas app** (`excalidraw.com`) plus hooks into Plus and AI.

It does **not** contain the full `app.excalidraw.com` workspace/account/product app, and it does **not** contain the Plus landing page.

## Domain Split

| Domain | Product role | Code in this repo? | Evidence |
| --- | --- | --- | --- |
| `excalidraw.com` | Free infinite canvas/editor | Yes | `excalidraw-app/`, `packages/excalidraw/` |
| `plus.excalidraw.com` | Plus marketing/landing/blog/pricing | No, only links | `VITE_APP_PLUS_LP` usage in `App.tsx`, `AppMainMenu.tsx`, `AppSidebar.tsx` |
| `app.excalidraw.com` | Plus workspace/account/cloud management | No, only handoff links/import/export hooks | `VITE_APP_PLUS_APP` usage and `/import?excalidraw=...` handoff |

## What Is Here

| Area | Present? | What exists locally |
| --- | --- | --- |
| Core canvas/editor | Yes | Full Excalidraw React editor and app shell |
| Local save/open/export | Yes | Browser/local/file flows |
| Collaboration room client | Yes | Client-side room/collab integration; server is external |
| Share-link client | Yes | Client integration; storage API is external |
| AI Text-to-Diagram UI | Yes | `TTDDialog`, chat UI, Mermaid preview/import flow |
| Mermaid-to-Excalidraw | Yes | Local package import via `@excalidraw/mermaid-to-excalidraw` |
| Wireframe/frame-to-code UI | Yes | `magicframe` tool + `DiagramToCodePlugin` |
| AI generation backend | No | Calls `VITE_APP_AI_BACKEND` |
| Plus workspace save handoff | Partial | Encrypts scene, uploads migration blob/files, opens Plus import URL |
| Plus signed-in detection | Very thin | Checks `excplus-auth` cookie only |
| Plus comments/presentations | No | Promo tabs only |
| Workspace/dashboard/profile/billing/team management | No | No matching app modules/routes found |
| MCP tab/profile screen | No | Search found no `MCP/mcp` module or UI in `excalidraw-app`/`packages` |

## AI Findings

AI is integrated as frontend/plugin architecture, not as a self-contained feature.

Key files:

- `excalidraw-app/components/AI.tsx`
- `packages/excalidraw/components/TTDDialog/*`
- `packages/excalidraw/components/DiagramToCodePlugin/DiagramToCodePlugin.tsx`
- `packages/excalidraw/index.tsx`

Endpoints expected from your backend:

| Feature | Frontend path | Backend contract |
| --- | --- | --- |
| Text to diagram | `AI.tsx` | `POST {VITE_APP_AI_BACKEND}/v1/ai/text-to-diagram/chat-streaming` |
| Wireframe/frame to code | `AI.tsx` | `POST {VITE_APP_AI_BACKEND}/v1/ai/diagram-to-code/generate` |

Important detail: the AI backend should return Mermaid for Text-to-Diagram and HTML for Diagram-to-Code.

## Plus Findings

Plus is mostly absent as product code. What exists is integration glue.

| Plus piece | Status | Notes |
| --- | --- | --- |
| Plus landing page | Missing | Only `VITE_APP_PLUS_LP` links |
| Plus app/workspace | Missing | Only `VITE_APP_PLUS_APP` links |
| Sign up/sign in | Missing | App redirects to Plus app |
| Workspace list/files | Missing | No local workspace UI/data model found |
| Profile screen | Missing | No local profile/account app found |
| Billing/subscription | Missing | No billing/subscription code found |
| Team management | Missing | Only collab invite/team command labels in free app |
| Comments | Missing | Sidebar promo says “Make comments with Excalidraw+” |
| Presentations | Missing | Sidebar promo says “Create presentations with Excalidraw+” |
| Save to Plus workspace | Partial | Export card encrypts scene and hands it to Plus |

## How Paywall Likely Works

The paywall is not meaningfully implemented in this repo.

This repo:

- shows/hides some Plus-related UI based on `excplus-auth`
- sends AI requests to an external backend
- links to Plus when quota is exceeded
- sends encrypted scene migration data to Firebase and opens Plus import

External services likely enforce:

- auth
- user/workspace ownership
- quotas
- billing/subscription status
- Plus-only features like comments/presentations/cloud workspace

## Surprise Findings

1. **Mermaid-to-Excalidraw is local and free-ish here.**
   The Mermaid tab does not need the AI backend. AI is only needed to generate Mermaid from text.

2. **The `magicframe` tool is in the open editor.**
   The UI/tool type exists locally. It only becomes useful when `DiagramToCodePlugin` supplies a `generate()` function.

3. **The Magicframe command palette entry is commented out.**
   Toolbar support exists, but command-palette exposure appears intentionally disabled/commented.

4. **AI quota upsell is frontend-visible.**
   On HTTP `429`, the UI returns an HTML message linking to Excalidraw+ for more requests.

5. **AI chats persist locally.**
   `TTDIndexedDBAdapter` persists text-to-diagram chat data in IndexedDB, separate from Plus workspace.

6. **Plus export is encrypted migration, not normal cloud save.**
   The free app encrypts scene JSON/files, uploads to `/migrations/...`, then opens `VITE_APP_PLUS_APP/import?excalidraw={id},{key}`.

7. **There is a hidden Plus iframe bridge.**
   `/excalidraw-plus-export` is intended for Plus to embed the free canvas app in a hidden iframe and export data through `postMessage`.

8. **That iframe bridge validates Plus origin and JWT.**
   It checks `VITE_APP_PLUS_APP` origin and `VITE_APP_PLUS_EXPORT_PUBLIC_KEY`. This implies Plus owns a private signer/backend not present here.

9. **Comments and presentations are not disabled features; they are promo placeholders.**
   The sidebar tabs exist, but they link out to Plus landing page instead of implementing comments/presentations.

10. **The Plus signed-in check is weak by itself.**
    `isExcalidrawPlusSignedUser` only checks whether the `excplus-auth` cookie exists. Real trust must live in Plus/backend.

## Self-Hosting Meaning

To self-host Plus-like behavior, this repo gives you:

- the editor
- AI UI shells
- Magicframe UI shell
- TTD/Mermaid UI
- export/import primitives
- encrypted scene serialization
- Firebase/file upload adapters
- collab/share clients

You still need to build or supply:

- workspace app
- auth
- profile/account screens
- billing/subscription/paywall
- workspace/team/project data model
- cloud scene storage
- comments
- presentations
- MCP UI/backend, if desired
- AI backend endpoints
- quota/rate-limit system
- Plus import/export backend and JWT signer

## Practical Build Plan

| Phase | Build | Why |
| --- | --- | --- |
| 1 | Own env/domain/Firebase/share/collab | Remove upstream dependency first |
| 2 | AI backend matching current routes | Unlock Text-to-Diagram and Magicframe without touching editor much |
| 3 | Workspace DB + auth | Base for Plus-like cloud product |
| 4 | Save/open scenes from workspace | Replace migration-only Plus handoff with real cloud documents |
| 5 | Profile/account/billing | Paywall foundation |
| 6 | Comments/presentations | These are not in this repo, so treat as new product modules |
| 7 | MCP tab | No local implementation found; design as new Plus/workspace feature |

## Final Verdict

The repo is excellent as the **canvas/editor base**.

It is not a leaked/open Plus app. For self-hosted Plus, treat this as:

- 70-80% of the editor experience
- 30-40% of AI frontend plumbing
- 10-15% of Plus integration plumbing
- 0-5% of actual Plus workspace/account/billing/product backend

