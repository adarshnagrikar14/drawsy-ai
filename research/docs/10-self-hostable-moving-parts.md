# Self-Hostable Moving Parts

Date: 2026-06-20

Sources:
- local envs: `.env.development`, `.env.production`
- local app code: `excalidraw-app`, `packages/excalidraw`
- official GitHub org: https://github.com/excalidraw

## Summary

The fork can run the free canvas locally, but production envs still point many product features to Excalidraw-hosted infrastructure.

Most infra can be self-hosted or replaced:

- share-link backend
- live collaboration websocket
- room/file persistence
- libraries website/content
- library submit backend
- AI backend
- MCP server

The missing non-OSS layer is the real Plus product:

- account/profile
- workspaces
- billing
- team/org management
- Plus dashboard
- cloud document management UX/backend

## Current Env Dependency Map

| Feature | Current env | Current production target | Self-host path |
| --- | --- | --- | --- |
| Share-link JSON API | `VITE_APP_BACKEND_V2_GET_URL`, `VITE_APP_BACKEND_V2_POST_URL` | `json.excalidraw.com` | `excalidraw-store` |
| Live collaboration WSS | `VITE_APP_WS_SERVER_URL` | `oss-collab.excalidraw.com` | `excalidraw-room` |
| Room/share file persistence | `VITE_APP_FIREBASE_CONFIG` | Excalidraw Firebase project | own Firebase first; later custom adapter |
| Library browse site | `VITE_APP_LIBRARY_URL` | `libraries.excalidraw.com` | `excalidraw-libraries` |
| Library submit backend | `VITE_APP_LIBRARY_BACKEND` | Excalidraw Cloud Function | `excalidraw-libraries-server`, likely needs modernization |
| AI backend | `VITE_APP_AI_BACKEND` | `oss-ai.excalidraw.com` | build own backend matching current endpoints |
| Plus landing | `VITE_APP_PLUS_LP` | `plus.excalidraw.com` | replace with own marketing/product page |
| Plus app/workspace | `VITE_APP_PLUS_APP` | `app.excalidraw.com` | build own workspace/app shell |
| Plus iframe export verify | `VITE_APP_PLUS_EXPORT_PUBLIC_KEY` | Excalidraw Plus public key | only needed if keeping Plus iframe bridge pattern |
| Tracking | `VITE_APP_ENABLE_TRACKING` | local flag | disable or point to own analytics |
| Fonts/assets | `window.EXCALIDRAW_ASSET_PATH` | current origin/CDN behavior | serve fonts/assets from own domain/CDN |

## OSS Repos To Reuse

### Main App / Editor

Repo: https://github.com/excalidraw/excalidraw

Gives:

- free infinite canvas
- React package
- collaboration client wiring
- share-link client wiring
- Firebase persistence adapter
- library UI
- AI frontend hooks
- Plus promo/export handoff hooks

Does not give:

- Plus dashboard
- auth/profile/workspace backend
- billing
- AI backend implementation

### Share Backend

Repo: https://github.com/excalidraw/excalidraw-store

Purpose:

- stores encrypted sharable drawings
- exposes binary `POST` and `GET`
- designed for Google Storage

Local app usage:

- `excalidraw-app/data/index.ts`
- `VITE_APP_BACKEND_V2_GET_URL`
- `VITE_APP_BACKEND_V2_POST_URL`

Self-host plan:

1. deploy/fork `excalidraw-store`
2. configure Google Storage or equivalent storage
3. point `VITE_APP_BACKEND_V2_*` to own URLs
4. test create/open share links end-to-end

### Live Collaboration WSS

Repo: https://github.com/excalidraw/excalidraw-room

Purpose:

- Socket.IO collaboration server
- handles live room/session messaging

Local app usage:

- `excalidraw-app/collab/Collab.tsx`
- `VITE_APP_WS_SERVER_URL`

Self-host plan:

1. run `excalidraw-room`
2. point `VITE_APP_WS_SERVER_URL` to it
3. test two-browser room join, scene updates, cursors, reconnect
4. production hardening: TLS, sticky sessions if clustered, rate limits, health checks

