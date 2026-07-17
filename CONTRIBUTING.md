# Contributing to Drawsy

Drawsy extends Excalidraw with a visual workspace and agent experience. Contributions should preserve the editor's open, editable scene model and keep product-specific behavior isolated to the Drawsy application layer whenever possible.

By participating, you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Before opening a change

- Search existing issues and pull requests.
- Keep the change focused; avoid unrelated cleanup or broad renames.
- For vulnerabilities, follow [SECURITY.md](./SECURITY.md) instead of opening a public issue.
- If the problem belongs to Excalidraw's unmodified core, check the [upstream project](https://github.com/excalidraw/excalidraw) first.

## Repository map

- `excalidraw-app/` — Drawsy web application and product-specific integrations.
- `packages/excalidraw/` — core Excalidraw React editor.
- `packages/` — shared Excalidraw packages.
- `research/` — product research and feature contracts, including `DRAW.md`.
- `public/` — static assets and bundled libraries.

Prefer `excalidraw-app/` for Drawsy features. Modify `packages/excalidraw/` only when the editor API or core behavior genuinely requires it.

## Development setup

Requirements:

- Node.js 18 or newer
- Yarn 1.22.22

```bash
git clone https://github.com/adarshnagrikar14/drawsy-ai.git
cd excal-ai
yarn install
yarn start
```

The app starts at `http://localhost:3001` using `.env.development`. Complete AI, connector, collaboration, and storage flows depend on the separately maintained Drawsy services; the editor itself remains locally runnable.

## Making a change

1. Create a focused branch.
2. Follow the existing TypeScript, React, SCSS, and test patterns.
3. Add or update tests for observable behavior.
4. Keep user-facing behavior dynamic—do not hardcode data merely to complete a scenario.
5. Verify that light/dark themes and existing canvas content remain intact.

For agent-facing work, preserve these boundaries:

- the current surface is the default scope;
- additional context is explicit and inspectable;
- canvas changes remain editable and reviewable;
- connector access is account/capability scoped; and
- failures must be visible rather than silently replaced with guessed output.

## Validation

Run the checks relevant to your change. Before a pull request, the normal baseline is:

```bash
yarn test:typecheck
yarn test:app --watch=false
yarn build
```

Formatting and linting:

```bash
yarn test:code
yarn test:other
```

Use `yarn fix` only when you intend to apply repository-wide formatter and lint fixes; review its diff carefully.

## Pull requests

Include:

- the user problem and chosen behavior;
- the affected surface and any service dependency;
- tests or a concise manual verification path;
- screenshots or a short recording for visible changes; and
- any known limitation or follow-up.

Do not include credentials, provider tokens, private customer data, or generated workspace files.

## Excalidraw attribution

Drawsy is an enhancement of [Excalidraw](https://github.com/excalidraw/excalidraw). Preserve upstream copyright, license, and attribution. Contributions that are generally useful to the core editor may be better proposed upstream.
