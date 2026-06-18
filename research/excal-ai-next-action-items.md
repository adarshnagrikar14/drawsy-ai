# Excal-AI Next Action Items

Last updated: 2026-06-14

## Purpose

This is the **next-step execution list** for turning the current Excalidraw fork into a fully owned `excal-ai` platform.

Important direction:

- keep all features
- do not remove capability as strategy
- move from **basic ownership** to **full platform control**
- reuse upstream where safe
- fork or rebuild only where necessary

## How To Read This

Each item below tells you:

- **why** it matters
- **what** exactly to do
- **output** expected
- **done when** it is actually complete

---

## Level 1: Basics

These are the first actions. Lowest risk. Highest clarity. Do these first.

| Priority | Action | Why this matters | Exact work | Output | Done when |
| --- | --- | --- | --- | --- | --- |
| 1 | Freeze current external dependency map | Prevent confusion about what still depends on upstream | Confirm and keep updated the env/service map from [research/excal-ai-dependency-map.md](C:/Users/adars/OneDrive/Desktop/excal-ai/research/excal-ai-dependency-map.md) | one source of truth | every external dependency has owner, current URL, replacement path |
| 2 | Standardize secrets handling | Keys should not float in chat/manual copy-paste forever | define exact env names for Excalidraw MCP, OpenAI, Firebase, AI backend, analytics | `.env.local` contract or secret manager contract | every secret has one official variable name |
| 3 | Add local Codex MCP config for Excalidraw | So Excalidraw workspace tools are available intentionally every session | configure `.codex/config.toml` or user config with the Excalidraw MCP endpoint | working MCP connection | tools can list scenes/workspace without manual probing |
| 4 | Create “ownership vocabulary” | Avoid ambiguity later | decide names for product, workspace, domains, cookie prefix, localStorage prefix, env prefix | naming sheet | names are fixed and reusable |
| 5 | Brand inventory pass | Rebrand work becomes predictable instead of scattered | list all visible Excalidraw references: title, favicon, meta, canonical, redirects, logos, cookie/local keys, plus links | research note or checklist | user-facing brand touchpoints are fully listed |

### Recommended immediate outputs

1. `secret variable naming`
2. `MCP setup confirmed`
3. `brand naming checklist`

---

## Level 2: Easy

These are straightforward engineering tasks with low architectural risk.

| Priority | Action | Why this matters | Exact work | Output | Done when |
| --- | --- | --- | --- | --- | --- |
| 6 | Create your own Firebase project | Fastest way to stop using their Firebase while keeping current app flow alive | create project, storage bucket, Firestore, apply `firebase-project/` rules/indexes, replace `VITE_APP_FIREBASE_CONFIG` | owned Firebase backend | app points to your Firebase, not theirs |
| 7 | Prepare env files for owned services | Makes migration stepwise and clean | define placeholders for your share, collab, library, AI, analytics, app URLs | env contract | every external URL has a planned owned equivalent |
| 8 | Rebrand browser-local identifiers | Prevent local browser state overlap with upstream | rename keys in [excalidraw-app/app_constants.ts](C:/Users/adars/OneDrive/Desktop/excal-ai/excalidraw-app/app_constants.ts:39) | owned local keys | no `excalidraw-*` browser storage keys remain for product identity |
| 9 | Rebrand SEO/deployment metadata | Required for true product ownership | replace canonical, OG, twitter URLs, robots sitemap, Vercel redirects | owned metadata | no `excalidraw.com` references remain in active app metadata |
| 10 | Replace Sentry/analytics config | Ownership and privacy baseline | point Sentry/tracking to your stack or intentionally disable until ready | owned telemetry setup | no production telemetry goes to upstream |

### Best first implementation order inside Easy

1. Firebase project
2. env placeholders
3. browser-local keys
4. metadata
5. telemetry

---

## Level 3: Medium

These are proof-of-compatibility tasks. They answer “can we reuse this safely?”

| Priority | Action | Why this matters | Exact work | Output | Done when |
| --- | --- | --- | --- | --- | --- |
| 11 | Test `excalidraw-store` against current fork | This is the best upstream reuse candidate for share-link backend | run the upstream store locally/in test env, point `VITE_APP_BACKEND_V2_*` to it, verify create/open shared scene flow | compatibility report | create + fetch shared scene works end-to-end |
| 12 | Test `excalidraw-room` against current fork | Needed to know whether collaboration can be reused or must be patched | run room server, point `VITE_APP_WS_SERVER_URL` to it, verify socket connect, multi-user updates, cursors, reconnect behavior | compatibility report | 2-browser collaboration works reliably |
| 13 | Check library submit/browse contract | Clarifies whether the library feature can be preserved with light effort | trace browse URL and submit payloads, compare against `excalidraw-libraries-server` and `excalidraw-libraries` repo expectations | library contract note | you know whether to reuse, fork, or redesign the backend |
| 14 | Confirm image/file persistence behavior | Important because scenes contain uploaded assets | verify save/load of images with your Firebase project and scene sharing/collab flows | file persistence test report | uploaded assets survive reload/share/collab |
| 15 | Verify export-related product flows | Some “Plus-like” features may depend on app URLs or product auth | test export-to-plus related code paths and identify which ones need your backend | product-flow note | every Plus-linked flow is classified as rebrand / rebuild / keep |

