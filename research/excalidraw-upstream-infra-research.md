# Excalidraw Upstream Infra Research

Last updated: 2026-06-12

## Goal

Check whether upstream Excalidraw infra repos are reusable as-is for `excal-ai`, or should be treated only as reference code.

## Repo Status Table

| Repo | Purpose | Last push | Open issues | Open PRs | Signals seen | Initial verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `excalidraw-room` | Collaboration websocket server | 2024-07-12 | 10 | 18 | README calls it an "Example of excalidraw collaboration server"; older TS/tooling; public Docker/pm2 setup exists | Reusable base, but not safe to call production-ready without compatibility testing |
| `excalidraw-store` | Encrypted share-link storage backend | 2026-02-26 | 0 | 11 | Small Express + Google Storage service; newer push activity than room | Best upstream candidate to reuse first |
| `excalidraw-libraries-server` | Library publish automation backend | 2022-09-22 | 0 | 0 | Very old; Firebase/functions automation; points to old local env flow | Reference code only until proven otherwise |
| `excalidraw-libraries` | Public libraries content repo | 2026-06-11 | 20 | 1.6k | Actively updated content repo, not your runtime backend | Useful as source/content model, not as backend infra |

## Evidence Notes

- Repo freshness was checked from GitHub metadata.
- Issue/PR counts were checked from current public GitHub repo pages.
- README/package signals were checked where relevant.
- `excalidraw-room` and `excalidraw-store` were also inspected via raw `README.md` / `package.json`.

## Current Take

`excalidraw-store` looks like the strongest reuse candidate.

`excalidraw-room` may still work, but I cannot honestly claim "no enhancements needed" yet because upstream itself frames it as an example server, not a guaranteed maintained production backend.

`excalidraw-libraries-server` looks stale enough that it should be assumed reference-only until tested.
