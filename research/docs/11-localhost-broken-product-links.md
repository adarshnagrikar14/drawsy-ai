# Localhost Product Links And Broken Feature Paths

Date: 2026-06-20

## Summary

The broken `localhost:3000` and share-link behavior is not caused by the `yarn start` fix.

It comes from existing development env values and missing local services.

## Exact Findings

### 1. Sign Up Goes To `localhost:3000`

Observed:

```txt
http://localhost:3000/sign-up?utm_source=signin&utm_medium=app&utm_content=hamburger
```

Cause:

```env
VITE_APP_PLUS_APP=http://localhost:3000
```

Source:

- `.env.development`
- `excalidraw-app/components/AppMainMenu.tsx`

Code path:

```ts
href={`${import.meta.env.VITE_APP_PLUS_APP}${
  isExcalidrawPlusSignedUser ? "" : "/sign-up"
}?utm_source=signin&utm_medium=app&utm_content=hamburger`}
```

Meaning:

The app expects a Plus/workspace app running on port `3000` in development.

If nothing is running there, signup/login links are dead.

### 2. Save As -> Share Link Error

Observed:

```txt
Couldn't create shareable link.
```

Cause:

Share-link export depends on:

```env
VITE_APP_BACKEND_V2_POST_URL
VITE_APP_BACKEND_V2_GET_URL
```

Source:

- `.env.development`
- `.env.production`
- `excalidraw-app/data/index.ts`

Code path:

```ts
const response = await fetch(BACKEND_V2_POST, {
  method: "POST",
  body: payload.buffer,
});
```

Meaning:

This is a backend dependency. It should be fixed by hosting an own compatible share backend, likely `excalidraw-store`, and pointing both envs to it.

### 3. Save As -> Excalidraw+ Export Opens `localhost:3000/import`

Observed:

```txt
http://localhost:3000/import?excalidraw=LyjVmyl5VEr4,-lTzW9XFAWPkKdmdw0EenQ
```

Cause:

Same env:

```env
VITE_APP_PLUS_APP=http://localhost:3000
```

Source:

- `.env.development`
- `excalidraw-app/components/ExportToExcalidrawPlus.tsx`

Code path:

```ts
window.open(
  `${import.meta.env.VITE_APP_PLUS_APP}/import?excalidraw=${id},${encryptionKey}`,
);
```

Meaning:

This is not solved by share backend alone.

It expects a Plus/workspace app that understands:

```txt
/import?excalidraw={migrationSceneId},{encryptionKey}
```

The scene is first encrypted and uploaded to Firebase under:

```txt
/migrations/scenes/{id}
/migrations/files/scenes/{id}
```

Then the Plus app is expected to import it.

## Other Localhost Dependencies In Development

From `.env.development`:

| Env | Value | Needed service |
| --- | --- | --- |
| `VITE_APP_PLUS_APP` | `http://localhost:3000` | local workspace/Plus-like app |
| `VITE_APP_WS_SERVER_URL` | `http://localhost:3002` | `excalidraw-room` live collab server |
| `VITE_APP_AI_BACKEND` | `http://localhost:3016` | own AI backend |
| `VITE_APP_PORT` | `3001` | current Vite editor app |

## Not Real Product Breakers

Other `localhost` references found are docs/examples/dev-only:

- docs pages
- package changelog
- Docker healthcheck
- Vite live reload workaround

They are not user-facing product redirects in the main app.

## What Each Fix Needs

| Issue | Fixed by own BE? | Fixed by env only? | Real fix |
| --- | --- | --- | --- |
| Share-link error | Yes | only if env points to working backend | host `excalidraw-store` or compatible API |
| Signup to `localhost:3000` | No | partially | point `VITE_APP_PLUS_APP` to our workspace app or remove link |
| Excalidraw+ import to `localhost:3000/import` | No | partially | build/import route in our workspace app or remove Excalidraw+ export card |
| Collab WSS missing | Yes | only if env points to running WSS | host `excalidraw-room` |
| AI missing | Yes | only if env points to running AI API | build compatible AI backend |

## Product Decision

For our fork, keeping `VITE_APP_PLUS_APP=http://localhost:3000` only makes sense if we are actively building a separate workspace app on port `3000`.

Otherwise, better options:

1. Point `VITE_APP_PLUS_APP` to our real hosted workspace app.
2. Remove/disable Plus signup/import UI until our workspace exists.
3. Replace Excalidraw+ copy with our product naming.
4. Keep share-link export separate from workspace import.

## Final Read

These broken paths reveal the architecture boundary:

- editor app runs on `3001`
- Plus/workspace app was expected on `3000`
- collab WSS expected on `3002`
- AI backend expected on `3016`

So yes, backend work covers share/collab/AI, but Plus signup/import needs a separate product/workspace app or UI/env cleanup.