### Medium-level truth you want

At the end of this stage, you should know:

- what can be reused untouched
- what must be forked
- what must be rebuilt

---

## Level 4: Hard

These require real engineering decisions and likely code changes across app + backend.

| Priority | Action | Why this matters | Exact work | Output | Done when |
| --- | --- | --- | --- | --- | --- |
| 16 | Fork and modernize `excalidraw-room` if needed | Collaboration is core and cannot stay uncertain | patch protocol mismatches, update deps, harden reconnect/session behavior, document deployment | owned collab service | stable collaboration works on your infra |
| 17 | Build or modernize library backend | Needed to keep user-facing library ecosystem truly yours | implement submit/approve/store/browse library flow | owned library backend | browse + publish libraries work on your domain |
| 18 | Build your AI backend | Current AI endpoint is not yours | define prompts, provider, rate limits, auth, quotas, response contract | owned AI service | in-app AI flows work against your backend |
| 19 | Build your auth/product backend | Needed if you want real “Plus/account/workspace” ownership | sign-in, session, billing-awareness, workspace management, feature gating | owned account system | product links and gated features no longer depend on upstream |
| 20 | Replace direct Firebase adapter if desired | Optional, but cleaner long-term if you want full infra freedom | abstract [excalidraw-app/data/firebase.ts](C:/Users/adars/OneDrive/Desktop/excal-ai/excalidraw-app/data/firebase.ts:1) behind your own service/storage adapter | owned persistence architecture | app no longer assumes Firebase directly |

### Hard-stage decision

You must choose one of these long-term directions:

- **pragmatic**: keep your own Firebase for a long time
- **fully custom**: replace Firebase with your own persistence/storage stack

Both are valid. The first is faster.

---

## Level 5: Very Hard / Platform Maturity

These are not first-wave tasks. These are scale, safety, and product-hardening tasks.

| Priority | Action | Why this matters | Exact work | Output | Done when |
| --- | --- | --- | --- | --- | --- |
| 21 | Full audit logging and admin controls | Important once teams/users grow | retain logs for scenes, invites, role changes, API key use, exports | admin/security layer | all critical workspace actions are traceable |
| 22 | Backup + recovery strategy | Scene data is core business data | backups for scenes, assets, libraries, workspace metadata | disaster recovery process | restore path is tested |
| 23 | Local-dev full stack | Makes engineering repeatable | one command or one doc to run app + share + collab + persistence + AI locally | dev stack guide | new machine can start full stack reliably |
| 24 | Migration tooling | Useful if moving users/data between systems later | write scripts for storage moves, metadata transforms, asset repair | migration toolkit | migration can be tested safely |
| 25 | Performance + cost hardening | Important once usage grows | CDN strategy, cache strategy, websocket scaling, image storage cost, AI rate/cost control | scale plan | traffic increase does not break economics or UX |

---

## Recommended Order: Practical Execution

This is the clearest order if you want momentum without chaos.

### Phase A: Ownership Foundation

1. standardize secrets
2. wire Excalidraw MCP properly
3. finalize naming and branding checklist
4. create your Firebase project
5. prepare owned env placeholders

### Phase B: Low-Risk Ownership Changes

1. switch app to your Firebase
2. rename local browser keys and cookies
3. replace metadata / domain references
4. replace or disable upstream telemetry

### Phase C: Reuse Validation

1. test `excalidraw-store`
2. test `excalidraw-room`
3. verify library contract
4. verify image/file persistence

### Phase D: Product Infrastructure

1. fork/patch collab if needed
2. modernize or build library backend
3. build AI backend
4. build auth/product backend

### Phase E: Platform Hardening

1. backups
2. admin/audit
3. local dev stack
4. migration tooling
5. cost/performance hardening

---

## My Recommendation

If the goal is **fastest path to a truly owned product**, do this:

### Start now

- own Firebase first
- keep current app behavior
- test `excalidraw-store`
- test `excalidraw-room`

### Do not start with

- full custom storage rewrite
- full auth/billing redesign
- AI backend before share/collab basics

Reason:

The fastest real progress comes from replacing **what the current code already expects**, before redesigning architecture.

---

## Definition Of Success

You are in a good place when all of this becomes true:

- scenes are stored on your infra
- file/image assets are stored on your infra
- collaboration runs on your infra
- shared scene links run on your infra
- libraries are served/published on your infra
- AI calls go to your infra
- product links/accounts/workspaces are yours
- branding, cookies, browser keys, SEO, telemetry are yours

That is the real “everything enabled, but ours” finish line.