### Firebase Persistence

Local app usage:

- `excalidraw-app/data/firebase.ts`
- `VITE_APP_FIREBASE_CONFIG`

Purpose:

- room snapshots
- uploaded collab/share files
- storage prefixes from `excalidraw-app/app_constants.ts`

Self-host plan:

1. create own Firebase project
2. configure Firestore/Storage
3. apply local Firebase rules/indexes from `firebase-project/`
4. replace `VITE_APP_FIREBASE_CONFIG`
5. test collab persistence and file uploads

Later option:

- replace Firebase adapter with own backend/storage, but that is a larger change.

### Libraries

Repos:

- https://github.com/excalidraw/excalidraw-libraries
- https://github.com/excalidraw/excalidraw-libraries-server

Local app usage:

- browse button: `packages/excalidraw/components/LibraryMenuBrowseButton.tsx`
- publish flow: `packages/excalidraw/components/PublishLibrary.tsx`
- `VITE_APP_LIBRARY_URL`
- `VITE_APP_LIBRARY_BACKEND`

Self-host path:

- host own libraries frontend
- decide whether to import existing public libraries
- modernize submit backend if needed
- add moderation/admin flow for production quality

### AI Backend

Local app usage:

- `excalidraw-app/components/AI.tsx`
- `VITE_APP_AI_BACKEND`

Current endpoints expected by app:

- `POST /v1/ai/text-to-diagram/chat-streaming`
- `POST /v1/ai/diagram-to-code/generate`

What is present:

- frontend UI and request calls

What is missing:

- actual AI backend
- auth/rate limits
- provider integration
- streaming protocol implementation

Self-host plan:

1. implement compatible endpoints
2. start with text-to-Mermaid-to-Excalidraw for diagrams
3. use `@excalidraw/mermaid-to-excalidraw` for editable flowcharts
4. add diagram-to-code later
5. protect with auth/rate limits

### MCP

Repo: https://github.com/excalidraw/excalidraw-mcp

Purpose:

- MCP App server for streaming/rendering Excalidraw diagrams inside MCP-compatible clients

Important distinction:

This is not the Plus workspace/profile MCP tab. It is a standalone MCP server/app.

Self-host plan:

1. fork/deploy to Vercel or own Node hosting
2. expose MCP endpoint
3. decide how it connects to our workspace documents, if needed

## What We Must Build Ourselves

### Product Shell

Needed for Plus-like experience:

- login/signup
- profile screen
- workspace switcher
- document list
- folders/projects
- team/orgs
- permissions
- billing/subscription if needed
- settings
- MCP tab if product requires it

Best implementation:

- own app shell owns auth/workspace/docs
- embed or wrap Excalidraw editor
- use Excalidraw APIs for canvas state
- use custom `Sidebar`, `MainMenu`, `Footer` for product UI

### Backend

Minimum backend for workspace:

- users
- sessions/JWT
- workspaces
- documents
- document versions
- file/blob storage
- ACLs
- invite/share permissions
- optional comments/presentations

This is separate from Excalidraw OSS.

## Recommended Replacement Order

1. Own Firebase config.
2. Own WSS via `excalidraw-room`.
3. Own share API via `excalidraw-store`.
4. Own AI backend.
5. Own libraries frontend/backend.
6. Remove/replace Plus links.
7. Build workspace/auth/product shell.

## Production Hardening Checklist

- TLS everywhere
- CORS locked to own domains
- auth on private APIs
- rate limits on AI/share/collab endpoints
- object storage lifecycle policy
- document ACL checks
- room/session expiry
- file size limits
- AI token/cost limits
- observability/logs
- backups for workspace docs
- migration plan from local/browser storage

## Final Read

We can host the infra needed for a serious self-hosted Excalidraw product.

We cannot get the actual Excalidraw Plus app from OSS. The practical path is to reuse/fork OSS infrastructure, replace env links, and build our own workspace/product layer around the editor.
