# Development And Self-Hosting

## Local Dev

Official docs say:

- install Node.js, Yarn, Git
- clone repo
- run `yarn`
- run `yarn start`
- open local app

Code validation:

- root script: `package.json` -> `start: yarn --cwd ./excalidraw-app start`
- app script after our fix: `excalidraw-app/package.json` -> `start: vite`
- Vite app currently runs on port from env/config, seen locally as `3001`

## Commands

Official docs list:

- `yarn` - install dependencies
- `yarn start` - run project
- `yarn fix` - prettier + eslint fix
- `yarn test` - app tests
- `yarn test:update` - snapshots
- `yarn test:code` - formatting/lint
- `docker-compose up --build -d` - Docker dev

Root package also exposes more:

- `yarn build`
- `yarn build:app`
- `yarn build:packages`
- `yarn test:typecheck`
- `yarn clean-install`

## Collaboration

Official docs say local collaboration needs `excalidraw-room`:

- https://github.com/excalidraw/excalidraw-room

Code validation:

- app has `excalidraw-app/collab/Collab.tsx`
- app has Firebase data layer in `excalidraw-app/data/firebase.ts`
- envs include collaboration/share-related settings

Conclusion:

The UI/client wiring exists, but a real self-hosted collaboration/share experience needs external services.

## Self-Hosting

Official docs mention Docker image:

- Docker Hub image: `excalidraw/excalidraw`
- manual Docker build/run possible
- image is free of analytics/tracking libraries

Official docs also state a hard limitation:

> Self-hosting your own instance doesn't support sharing or collaboration features.

Interpretation:

This means the plain published self-hosted client is not a complete Excalidraw cloud clone. Sharing/collab require backend/Firebase/collab services.

## Production Hosting

For static hosting/Vercel:

- editor frontend can be built and served
- basic infinite canvas works
- share/collab/AI/Plus-like flows need envs plus backend services

The `yarn start` fix is dev-only and does not change production build behavior.
