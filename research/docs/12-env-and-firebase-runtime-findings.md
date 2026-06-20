# Env And Firebase Runtime Findings

Date: 2026-06-20

Sources:
- `.env.development`
- `.env.production`
- `excalidraw-app/vite.config.mts`
- `excalidraw-app/data/firebase.ts`
- `excalidraw-app/data/index.ts`
- `excalidraw-app/ExcalidrawPlusIframeExport.tsx`
- `excalidraw-app/App.tsx`
- `excalidraw-app/collab/Collab.tsx`
- `excalidraw-app/vite-env.d.ts`
- `packages/excalidraw/vite-env.d.ts`

## Short Answer

Firebase is working here.

Your logs show the app is using the dev Firebase project:

```txt
projectId: excalidraw-oss-dev
```

The `batchGet` response with `missing` means Firestore looked for a room scene document and it did not exist yet.

The following `commit 200 OK` means Firestore successfully wrote/created data.

So Firebase itself is reachable and accepting writes in development.

## Why Firebase Works Without A Local Backend

The app is a browser client. It directly initializes Firebase using:

```ts
JSON.parse(import.meta.env.VITE_APP_FIREBASE_CONFIG)
```

Source:

```txt
excalidraw-app/data/firebase.ts
```

The browser calls Google APIs directly:

```txt
https://firestore.googleapis.com/v1/projects/excalidraw-oss-dev/...
https://firebasestorage.googleapis.com/v0/b/...
```

So Firebase is not pushed by the app. The Firebase config is bundled into the frontend at build/dev-server time by Vite, then Firebase JS SDK talks to Google from the browser.

## Is `.env` Needed?

There is no `.env` file currently.

Existing env files:

```txt
.env.development
.env.production
```

Vite config explicitly loads envs from the repo root:

```ts
const envVars = loadEnv(mode, `../`);
envDir: "../";
```

Source:

```txt
excalidraw-app/vite.config.mts
```

Meaning:

- `yarn start` runs Vite in development mode and loads `.env.development`.
- production build loads `.env.production`.
- `.env` is not required for the app to start because mode-specific files already exist.
- `.env.local` / `.env.development.local` can override local private settings if needed.

## What Happens If Env Is Missing?

The free canvas can still render with fewer envs.

But feature-specific flows break:

| Missing env | What breaks |
| --- | --- |
| `VITE_APP_FIREBASE_CONFIG` | collab persistence, share-link files, Plus migration upload |
| `VITE_APP_BACKEND_V2_*` | shareable JSON links |
| `VITE_APP_WS_SERVER_URL` | live collaboration socket |
| `VITE_APP_AI_BACKEND` | AI text-to-diagram and diagram-to-code |
| `VITE_APP_LIBRARY_URL` | browse libraries link |
| `VITE_APP_LIBRARY_BACKEND` | publish/submit library |
| `VITE_APP_PLUS_APP` | sign-up/sign-in links and Plus import handoff |
| `VITE_APP_PLUS_LP` | Plus marketing links |
| `VITE_APP_PLUS_EXPORT_PUBLIC_KEY` | hidden iframe Plus export verification |

## The `json-dev` 500 Error

Observed:

```txt
POST https://json-dev.excalidraw.com/api/v2/post/
500 Internal Server Error
Could not refresh access token
```

This is not Firebase.

This is the share-link backend from:

```env
VITE_APP_BACKEND_V2_POST_URL=https://json-dev.excalidraw.com/api/v2/post/
```

Source:

```txt
excalidraw-app/data/index.ts
```

Meaning:

- the app successfully reached Excalidraw's dev JSON backend
- their backend failed refreshing its own access token
- our local app cannot fix that

Real fix:

- host our own compatible share backend, likely `excalidraw-store`
- point `VITE_APP_BACKEND_V2_GET_URL` and `VITE_APP_BACKEND_V2_POST_URL` to it

## What The Firebase Logs Mean

Observed:

```json
{
  "missing": "projects/excalidraw-oss-dev/databases/(default)/documents/scenes/163c9f7b65ecc7b156c0",
  "readTime": "2026-06-19T21:22:24.601406Z"
}
```

This matches:

```ts
const docRef = doc(firestore, "scenes", roomId);
const snapshot = await transaction.get(docRef);
```

If missing, code creates the encrypted scene document:

```ts
transaction.set(docRef, storedScene);
```

Then commit succeeds:

```json
{
  "writeResults": [{ "updateTime": "..." }],
  "commitTime": "..."
}
```

