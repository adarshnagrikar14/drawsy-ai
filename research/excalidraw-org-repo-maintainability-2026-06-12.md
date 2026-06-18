## Excalidraw Org Repo Maintainability Check

As of 2026-06-12, based on public GitHub org/repo pages.

| Repo | Last push | Open issues | Open PRs | README/package signal | Short verdict |
| --- | --- | ---: | ---: | --- | --- |
| `excalidraw-room` | 2024-07-12 | 10 | 18 | README explicitly says "Example of excalidraw collaboration server" | Good reference/base, but not safe to treat as actively production-maintained infra without testing. |
| `excalidraw-store` | 2026-02-26 | 0 | 11 | README describes the live encrypted share storage server and includes deploy commands | Strongest reuse candidate here; looks closer to deployable service than sample code, but still needs compatibility validation. |
| `excalidraw-libraries-server` | 2022-09-22 | 0 | 0 | README says "Automate the process of excalidraw libraries" and focuses on Firebase/local publishing automation | Old automation/support repo, not something I would assume is current production backend. |
| `excalidraw-libraries` | 2026-06-11 | 20 | 1.6k | README says "Collection of publicly available libraries" | Clearly active as a content/submission repo, but not a backend service; huge PR count is workflow/content backlog, not infra maturity. |

### Source Links

- Org repos: https://github.com/orgs/excalidraw/repositories
- Room: https://github.com/excalidraw/excalidraw-room
- Store: https://github.com/excalidraw/excalidraw-store
- Libraries server: https://github.com/excalidraw/excalidraw-libraries-server
- Libraries: https://github.com/excalidraw/excalidraw-libraries
