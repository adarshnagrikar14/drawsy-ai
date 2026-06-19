# AI, Plus, Workspace Gaps

## What Official Docs Cover

Official docs cover:

- open-source editor development
- `@excalidraw/excalidraw` package integration
- client-side API
- export/restore/utils
- Mermaid conversion
- basic codebase formats

## What Official Docs Do Not Cover

Official docs do not cover:

- Excalidraw Plus source/app internals
- Plus landing page source
- Plus billing
- Plus workspaces
- user account/profile management
- team/org management
- MCP tab
- AI backend setup
- AI model/provider selection
- cloud document database schema
- production self-hosted Plus clone

## AI In This Repo

From earlier code research:

- AI UI exists in this repo.
- Text-to-diagram and diagram-to-code frontend paths exist.
- The backend is external via `VITE_APP_AI_BACKEND`.

Official docs do not document that AI backend.

Conclusion:

AI can be integrated, but you need your own backend/API URL and provider implementation.

## Plus In This Repo

From earlier code research:

- Plus promo/export hooks exist.
- Hidden iframe export bridge exists.
- `excplus-auth` cookie/JWT is scoped to Plus export bridge behavior.
- Full Plus product is not present.

Official docs do not teach Plus self-hosting.

Conclusion:

The repo has Plus touchpoints, not the full Plus app.

## Workspace/Sync

Official docs give enough hooks to build workspace sync:

- `initialData`
- `onChange`
- `onLibraryChange`
- `updateScene`
- `getFiles`
- restore/export utilities
- custom sidebars/menus

But official docs do not ship:

- workspace backend
- auth system
- document list
- profile settings
- billing
- server-side document ACLs

## Practical Meaning

You can self-host the free editor and build your own workspace system around it.

You cannot self-host Excalidraw Plus just from these docs/repo because the Plus app/backend is missing.