Conclusion:

Firebase is working, and the scene document was created/updated.

## Firebase Data Stored

Firestore:

```txt
scenes/{roomId}
```

Fields:

- `sceneVersion`
- `iv`
- `ciphertext`

Storage prefixes:

```txt
/files/shareLinks/{id}
/files/rooms/{roomId}
/migrations/scenes/{id}
/migrations/files/scenes/{id}
```

Important:

Scene elements and files are encrypted client-side before upload.

## Are Firebase API Keys Secret?

Firebase web config contains public client identifiers:

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

These are not private server secrets. They are intended to be shipped to browsers.

Security must come from:

- Firebase rules
- allowed origins/domain restrictions
- authenticated access if added
- storage/firestore permissions

For our product, we should not use Excalidraw's Firebase project. We should create our own Firebase project and replace `VITE_APP_FIREBASE_CONFIG`.

## What Are `VITE_APP_PLUS_EXPORT_PUBLIC_KEY` Values?

They are RSA public keys.

There are two because:

- `.env.development` has a dev Plus public key
- `.env.production` has a prod Plus public key

Used only in:

```txt
excalidraw-app/ExcalidrawPlusIframeExport.tsx
```

Purpose:

- hidden iframe receives `REQUEST_SCENE` from `VITE_APP_PLUS_APP`
- request includes a JWT
- editor verifies JWT signature with `VITE_APP_PLUS_EXPORT_PUBLIC_KEY`
- if valid, editor sends local scene data back to the Plus app

This is verification-only. It is not a private key and cannot sign JWTs.

The private signing key lives on the Plus side, not in this repo.

## Why Two Plus Public Keys?

Development:

```env
VITE_APP_PLUS_APP=http://localhost:3000
```

Production:

```env
VITE_APP_PLUS_APP=https://app.excalidraw.com
```

Each environment has its own public key because each Plus environment signs JWTs with its own private key.

If we build our own workspace app and keep the iframe bridge:

1. generate our own RSA key pair
2. workspace backend signs JWT with private key
3. editor verifies JWT with our public key
4. set `VITE_APP_PLUS_APP` to our workspace origin
5. set `VITE_APP_PLUS_EXPORT_PUBLIC_KEY` to our public key

If we remove Plus iframe bridge, this key is not needed.

## `VITE_APP_DISABLE_PREVENT_UNLOAD`

Comment:

```env
# set to true in .env.development.local to disable the prevent unload dialog
VITE_APP_DISABLE_PREVENT_UNLOAD=
```

Meaning:

If set to exactly:

```env
VITE_APP_DISABLE_PREVENT_UNLOAD=true
```

the app will not show the browser "you may lose changes" prompt when unsaved file/collab data exists.

Used in:

- `excalidraw-app/App.tsx`
- `excalidraw-app/collab/Collab.tsx`

Default empty value means normal behavior:

- prevent unload when needed
- warn user before leaving if data/files may be unsaved

This is a developer convenience flag, not required for production.

## All Env Keys Found

### Defined In `.env.development`

| Key | Purpose | Required to run canvas? | Required for feature? |
| --- | --- | --- | --- |
| `MODE` | Vite mode marker | no | diagnostics |
| `VITE_APP_BACKEND_V2_GET_URL` | load share-link JSON | no | share links |
| `VITE_APP_BACKEND_V2_POST_URL` | create share-link JSON | no | share links |
| `VITE_APP_LIBRARY_URL` | browse library website | no | library browsing |
| `VITE_APP_LIBRARY_BACKEND` | submit/publish libraries | no | library publishing |
| `VITE_APP_WS_SERVER_URL` | collab websocket | no | live collaboration |
| `VITE_APP_PLUS_LP` | Plus landing links | no | Plus marketing links |
| `VITE_APP_PLUS_APP` | Plus/workspace app links/import | no | signup/import/hidden iframe |
| `VITE_APP_AI_BACKEND` | AI API | no | AI |
| `VITE_APP_FIREBASE_CONFIG` | Firebase client config | no | collab/share files/Plus migration |
| `VITE_APP_DEV_DISABLE_LIVE_RELOAD` | disables live reload snippet | no | service-worker debugging |
| `VITE_APP_ENABLE_TRACKING` | analytics enable flag | no | analytics |
| `FAST_REFRESH` | React refresh behavior | no | dev behavior |
| `VITE_APP_PORT` | Vite dev server port | no | dev server port |
| `VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX` | text debug boxes | no | debug only |
| `VITE_APP_COLLAPSE_OVERLAY` | Vite checker overlay state | no | dev overlay |
| `VITE_APP_ENABLE_ESLINT` | Vite checker ESLint | no | dev lint overlay |
| `VITE_APP_ENABLE_PWA` | PWA in dev server | no | dev PWA |
| `VITE_APP_PLUS_EXPORT_PUBLIC_KEY` | verify Plus iframe JWT | no | Plus iframe export |
| `VITE_APP_DISABLE_PREVENT_UNLOAD` | disable leave-page warning | no | dev convenience |

