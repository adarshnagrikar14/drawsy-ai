# Excal-AI Dependency Map

Last updated: 2026-06-13

## Direction

Yes, the path forward is:

- keep all features
- move every dependency to our ownership
- reuse upstream where it helps
- fork/modify only where needed for compatibility

No removal is required as the strategy.

## Table

| Dependency / Component | Simple meaning | Current state in this fork | Current source | Forward path |
| --- | --- | --- | --- | --- |
| Share backend (`VITE_APP_BACKEND_V2_GET_URL`, `POST_URL`) | Saves a scene to a share link and loads it back later | Wired in env and used by app | Upstream Excalidraw JSON API in [.env.production](C:/Users/adars/OneDrive/Desktop/excal-ai/.env.production:3) and [excalidraw-app/data/index.ts](C:/Users/adars/OneDrive/Desktop/excal-ai/excalidraw-app/data/index.ts:65) | Best option: reuse/fork `excalidraw-store`, test, then own deployment |
| Collab websocket (`VITE_APP_WS_SERVER_URL`) | Live multi-user room connection: cursors, scene updates, presence | Wired in env and used by app | Upstream collab server URL in [.env.production](C:/Users/adars/OneDrive/Desktop/excal-ai/.env.production:15) and [excalidraw-app/collab/Collab.tsx](C:/Users/adars/OneDrive/Desktop/excal-ai/excalidraw-app/collab/Collab.tsx:524) | Start from `excalidraw-room`, expect fork/patch/testing |
| Firebase scene persistence (`VITE_APP_FIREBASE_CONFIG`) | Stores room snapshots and uploaded room/share files | Hard-coded as the current storage adapter in app code | Upstream Firebase project in [.env.production](C:/Users/adars/OneDrive/Desktop/excal-ai/.env.production:17) and [excalidraw-app/data/firebase.ts](C:/Users/adars/OneDrive/Desktop/excal-ai/excalidraw-app/data/firebase.ts:46) | Fastest path: switch to **your own Firebase project** first; later optionally replace with your own adapter/service |
| Library browse URL (`VITE_APP_LIBRARY_URL`) | Public page from which users browse/install libraries | Env-driven in package UI | Upstream libraries site in [.env.production](C:/Users/adars/OneDrive/Desktop/excal-ai/.env.production:6) and [packages/excalidraw/components/LibraryMenuBrowseButton.tsx](C:/Users/adars/OneDrive/Desktop/excal-ai/packages/excalidraw/components/LibraryMenuBrowseButton.tsx:21) | Reuse content model, likely host your own library frontend |
| Library submit backend (`VITE_APP_LIBRARY_BACKEND`) | Accepts published libraries from users | Env-driven in package UI | Upstream Cloud Function URL in [.env.production](C:/Users/adars/OneDrive/Desktop/excal-ai/.env.production:7) and [packages/excalidraw/components/PublishLibrary.tsx](C:/Users/adars/OneDrive/Desktop/excal-ai/packages/excalidraw/components/PublishLibrary.tsx:301) | `excalidraw-libraries-server` is reference-only; likely fork and modernize |
| AI backend (`VITE_APP_AI_BACKEND`) | Handles AI requests from the app UI | Env-driven in app | Upstream AI URL in [.env.production](C:/Users/adars/OneDrive/Desktop/excal-ai/.env.production:12) and [excalidraw-app/components/AI.tsx](C:/Users/adars/OneDrive/Desktop/excal-ai/excalidraw-app/components/AI.tsx:45) | Build your own backend; no strong turnkey upstream repo found |
| Plus landing/app URLs (`VITE_APP_PLUS_LP`, `VITE_APP_PLUS_APP`) | Premium/product links, exports, promos, redirects | Still referenced throughout the app | Upstream Plus/App URLs in [.env.production](C:/Users/adars/OneDrive/Desktop/excal-ai/.env.production:9) and [excalidraw-app/App.tsx](C:/Users/adars/OneDrive/Desktop/excal-ai/excalidraw-app/App.tsx:873) | Replace with your own product URLs and auth/product flows |
| Sentry | Error monitoring service | Present in app code | [excalidraw-app/sentry.ts](C:/Users/adars/OneDrive/Desktop/excal-ai/excalidraw-app/sentry.ts:20) | Point to your own Sentry or your own monitoring stack |
| Analytics/tracking | Product usage event tracking | Build can enable tracking; code sends `sa_event` if available | [excalidraw-app/package.json](C:/Users/adars/OneDrive/Desktop/excal-ai/excalidraw-app/package.json:46) and [packages/excalidraw/analytics.ts](C:/Users/adars/OneDrive/Desktop/excal-ai/packages/excalidraw/analytics.ts:36) | Replace with your own analytics or keep disabled until ready |
| Domain/meta/SEO | Canonical URL, OG links, Twitter links, redirects, sitemap | Still branded to Excalidraw | [excalidraw-app/index.html](C:/Users/adars/OneDrive/Desktop/excal-ai/excalidraw-app/index.html:28), [vercel.json](C:/Users/adars/OneDrive/Desktop/excal-ai/vercel.json:9), [public/robots.txt](C:/Users/adars/OneDrive/Desktop/excal-ai/public/robots.txt:13) | Replace with your domain and assets |
| Browser local storage / IndexedDB keys | Data saved in the user’s browser, like scene state/theme/collab name | Still use `excalidraw-*` keys | [excalidraw-app/app_constants.ts](C:/Users/adars/OneDrive/Desktop/excal-ai/excalidraw-app/app_constants.ts:39) | Rename to `excal-ai-*` or your chosen namespace |
| Cookie names | Small browser flags, including Plus auth state | Still use upstream cookie names | [excalidraw-app/app_constants.ts](C:/Users/adars/OneDrive/Desktop/excal-ai/excalidraw-app/app_constants.ts:55) | Rename to your own auth/session cookie scheme |
| Window/tab identifiers | Same-tab flows for libraries and exports | Still use Excalidraw identifiers | [excalidraw-app/index.html](C:/Users/adars/OneDrive/Desktop/excal-ai/excalidraw-app/index.html:162) | Rename when rebranding browser-level integration |
| Firebase rules/indexes scaffold | Infra config for Firebase | Repo already contains a base scaffold | [firebase-project/firebase.json](C:/Users/adars/OneDrive/Desktop/excal-ai/firebase-project/firebase.json:1) | Reuse with your own Firebase project |

## Reuse vs Build

| Item | Upstream reusable? | My current take |
| --- | --- | --- |
| `excalidraw-store` | Yes | Strongest reuse candidate |
| `excalidraw-room` | Partly | Reusable base, likely needs testing/patching |
| `excalidraw-libraries-server` | Weakly | Reference code, likely modernization needed |
| `excalidraw-libraries` | Yes, but content only | Good source/content repo, not your backend |
| AI backend | No clear turnkey repo found | Build your own |
| Plus/product backend | No clear turnkey repo found | Build your own |

## Recommended order

1. Own domain, envs, branding, local keys
2. Switch Firebase to your own project
3. Test `excalidraw-store` against current app contract
4. Test `excalidraw-room` against current app contract
5. Modernize/build library backend
6. Build your AI backend
7. Build your product/auth layer

## Plain conclusion

Yes, we can move forward without removing features.

The practical model is:

- **reuse** where upstream repos are still good
- **fork and patch** where upstream is old but useful
- **build fresh** where no maintained backend is exposed
