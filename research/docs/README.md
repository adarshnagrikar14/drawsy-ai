# Excalidraw Official Docs Research

Date: 2026-06-20

Sources:
- Live docs: https://docs.excalidraw.com/docs
- Local source mirror: `dev-docs/docs`
- Sidebar source: `dev-docs/sidebars.js`
- Code validation: `packages/excalidraw`, `excalidraw-app`

## What This Folder Contains

1. `00-docs-map.md` - full official docs structure and every page covered.
2. `01-development-self-hosting.md` - local dev, commands, Docker, self-hosting reality.
3. `02-react-package-integration.md` - how `@excalidraw/excalidraw` is meant to be embedded.
4. `03-api-surface.md` - props, `excalidrawAPI`, render props, constants.
5. `04-persistence-export-restore.md` - files, JSON, restore, export, clipboard, libraries.
6. `05-ui-extension-points.md` - sidebars, menus, welcome screen, footer, collaboration trigger.
7. `06-mermaid-to-excalidraw.md` - parser package and diagram conversion limits.
8. `07-codebase-formats.md` - `.excalidraw`, clipboard schema, frames ordering.
9. `08-ai-plus-workspace-gaps.md` - what official docs do not provide.
10. `09-surprise-leads.md` - high-value findings likely easy to miss.
11. `10-self-hostable-moving-parts.md` - self-hostable infra, current env dependencies, and OSS replacement path.

## Short Answer

The official docs are not Plus docs. They are developer docs for the open-source editor and npm packages.

The useful lead: the public package already exposes enough primitives to build a self-hosted workspace layer around Excalidraw:

- load initial scene from your backend with `initialData`
- persist edits with `onChange`
- inject remote scenes with `excalidrawAPI.updateScene`
- persist images via `files`
- persist libraries via `onLibraryChange` / `useHandleLibrary`
- add your own account/workspace/profile UI via `Sidebar`, `MainMenu`, `Footer`
- export previews/assets via `exportToBlob`, `exportToSvg`, `exportToCanvas`

What is not in the docs: Plus workspace, billing, account management, cloud sync product backend, AI backend, or MCP/profile tabs.