### Defined In `.env.production`

| Key | Purpose |
| --- | --- |
| `MODE` | production mode marker |
| `VITE_APP_BACKEND_V2_GET_URL` | production share-link GET |
| `VITE_APP_BACKEND_V2_POST_URL` | production share-link POST |
| `VITE_APP_LIBRARY_URL` | production library site |
| `VITE_APP_LIBRARY_BACKEND` | production library submit backend |
| `VITE_APP_PLUS_LP` | production Plus landing |
| `VITE_APP_PLUS_APP` | production Plus/workspace app |
| `VITE_APP_AI_BACKEND` | production AI backend |
| `VITE_APP_WS_SERVER_URL` | production collab WSS |
| `VITE_APP_FIREBASE_CONFIG` | production Firebase config |
| `VITE_APP_ENABLE_TRACKING` | analytics flag |
| `VITE_APP_PLUS_EXPORT_PUBLIC_KEY` | production Plus iframe JWT public key |
| `VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX` | debug flag forced false |
| `VITE_APP_COLLAPSE_OVERLAY` | overlay flag forced false |
| `VITE_APP_ENABLE_ESLINT` | ESLint dev-server flag forced false |

### Declared But Not Defined In Current Env Files

From `vite-env.d.ts`:

| Key | Meaning | Notes |
| --- | --- | --- |
| `VITE_APP_PORTAL_URL` | old/optional collaboration workflow URL | declared, no active usage found |
| `VITE_APP_DISABLE_SENTRY` | disables Sentry | used in `sentry.ts`; set during Docker build |
| `VITE_APP_GIT_SHA` | build commit SHA | set by build script/Vercel |
| `VITE_APP_MATOMO_URL` | Matomo analytics URL | declared in package types, no current app env |
| `VITE_APP_CDN_MATOMO_TRACKER_URL` | Matomo tracker CDN | declared in package types |
| `VITE_APP_MATOMO_SITE_ID` | Matomo site id | declared in package types |
| `PKG_NAME` | package build metadata | injected by package build |
| `PKG_VERSION` | package build metadata | injected by package build |
| `VITE_WORKER_ID` | disables analytics in worker context | used in analytics |

## Does The App Need A Separate `.env` File?

No, not for current local run.

Current setup already has mode-specific env files.

Useful additions:

- `.env.development.local` for your local overrides
- `.env.production.local` for machine-specific production overrides
- Vercel project env vars for deployed production

Do not rely on editing `.env.production` forever if deploying to Vercel. Vercel should have its own env values.

## Why This Feels Different Than Backend Env

In frontend Vite:

- env values are loaded at build/dev-server time
- `VITE_*` values are exposed to browser code
- they are not secret
- changing them requires restarting dev server or rebuilding

In backend:

- env values are read at runtime by the server
- secrets can stay secret
- changing envs usually restarts server/process

So Excalidraw is not "pushing envs" at runtime. Vite injects public env values into the frontend bundle.

## What We Should Do

For self-hosting:

1. Replace `VITE_APP_FIREBASE_CONFIG` with our own Firebase project first.
2. Replace `VITE_APP_BACKEND_V2_*` with our own share backend.
3. Replace `VITE_APP_WS_SERVER_URL` with our own `excalidraw-room`.
4. Replace `VITE_APP_AI_BACKEND` with our AI backend.
5. Replace or remove `VITE_APP_PLUS_APP`, `VITE_APP_PLUS_LP`, and Plus public key until our workspace app exists.
6. Keep local-only overrides in `.env.development.local`.

## Final Read

Firebase works right now because the repo ships public Firebase config for Excalidraw's dev project and the browser can talk directly to Firestore/Storage.

The share-link failure is unrelated to Firebase. It is Excalidraw's dev JSON backend failing internally.

`.env` is not required because `.env.development` and `.env.production` are already loaded from repo root by Vite.

The Plus public keys are only for verifying JWTs from the Plus/workspace app in the hidden iframe bridge.
