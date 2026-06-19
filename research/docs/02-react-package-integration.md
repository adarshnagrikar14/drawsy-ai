# React Package Integration

Package: `@excalidraw/excalidraw`

Local version: `0.18.0` in `packages/excalidraw/package.json`

## Install

Docs:

```bash
npm install react react-dom @excalidraw/excalidraw
yarn add react react-dom @excalidraw/excalidraw
```

Unreleased changes can be tested via:

```bash
@excalidraw/excalidraw@next
```

## Basic Import

```ts
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
```

The component fills 100% of its parent. Parent must have real width/height.

## Fonts / Assets

By default fonts load from CDN.

For self-hosting package assets:

1. copy `node_modules/@excalidraw/excalidraw/dist/prod/fonts` into served assets
2. set:

```js
window.EXCALIDRAW_ASSET_PATH = "/";
```

Code validation:

- `packages/excalidraw/fonts/ExcalidrawFontFace.ts` reads `window.EXCALIDRAW_ASSET_PATH`
- package changelog says it can be a string or string array of fallback paths
- `excalidraw-app/index.html` sets `window.EXCALIDRAW_ASSET_PATH = window.origin`

## Next.js

Docs say Excalidraw does not support SSR.

Use dynamic import with `ssr: false`.

For App Router, wrapper must be client-side:

```ts
"use client";
```

If you need utils/constants besides the component, create a wrapper component and dynamically import the wrapper.

## Preact

Preact needs special build behavior:

```ts
process.env.IS_PREACT = "true";
```

With Vite, define it manually:

```ts
define: {
  "process.env.IS_PREACT": JSON.stringify("true"),
}
```

## Browser Direct Usage

Docs provide import-map usage with React/ReactDOM externalized.

This is useful for demos, but for this repo/self-hosting the Vite app path is more relevant.

## Lead

You do not need to fork the whole app to embed Excalidraw in your own product. The official package gives a clean host-app integration path. Forking the app is useful only if you want to modify the official editor shell itself.
