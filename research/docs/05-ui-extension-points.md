# UI Extension Points

## Children Components Model

Official package supports rendering child components inside `<Excalidraw>`.

This is how host apps extend UI without forking the editor.

## Main Menu

Docs expose:

- `<MainMenu>`
- `MainMenu.Item`
- `MainMenu.ItemLink`
- `MainMenu.ItemCustom`
- `MainMenu.DefaultItems`
- `MainMenu.Group`

Use cases:

- add custom Save to Workspace
- add Login/Profile
- add Export to Backend
- add AI actions
- replace/hide default entries

## Sidebar

Docs expose:

- `<Sidebar name="...">`
- `Sidebar.Header`
- `Sidebar.Tabs`
- `Sidebar.Tab`
- `Sidebar.TabTriggers`
- `Sidebar.TabTrigger`
- `Sidebar.Trigger`

Important props:

- `name`
- `onStateChange`
- `docked`
- `onDock`
- `className`
- `style`

Lead:

This is the clean place to build the missing “workspace/profile/MCP” UI without patching canvas internals.

Code validation:

- `excalidraw-app/components/AppSidebar.tsx` already adds `comments` and `presentation` tabs to the default sidebar
- those tabs are mostly Plus promo/placeholder in this fork, not full product features

## Footer

Docs expose `<Footer>`.

Use it for persistent buttons/triggers in the editor shell.

## Welcome Screen

Docs expose:

- `WelcomeScreen.Center`
- `Logo`
- `Heading`
- `Menu`
- `MenuItem`
- `Hints`
- `MenuHint`
- `ToolbarHint`
- `Help`

This allows onboarding/custom first-run UX.

## LiveCollaborationTrigger

Docs expose UI trigger only.

Important:

This is not a collaboration backend. It is a button component for host apps that already implement collaboration behavior.

Code validation:

- `excalidraw-app/App.tsx` renders `LiveCollaborationTrigger`
- real room behavior is in `excalidraw-app/collab/Collab.tsx`

## Embeddables

Docs expose:

- `validateEmbeddable`
- `renderEmbeddable`

This lets a host app decide which URLs can become iframes and how they render.

Security note:

Do not pass `validateEmbeddable={true}` in a serious production app unless you fully accept arbitrary iframe risks.
