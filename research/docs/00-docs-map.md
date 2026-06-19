# Official Docs Map

Canonical live entry: https://docs.excalidraw.com/docs

Canonical local source: `dev-docs/docs`

## Sidebar Structure

The docs sidebar is explicitly defined in `dev-docs/sidebars.js`.

## Introduction

- `introduction/get-started.mdx`
  - intro page
  - points users to `excalidraw.com`
  - explains that docs are developer-focused
- `introduction/development.mdx`
  - local setup
  - commands
  - collaboration server note
  - Docker/self-hosting note
- `introduction/contributing.mdx`
  - contribution setup
  - PR title/testing guidance
  - translation notes

## Codebase

- `codebase/json-schema.mdx`
  - `.excalidraw` local file JSON format
  - clipboard JSON format
  - `elements`, `appState`, `files`
- `codebase/frames.mdx`
  - frame ordering rule
  - frame children must come before frame element

## `@excalidraw/excalidraw`

- `installation.mdx`
  - npm/yarn package install
  - font self-hosting via `window.EXCALIDRAW_ASSET_PATH`
  - container must have non-zero dimensions
- `integration.mdx`
  - bundler import
  - Next.js client-only import
  - Preact build flag
  - browser/import-map usage
- `customizing-styles.mdx`
  - CSS overrides and custom styling notes
- `faq.mdx`
  - collaboration support answer
  - Brave anti-fingerprinting issue
  - `process is not defined`
- `development.mdx`
  - package example app
  - package release notes

## `@excalidraw/excalidraw` API

- `api/api-intro.mdx`
  - API section intro
- `api/props/props.mdx`
  - component props
  - custom data
  - collaboration flag
  - persistence hooks
  - links, paste, files, embeddables
- `api/props/initialdata.mdx`
  - initial scene/app/library/file data
- `api/props/excalidraw-api.mdx`
  - imperative API exposed after render
- `api/props/render-props.mdx`
  - top-right UI
  - custom stats
  - custom embeddable renderer
- `api/props/ui-options.mdx`
  - canvas actions
  - export options
  - docked sidebar breakpoint
  - tools
- `api/children-components/children-components-intro.mdx`
  - child component model
- `api/children-components/main-menu.mdx`
  - custom main menu and default items
- `api/children-components/welcome-screen.mdx`
  - welcome screen customization
- `api/children-components/sidebar.mdx`
  - custom sidebar and tabs
- `api/children-components/footer.mdx`
  - custom footer
- `api/children-components/live-collaboration-trigger.mdx`
  - collab trigger UI component only
- `api/utils/utils-intro.md`
  - JSON/library serialization
  - file loading
  - library import hooks
  - geometry utilities
  - i18n
- `api/utils/export.mdx`
  - canvas/blob/SVG/clipboard export APIs
- `api/utils/restore.mdx`
  - restore scene/app/elements/library APIs
- `api/constants.mdx`
  - `FONT_FAMILY`, `THEME`, `MIME_TYPES`
- `api/excalidraw-element-skeleton.mdx`
  - programmatic element creation
  - `convertToExcalidrawElements`
  - frames, arrows, bindings, containers

## `@excalidraw/mermaid-to-excalidraw`

- `installation.mdx`
  - install package
  - basic usage
  - playground
- `api.mdx`
  - `parseMermaidToExcalidraw`
  - flowchart support
  - unsupported diagram fallback behavior
- `development.mdx`
  - local parser development
  - playground server
  - test release
- `codebase/codebase.mdx`
  - package internals overview
- `codebase/parser/parser.mdx`
  - Mermaid render-to-SVG plus parser flow
- `codebase/parser/flowchart.mdx`
  - vertex/edge/subgraph extraction
- `codebase/new-diagram-type.mdx`
  - how to add a new Mermaid diagram parser

## Docs Not Present

No official docs page exists here for:

- Excalidraw Plus app internals
- Plus billing/subscriptions
- Plus workspaces/team management
- account profile screen
- MCP tab
- AI generation backend
- cloud document management backend
