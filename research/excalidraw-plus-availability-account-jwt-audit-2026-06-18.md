# Excalidraw Plus Availability, Account Sync, and JWT Audit

Last updated: 2026-06-18

## Verdict

The public creator-owned code available here is the free/open Excalidraw editor ecosystem, not the Plus app.

This repo does not contain a real account login + workspace sync system. It contains:

- external links to `app.excalidraw.com`
- a thin `excplus-auth` cookie presence check
- encrypted export/import handoff to Plus
- a hidden iframe bridge for Plus to pull local scene data

## Public Creator-Owned Availability

Local official evidence points to the free editor repo only:

- README/dev docs describe cloning and running `excalidraw/excalidraw`.
- Plus is linked as product/site, not source.
- Existing research found no local Plus app source.

External official GitHub check:

- `github.com/excalidraw` publicly lists the editor, libraries, Mermaid converter, MCP, store, blog, room, etc.
- No obvious public `excalidraw-plus` / `app.excalidraw.com` source repo is exposed in the official org listing checked on 2026-06-18.

Conclusion: treat Plus source as **not publicly available from the creators**, unless a private/commercial source drop exists outside public GitHub.

## Account + Workspace Sync

Not present as a local product system.

Evidence:

- `excalidraw-app/app_constants.ts` only checks for `excplus-auth` cookie presence.
- `excalidraw-app/components/AppMainMenu.tsx` sends sign-up/sign-in to `VITE_APP_PLUS_APP`.
- `excalidraw-app/components/ExportToExcalidrawPlus.tsx` encrypts/uploads a migration blob and opens `VITE_APP_PLUS_APP/import?...`.
- Collab/Firebase persistence is room-key based, not account/workspace based.

What is missing:

- profile screen
- account session/auth validation
- workspace list
- cloud document CRUD
- user-owned canvas sync
- billing/subscription
- MCP tab in profile/workspace

## Hidden Iframe

Route:

- `excalidraw-app/App.tsx` mounts `ExcalidrawPlusIframeExport` only for `/excalidraw-plus-export`.

Implementation:

- `excalidraw-app/ExcalidrawPlusIframeExport.tsx`

Purpose:

- Run invisible inside Plus.
- Send `READY` to parent.
- Receive `REQUEST_SCENE`.
- Verify sender origin and JWT.
- Read local scene/app state/files from localStorage/IndexedDB.
- Post `SCENE_DATA` back to Plus.

This is not normal login. It is a one-purpose export bridge from the free canvas to the Plus app.

## JWT Scope

JWT is narrow.

Found only in:

- `excalidraw-app/ExcalidrawPlusIframeExport.tsx`

Checks:

- exact origin equals `VITE_APP_PLUS_APP`
- JWT must exist
- JWT must be three-part format
- signature verifies against `VITE_APP_PLUS_EXPORT_PUBLIC_KEY`
- `exp` is checked

Not found:

- repo-wide JWT auth
- token-based login/session management
- workspace API authorization
- `iss`/`aud`/`sub` validation in the iframe bridge

Conclusion: the JWT is only for allowing the Plus app to request local scene export from the free app iframe. It is not a general auth system.

## Self-Hosting Implication

You can reuse the editor and export primitives, but for Plus-like self-hosting you must build:

- owned auth/session layer
- workspace database
- scene/document storage API
- cloud sync lifecycle
- profile/dashboard UI
- billing/paywall/quota logic
- MCP management UI/backend
- optional JWT signer if you keep the iframe export bridge pattern

