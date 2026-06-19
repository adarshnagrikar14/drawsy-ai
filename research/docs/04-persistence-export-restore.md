# Persistence, Export, Restore

## Scene Persistence Model

The docs do not provide a backend. They provide the client-side hooks to build one.

Minimal backend loop:

1. Load document from backend.
2. Pass it as `initialData`.
3. Subscribe to `onChange(elements, appState, files)`.
4. Save `elements`, selected `appState`, and `files`.
5. Restore with `initialData` or `excalidrawAPI.updateScene`.

## Files

Images and binary assets are represented in `files`.

Docs reference `BinaryFiles`; code stores file data separately from element records.

Important:

- image elements reference file ids
- `excalidrawAPI.getFiles()` can include files not referenced by active elements
- backend should garbage-collect unreferenced files by comparing files against elements

## JSON Serialization

Docs expose:

- `serializeAsJSON`
- `serializeLibraryAsJSON`

`serializeAsJSON` removes deleted elements and most non-persistable `AppState`.

You can set:

```js
window.EXCALIDRAW_EXPORT_SOURCE = "your-app-name";
```

to overwrite the `source` field in exported JSON.

## Load From Files

Docs expose:

- `loadFromBlob`
- `loadLibraryFromBlob`
- `loadSceneOrLibraryFromBlob`

These load `.excalidraw` or library files and return restored data.

## Restore APIs

Docs expose:

- `restoreAppState`
- `restoreElements`
- `restore`
- `restoreLibraryItems`

Use restore functions when loading old/foreign/stored data. They normalize missing fields and migrate shape.

Code validation:

- `excalidraw-app/App.tsx` uses `restoreElements` and `restoreAppState` during local/import flows
- `excalidraw-app/collab/Collab.tsx` restores remote elements
- `packages/excalidraw/tests/data/restore.test.ts` has broad migration tests

## Export APIs

Docs expose:

- `exportToCanvas`
- `exportToBlob`
- `exportToSvg`
- `exportToClipboard`

Export inputs:

- `elements`
- `appState`
- `files`
- dimensions/padding/options

Export appState options include:

- `exportBackground`
- `viewBackgroundColor`
- `exportWithDarkMode`
- `exportEmbedScene`

Lead:

`exportEmbedScene` can embed scene data into PNG/SVG. Useful for portable files, dangerous for private product diagrams if users think they exported only an image.

## Library Handling

Docs expose:

- `parseLibraryTokensFromUrl`
- `useHandleLibrary`
- `mergeLibraryItems`

Docs say future support may add library persistence to browser storage.

Code/changelog validation:

- `packages/excalidraw/CHANGELOG.md` mentions newer `useHandleLibrary` adapter and migration adapter patterns.

Lead:

The docs page looks slightly behind the package changelog. For serious library persistence, check current types/source before implementing only from docs.
