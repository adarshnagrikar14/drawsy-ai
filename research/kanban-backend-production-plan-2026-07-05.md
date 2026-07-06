# Kanban Backend Production Plan

Date: 2026-07-05

## Outcome

Ship Kanban as a secure, local-first, multi-user workspace feature whose UI never waits for a network write. The backend is authoritative for access, durable state, ordering, revisions, invitations, and audit history. The browser remains authoritative only for unacknowledged local operations.

This is a production cutover plan, not an MVP roadmap. Kanban cloud sync must stay behind one feature flag until every security, migration, recovery, invitation, realtime, and test gate in this document passes. There is no supported partially-synced mode.

## Repository Findings

### Current Kanban

- `excal-ai/excalidraw-app/data/KanbanStore.ts` stores one schema-v1 board in synchronous `localStorage`.
- Kanban state is independent of the authenticated workspace and has no remote version, outbox, membership, or conflict model.
- Cards currently contain title, free-text assignee, progress, priority, description, date-only due date, canvas-tag strings, checklist items, and timestamps.
- UI mutations call `onChange` immediately. This interaction model should remain immediate; only persistence changes.

### Existing reusable workspace foundation

- `drawsy-ai-backend` already verifies Firebase ID tokens server-side, uses exact-origin CORS, Helmet, Zod request validation, request IDs, structured errors, Firestore transactions, optimistic versions, and encrypted R2 scene storage.
- `excal-ai` already has an IndexedDB local-first workspace, dirty flags, pending deletes, cross-tab notifications, Web Locks, retry, remote reconciliation, and version-conflict tests.
- `drawsy-ai-wss` currently relays encrypted Excalidraw room payloads but does not authenticate users or authorize room joins. Its existing canvas protocol must not be reused as Kanban authorization.
- `drawsy-ai-store` is an encrypted share-link payload service and is not a Kanban database.
- `drawsy-ai-r2` is a presigned object service with no permanent authorization. It must not be involved in Kanban metadata or invitations.

## Fixed Architectural Decisions

1. `drawsy-ai-backend` owns all Kanban HTTP APIs, authorization, validation, commands, invitation state, encryption, audit records, and snapshots.
2. Firestore is the Kanban source of truth because it is already the authenticated workspace metadata store and supports the required atomic transactions.
3. Kanban content is normalized into board, column, card, checklist, membership, invitation, event, and operation records. A whole board is not written as one document.
4. The frontend is local-first. Every interaction updates React state immediately and durably records the desired board in IndexedDB. No UI handler awaits HTTP or realtime completion.
5. HTTP pull/command APIs are the correctness path. An authenticated backend SSE stream contains revision invalidations only; missing or duplicate stream messages cannot lose data.
6. `drawsy-ai-wss` stays isolated to Excalidraw canvas collaboration. Kanban does not add another protocol or authorization model to that service.
7. Board access is explicit and role-based. Knowing a board ID, card ID, canvas tag, or invite URL is never authorization.
8. Board invitations do not implicitly share linked canvases. Canvas access continues to use canvas authorization. Unauthorized canvas references return a restricted placeholder without title or scene metadata.
9. Sensitive Kanban content is application-layer encrypted at rest with per-board data keys. TLS protects all external traffic. This is server-side envelope encryption, not end-to-end encryption, and must not be marketed as E2EE.
10. Production release is all-or-nothing behind a feature flag. Local schema migration, backend APIs, invites, realtime invalidation, recovery, and observability ship together.

## System Shape

```text
Kanban UI
  -> immediate in-memory state
  -> IndexedDB board cache + durable operation outbox
  -> background Sync Coordinator
       -> authenticated command batches -> drawsy-ai-backend
       -> snapshot/delta pulls          -> drawsy-ai-backend
       -> authenticated revision stream -> drawsy-ai-backend SSE

drawsy-ai-backend
  -> Firebase ID token verification with revocation checks
  -> board ACL and command validation
  -> Firestore transaction
       -> normalized board state
       -> deduplication result
       -> ordered board event
       -> immutable audit entry
  -> versioned master-key-wrapped per-board AES-256-GCM data key
  -> multiplexed Firestore board/member listeners for active SSE clients

drawsy-ai-wss
  -> unchanged canvas-only encrypted collaboration relay
```

## Domain Model

### Board

Operational fields remain readable to the backend datastore; user content is encrypted.

- `id`
- `schemaVersion`
- `ownerId`
- `revision`: monotonic server integer
- `status`: `active | trashed | deleting`
- `encryptedPayload`: title, roughness, card radius, lock setting
- `encryptedDataKey`, `keyVersion`, `encryptionVersion`
- `createdAt`, `updatedAt`, `trashedAt`

### Column

- `id`, `boardId`
- `rank`: server-generated sortable rank
- `encryptedPayload`: title and presentation settings
- `version`
- `createdAt`, `updatedAt`, `deletedAt`

### Card

- `id`, `boardId`, `columnId`
- `rank`
- `version`
- `fieldVersions`: per editable field, for conflict-safe non-overlapping merges
- `assigneeIds`: authorized member IDs used for assignment lookup
- `encryptedPayload`:
  - title
  - description
  - priority
  - progress
  - `dueDate` as `YYYY-MM-DD`, not a UTC timestamp
  - preserved legacy assignee text
  - canvas-link labels only after access-safe resolution
- `createdBy`, `updatedBy`
- `createdAt`, `updatedAt`, `deletedAt`

### Checklist item

Checklist items are separate records so concurrent edits do not rewrite the whole card.

- `id`, `boardId`, `cardId`
- `rank`
- `completed`
- `version`, `fieldVersions`
- `encryptedPayload`: title
- `createdBy`, `updatedBy`
- `createdAt`, `updatedAt`, `deletedAt`

### Canvas link

- `id`, `boardId`, `cardId`, `canvasId`
- no copied scene data
- no durable copied canvas title
- resolution always checks the current caller's canvas permission
- unauthorized or deleted canvas returns `{ state: "restricted" }`

Legacy string tags such as `@canvas1` are migrated as `legacyCanvasTags` and remain display-only. New links must be selected by stable canvas ID. This preserves old content without pretending a string is an authorized resource link.

### Member

- `boardId`, `userId`
- `role`: `owner | editor | viewer`
- `membershipVersion`
- `invitedBy`, `joinedAt`, `updatedAt`, `removedAt`

Permissions:

- Owner: read, mutate, invite, revoke, change roles, transfer ownership, trash/restore/delete board.
- Editor: read and mutate board content; cannot manage members or board lifecycle.
- Viewer: read only; cannot enqueue server-accepted content mutations.
- Exactly one owner is required. Ownership transfer is atomic; the owner cannot leave or be removed first.

### Invitation

- `id`, `boardId`
- `tokenDigest`: SHA-256 digest of a random 256-bit token; raw token is never stored
- `encryptedPayload`: normalized invited email and optional message
- `emailMatchDigest`: keyed HMAC for equality checks without plaintext email storage
- `role`: `editor | viewer`
- `status`: `pending | accepted | revoked | expired`
- `createdBy`, `createdAt`, `expiresAt`, `acceptedBy`, `acceptedAt`

### Operation and event

- Operation result records deduplicate `operationId` and retain the canonical result for safe retries.
- Board events have a monotonic `revision`, event type, affected entity IDs, actor, and server timestamp.
- Event payloads contain only the minimum delta needed by authorized clients and use the board's encryption envelope when they include user content.
- Audit entries record actor, action, resource, request ID, outcome, and timestamp without plaintext card content.

## Firestore Layout

```text
kanbanBoards/{boardId}
  columns/{columnId}
  cards/{cardId}
  checklistItems/{itemId}
  canvasLinks/{linkId}
  members/{userId}
  invitations/{invitationId}
  events/{zeroPaddedRevision}
  operations/{operationId}
  audit/{auditId}

users/{userId}/kanbanBoardRefs/{boardId}
kanbanInvitationTokens/{tokenDigest}
kanbanRateLimits/{limitId}
```

`kanbanBoardRefs` is a transactionally maintained listing index, not an authority. Every resource request checks the canonical membership under the board. Direct browser Firestore access is denied; Firebase Admin access is backend-only.

## Ordering Without Array Rewrites

- Columns, cards, and checklist items use fractional sortable ranks.
- Move commands send `beforeId` and `afterId`, not a client-authored trusted rank.
- The server verifies both neighbors belong to the same destination and computes the canonical rank.
- Equal ranks are deterministically ordered by entity ID.
- Normal inserts use variable-length fractional ranks, so a move does not rewrite sibling records.
- New boards use the repository's CC0 variable-length fractional-indexing algorithm, which grows precision only inside a repeatedly edited gap and does not require sibling rewrites. The compatibility path recognizes earlier 64-hex development ranks and never mixes rank formats within a list.
- Concurrent moves are serialized by server commit order. The latest accepted move wins and remains recoverable through activity history.

This removes large `cardIds` array rewrites and keeps drag/drop responsive on long columns.

## Command Protocol

### Request envelope

`POST /v1/kanban/boards/:boardId/commands`

```json
{
  "clientId": "stable-device-tab-id",
  "commands": [
    {
      "operationId": "random-id",
      "clientSequence": 42,
      "knownBoardRevision": 108,
      "type": "updateCardFields",
      "entityId": "card-id",
      "baseFieldVersions": { "title": 7 },
      "payload": { "title": "Ready for review" }
    }
  ]
}
```

Supported command families are complete at launch:

- board title/settings/lock
- column create/update/move/delete
- card create/update/move/delete/restore
- checklist create/update/toggle/move/delete/restore
- assignee set/unset
- typed canvas link create/delete

The API accepts a bounded ordered batch and processes commands sequentially as individual Firestore transactions. Each result is independently idempotent. A network failure after partial processing is safe because retrying returns stored results for completed operation IDs.

### Transaction invariants

For every command, the backend:

1. authenticates the user with a revocation-checked Firebase ID token;
2. reads canonical membership and verifies the required role;
3. rejects trashed/deleting boards;
4. validates IDs, field lengths, enum values, counts, payload bytes, references, and command shape;
5. returns the stored result if `operationId` already exists;
6. applies field-level conflict rules and domain invariants;
7. writes entity changes, increments board revision, and stores the operation result, encrypted event, and audit entry atomically;
8. returns the canonical entity revision and changed fields.

Client timestamps never determine ordering or authorization. Server timestamps and revisions are canonical.

## Conflict Policy

- Different fields on the same card merge using per-field versions.
- The same field edited concurrently returns `field_conflict` with the canonical value and version. The local draft is retained; it is never silently discarded.
- Drag/drop and ordering commands are server-serialized and automatically converge.
- Delete beats a concurrent update. The update returns `entity_deleted` and the UI offers restore when permitted.
- Checklist items conflict independently from their parent card.
- A removed member's queued writes receive `access_revoked`; they are not retried. The client keeps an exportable local recovery copy until the user discards it.
- A stale snapshot cursor receives `snapshot_required`, never an incomplete delta stream.
- Automatic retries occur only for transport failure, rate limiting, transient server failure, and safe version rebase. Validation and permission failures require user-visible resolution.

## Snapshot and Delta APIs

- `GET /v1/kanban/boards` — authorized board summaries and roles.
- `POST /v1/kanban/boards` — create board and owner membership atomically.
- `GET /v1/kanban/boards/:boardId/snapshot` — paginated canonical board state plus revision.
- `GET /v1/kanban/boards/:boardId/changes?afterRevision=N` — ordered deltas and latest revision.
- `POST /v1/kanban/boards/:boardId/commands` — idempotent mutation batch.
- `GET /v1/kanban/boards/:boardId/events` — authenticated SSE revision/role/revocation stream.
- `GET /v1/kanban/boards/:boardId/members` — owner and member list.
- `PATCH /v1/kanban/boards/:boardId/members/:userId` — role change.
- `DELETE /v1/kanban/boards/:boardId/members/:userId` — revoke access or leave.
- `POST /v1/kanban/boards/:boardId/ownership-transfer` — atomic transfer with recent-auth requirement.
- `POST /v1/kanban/boards/:boardId/invitations` — create/rotate invitation and enqueue delivery.
- `GET /v1/kanban/boards/:boardId/invitations` — pending invitation list for owner.
- `DELETE /v1/kanban/boards/:boardId/invitations/:invitationId` — revoke.
- `POST /v1/kanban/invitations/inspect` — token in request body; returns minimal board/inviter context.
- `POST /v1/kanban/invitations/accept` — token in request body; atomic accept.
- `GET /v1/kanban/boards/:boardId/activity` — paginated authorized audit/activity feed.
- `DELETE /v1/kanban/boards/:boardId` — soft delete with recent auth.
- `POST /v1/kanban/boards/:boardId/restore` — restore during retention.

IDs are validated with the existing backend ID policy. Schemas reject unknown keys to prevent accidental over-posting. Pagination has stable revision/cursor semantics and configured maximum page sizes.

## Safe Invitation Flow

1. Only the owner can create an invitation.
2. The owner chooses a verified email, `editor` or `viewer`, and an expiry.
3. The backend normalizes the email, prevents privilege escalation and duplicate active invites, creates a random 256-bit token, and stores only its digest.
4. The invitation URL keeps the raw token in the URL fragment so proxies, access logs, analytics, and referrers do not receive it. The frontend sends it in the POST body.
5. Inspection reveals only board title, inviter display name, role, and expiry after the token digest matches. Responses are deliberately generic for invalid/revoked/expired tokens.
6. Acceptance requires an authenticated Firebase account with `email_verified=true` and a normalized email matching the invitation. Mismatch never grants access.
7. Acceptance atomically consumes the invite, creates membership, creates the user's board reference, increments membership/board revision, and invalidates existing stale capabilities.
8. Reusing, racing, revoking, or accepting an expired token is safe and deterministic.
9. Resending rotates the token; the prior token is revoked immediately.
10. Member removal and role downgrade emit `access_revoked` or `role_changed`, force a delta/ACL refresh, and block every subsequent queued write.

The initial complete delivery path is a copyable secure link. It does not claim that an email was sent. The raw token exists only in the creation response and URL fragment; logs never contain recipient email, raw token, or the full invitation URL.

## Authentication and Authorization

- Continue Firebase ID token verification with revocation checking.
- Require verified email for invitation acceptance and member-management operations.
- Require recent authentication (`auth_time` within configured policy) for ownership transfer and permanent deletion.
- Perform ACL checks in the service layer for every read and write, including snapshot pages, deltas, activity, canvas-link resolution, and realtime capability issuance.
- Never accept `userId`, role, owner ID, revision, or audit actor from the client as authority.
- Use constant-shape not-found/forbidden responses where resource enumeration is possible.
- Revalidate membership inside the same Firestore transaction that applies a mutation.
- Increment `membershipVersion` on role/revocation changes so issued realtime capabilities become stale.

## Realtime Channel

- Use `GET /v1/kanban/boards/:boardId/events` as an authenticated SSE stream with the Firebase bearer token in the request header.
- Authorize membership before opening the stream. Watch canonical board revision and member documents; do not create signal documents.
- Multiplex Firestore listeners inside each backend instance: one listener per active board and one per distinct active board/member, shared by tabs and SSE connections.
- Emit only:

```json
{
  "type": "revision",
  "latestRevision": 109
}
```

- Member-document deletion emits `access_revoked` and closes the affected stream; role version changes emit `role_changed`.
- Clients always fetch authenticated deltas after a revision. Reconnect starts from the last durable local revision.
- There is no periodic read polling. Initial open, stream revision, reconnect, browser `online`, focus regain, and a local command acknowledgement trigger delta pulls. Stream and write reconnects use bounded exponential backoff with jitter.
- SSE connection count, active board/member listener count, event rate, CORS origin, and authentication failures are bounded and measured.

## Encryption and Secret Handling

### At rest

- Generate a random AES-256 data-encryption key for every board.
- Encrypt content payloads with AES-256-GCM using a fresh 96-bit nonce per write.
- Bind ciphertext to board ID, entity type, entity ID, schema version, and key version as additional authenticated data. Ciphertext cannot be moved between records undetected.
- Wrap each board key with the current versioned Kanban master key from the deployment secret manager. Store only the wrapped data key in Firestore.
- Configure previous master-key versions during rotation so old envelopes remain readable; data payload versioning is independent from the wrapping-key version.
- Use a separate stable HMAC key for normalized invitation-email equality checks so rotating encryption keys cannot invalidate live invitations.
- Keep operational metadata plaintext only when required for authorization, ordering, lifecycle, or indexing. Titles, descriptions, checklist text, due dates, priority, progress, legacy tags, and invitation emails are encrypted.

### In transit and browser

- Production allows HTTPS only, TLS 1.2 or newer, HSTS, exact allowed origins, and no mixed content.
- Bearer tokens stay in headers; invitation tokens stay in POST bodies after fragment extraction.
- IndexedDB is scoped by authenticated user and board. Logout/account switch closes sync, clears in-memory keys/data, and prevents cross-account reads. Browser storage is not described as cryptographically protected from a compromised local browser profile.
- Content Security Policy and existing XSS defenses remain mandatory because application-layer server encryption does not protect data after an authorized browser decrypts it.

## Local-First Frontend Sync

### Storage

Replace Kanban `localStorage` with a dedicated IndexedDB store containing:

- board snapshot and latest applied remote revision;
- entity records and tombstones;
- durable ordered operation outbox;
- per-operation status/error;
- last successful sync time;
- migration marker and source backup.

Use the existing workspace patterns: authenticated scope, Web Locks, `BroadcastChannel`, one sync leader across tabs, persisted dirty state, and retry on `online`/focus. Kanban gets its own store and channel so canvas and Kanban sync cannot block each other.

### Mutation path

1. Validate basic UI input locally.
2. Update React state synchronously.
3. In one IndexedDB transaction, persist the entity change and append/coalesce an operation.
4. Schedule a background flush; never await it in the interaction handler.
5. Reconcile canonical acknowledgements or retain a visible local conflict draft.

Repeated progress drags, title keystrokes, description edits, and reorder previews are coalesced before transmission while preserving the final durable value. Create/delete boundaries and cross-entity moves are never coalesced incorrectly.

### Retry and lifecycle

- One in-flight command batch per board; additional edits remain interactive and queue behind it.
- Exponential backoff with jitter for transient failures and `Retry-After` support for `429`.
- Refresh an expired Firebase token once after `401`; repeated failure pauses sync and requests sign-in.
- `403` immediately refreshes membership and freezes unauthorized outbox items.
- Persist before `pagehide`; do not promise that an HTTP flush completes after tab close.
- Resume from IndexedDB after refresh, crash, offline use, account switch, or service restart.
- Bound outbox and cache growth. When configured limits are approached, compact acknowledged operations and show a storage warning before local writes can fail.

## UX Invariants

- Dragging, typing, checklist toggles, progress changes, create, and delete respond within the current render frame; no network spinner replaces the interaction.
- Sync state is quiet by default: `Saved`, `Saving…`, `Offline — changes saved locally`, or `Action needed` at board level.
- Pending cards do not jitter, reorder twice, or disappear while awaiting acknowledgement.
- Remote updates animate once and never replay the local create/delete entrance animation.
- Conflicts preserve both the user's local draft and the canonical remote value. The resolution control identifies the field and author; it does not show a generic failure toast.
- Permission loss is immediate and explicit. The board becomes read-only, queued changes are retained for copy/export, and the UI never keeps pretending they will sync.
- Invite creation returns immediately after durable server creation and exposes a copy/revoke link state without claiming email delivery.
- Offline invite/member/security operations are not optimistically claimed as complete; they require server authorization and show a pending action surface.
- Reconnecting does not replace the whole board if deltas are available, preserving scroll position, focused input, drag state, and side-sheet state.
- Snapshot replacement is deferred while an input composition or drag is active, then rebased safely.

## Edge-Case Contract

### Data and concurrency

- Duplicate command: return the original canonical result.
- Commands arrive out of order: enforce `clientSequence` where order matters and return a recoverable gap response.
- Same card edited on two devices: merge different fields; surface same-field conflict.
- Card moved while edited: preserve edit and canonical destination.
- Column deleted with cards: require explicit destination or explicit cascade; never orphan cards.
- Last column deletion: reject unless a replacement column is created in the same command group.
- Duplicate ranks: deterministic tie-break then background-safe rebalance.
- Parent card deleted during checklist edit: reject item edit as parent deleted and retain local draft.
- Board trashed while open: clients become read-only and receive lifecycle invalidation.

### Identity and invitations

- Invited account uses a different email: reject without exposing membership details.
- Email changes after joining: membership remains bound to immutable Firebase UID.
- Duplicate pending invite: rotate/resend according to explicit owner action, not silently.
- Two users race to accept: only the verified matching account can consume it; transaction permits one acceptance.
- Owner tries to leave/remove self: require ownership transfer first.
- Removed member reconnects with an old bearer token: canonical membership checks block SSE subscription and API access.
- Deleted Firebase user: scheduled membership hygiene marks membership inactive without transferring ownership automatically; owner deletion requires an explicit recovery policy and administrative audit.

### Network and storage

- Offline first launch with cache: open cached board read/write and queue changes.
- Offline first launch without cache: show unavailable state; do not fabricate an empty remote board.
- Backend timeout after commit: operation retry deduplicates.
- SSE down: command/pull sync continues; reconnect, online, focus, and local-write acknowledgements trigger bounded delta pulls without periodic polling.
- Firestore event retention exceeded: force paginated snapshot and rebase pending operations.
- IndexedDB unavailable/quota exhausted: keep session state, block claims of durability, show export/recovery guidance.
- Required key version unavailable: fail closed; never write plaintext fallback.
- Mail provider unavailable: invitation remains valid, delivery retries, copy link works, status is visible.

### Security

- Guessed IDs and cross-board entity IDs return no data.
- Oversized/deep JSON, unknown properties, invalid Unicode/control characters, and excessive batch counts are rejected before service work.
- Raw invite tokens, bearer tokens, plaintext emails, ciphertext keys, card text, and descriptions are redacted from logs/errors/traces.
- Rate limits apply per IP, user, board, and invite target digest, with stricter limits for auth, invitation, membership, and capability endpoints.
- Audit log records invite create/revoke/accept, role changes, ownership transfer, board lifecycle, export, and destructive actions.

## Configurable Limits

All limits live in validated backend configuration and a shared frontend contract; none are scattered magic numbers. Production defaults must be load-tested before release.

- request and command-batch bytes;
- commands per batch;
- title/description/checklist text lengths;
- columns, cards, checklist items, assignees, and links per board/card;
- snapshot page and delta page sizes;
- retained event/operation/tombstone days;
- invite lifetime and pending invite count;
- API, invitation, realtime capability, connection, and event rates;
- offline outbox and IndexedDB warning thresholds.

## Deletion, Recovery, and Retention

- Cards, checklist items, columns, and boards use tombstones first so sync and undo remain deterministic.
- User-facing undo uses a restore command, not a local-only reversal.
- Board deletion requires recent authentication and enters `trashed`; permanent purge occurs only after the configured retention period.
- Purge removes subcollections in bounded batches, user board references, token lookups, wrapped data key, and encrypted content. Purge writes a minimal compliance audit marker with no content.
- Member removal revokes access immediately but does not delete board data.
- Firestore point-in-time recovery and scheduled encrypted exports are enabled. Restore drills verify board, membership, event, and key recovery together.
- Master keys and the email HMAC key are stored and rotated through the deployment secret manager. Loss of a required wrapping key must be treated as unrecoverable and alerted before retirement.

## Observability and Operations

- Structured logs: request ID, user hash, board hash, operation ID, endpoint, outcome, latency, response code; never content.
- Metrics: command latency/error/conflict/dedup rate, outbox age, snapshot/delta size, SSE connections, multiplexed listener counts, invalidation lag, invite creation/acceptance, encryption failure, Firestore contention, and purge/rotation status.
- Traces propagate request ID through authorization, command transaction, delta pull, and SSE lifecycle.
- Alerts cover elevated `5xx`, auth failures, permission anomalies, command lag, Firestore contention, SSE disconnects/listener growth, encryption failures, and failed backup/restore jobs.
- Health endpoints distinguish process liveness from readiness dependencies.
- Operational runbooks cover compromised invite, key rotation, member lockout, stuck outbox, event gap, Firestore restore, SSE outage, and rollback.

## Repository Work Breakdown

### `drawsy-ai-backend`

- Add `kanban/` domain modules: schemas, types, authorization, encryption, ranks, commands, snapshots, invitations, membership, audit, realtime capabilities, and jobs.
- Keep routers thin; enforce rules in services so tests cannot bypass authorization.
- Extend config for the versioned encryption-key ring, stable email HMAC key, quotas, retention, SSE heartbeat, recent-auth policy, and invitation rate limits.
- Add strict security headers/CSP policy appropriate to API responses and production proxy trust configuration.
- Add Firestore indexes and Admin-only rules documentation.
- Preserve existing workspace, comments, canvas scene, and R2 behavior.

### `drawsy-ai-wss`

- No Kanban changes. Keep the existing Excalidraw encrypted room contract isolated.

### `excal-ai`

- Replace `KanbanStore.ts` localStorage persistence with `KanbanRepository`, `KanbanApi`, and `KanbanSync` using IndexedDB.
- Retain the component's synchronous `board/onChange` UX contract through an in-memory controller; background persistence is injected below it.
- Add authenticated user/board scoping, durable outbox, delta application, conflict drafts, realtime invalidation, multi-tab leader coordination, and sync status.
- Replace assignee text for new edits with member IDs while preserving legacy text.
- Replace new canvas tag creation with an authorized canvas chooser and stable canvas IDs; preserve legacy tags as display-only.
- Add invitation/member UI states only after the backend contract is complete.

### No Kanban changes

- `drawsy-ai-store`: remains share-link storage.
- `drawsy-ai-r2`: remains object URL signing; no Kanban authorization is delegated to it.

## Implementation Sequence

Each transaction below must pass its own tests, but none enables production Kanban sync. The single release flag changes only after the complete Definition of Done passes.

1. Freeze shared Kanban v2 types, command schemas, error codes, quotas, role matrix, and migration fixtures.
2. Add board envelope encryption/key-ring rotation, fractional-rank generation/legacy compatibility, and pure domain-command tests.
3. Add Firestore repositories and emulator-tested atomic operation/event/audit writes.
4. Add authenticated snapshot, delta, command, lifecycle, and canvas-link resolution APIs.
5. Add membership, ownership transfer, secure copy-link invitation, rate-limit, and audit APIs.
6. Add authenticated SSE, canonical Firestore listener multiplexing, role change, and revocation handling.
7. Add purge, event compaction, key rewrapping, and membership-hygiene jobs with resumable checkpoints and idempotency.
8. Add frontend IndexedDB repository, migration, reducer/controller, and durable outbox without connecting production APIs.
9. Add background command push, delta pull, realtime invalidation, multi-tab leadership, conflicts, permission loss, and recovery UX.
10. Run migration verification, security, load, outage, key rotation, backup/restore, and explicitly permitted multi-device acceptance gates.
11. Enable staged cohorts, verify live SLOs and recovery signals, then complete the bounded legacy-reader removal release.

## Migration and Cutover

1. Introduce backend schema, encryption, APIs, jobs, and SSE stream with no frontend traffic.
2. Run backend/SSE unit, integration, emulator, load, security, and recovery suites.
3. Add the frontend IndexedDB repository and migrate schema-v1 `localStorage` into a user-scoped local board once. Keep a read-only source backup and migration checksum until cloud acknowledgement.
4. On authenticated opt-in/cutover, create the remote board with an idempotent import operation. Never create a second board on retry.
5. Upload normalized columns/cards/checklist items and legacy metadata through the command API; compare counts, IDs, checksums, ordering, and content after a fresh snapshot.
6. Mark migration complete only after the canonical snapshot verifies. Keep local recovery data through the configured recovery window.
7. Enable the feature flag for internal accounts, then staged production cohorts while monitoring conflict, outbox age, encryption failures, active SSE listeners, and error metrics.
8. Remove active writes to the old localStorage key only after all cohorts pass. The old reader remains solely for the bounded migration window, then is removed in the same cleanup release.

Anonymous users remain local-only in IndexedDB. Sign-in presents an explicit choice to import the anonymous board or keep it local; no automatic merge can overwrite an existing cloud board.

## Validation Matrix

### Backend unit and service tests

- strict schemas, limits, unknown-key rejection, date-only handling, rank generation/rebalance;
- every role against every operation;
- per-field merge and same-field conflict;
- idempotency before/after simulated timeout;
- invite create/inspect/accept/revoke/rotate/expire/email mismatch/race;
- ownership transfer, last-owner protection, member revocation;
- AES-GCM round-trip, tamper/AAD failure, missing-key failure, and key rotation;
- soft delete, restore, retention purge, audit redaction;
- canvas-link authorized/restricted/deleted resolution.

### Firestore emulator integration tests

- transaction contention and concurrent commands;
- operation/event/revision atomicity;
- board reference consistency;
- event pagination and snapshot-required path;
- board/event revision consistency and member revocation;
- purge and key-rewrapping idempotency.

### SSE tests

- valid/expired/wrong-board/wrong-audience capability;
- disallowed origin and malformed payload;
- duplicate/missed signal behavior;
- access revocation disconnect;
- reconnect from revision and HTTP fallback;
- multi-instance signal fanout assumptions.

### Frontend non-browser tests

- immediate reducer updates without awaiting network;
- outbox transaction durability/coalescing/order;
- refresh/crash/offline/account-switch recovery;
- multi-tab leader/follower behavior;
- command ack, partial batch timeout, dedup, delta rebase;
- same-field conflict draft preservation;
- permission loss and exportable unsynced recovery;
- migration idempotency and checksum verification;
- no duplicate create/delete animation on remote acknowledgement.

### Pre-release tests requiring explicit later permission

Browser and manual multi-device validation are mandatory release gates but are not run under the current instruction. When permitted, validate drag/drop under latency, offline transitions, invitations across accounts, focus/scroll preservation, tab races, background/foreground behavior, and accessibility. Until then, the feature flag must remain off in production.

### Security and resilience gates

- dependency and secret scan;
- authorization matrix fuzzing and IDOR tests;
- invitation brute-force/enumeration/rate-limit tests;
- payload/depth/Unicode/oversize abuse tests;
- log redaction verification;
- load test at agreed board size, concurrent editors, and command rate;
- Firestore contention test;
- backup restore drill including every configured wrapping-key version;
- SSE, missing-key, Firestore, and backend outage exercises.

## Definition of Done

Kanban backend is complete only when all conditions are true:

- Existing local boards migrate once without content, order, checklist, or tag loss.
- Every UI mutation remains immediate and survives refresh/offline/crash before server acknowledgement.
- Two authorized users converge through commands plus delta pulls without relying on stream delivery.
- Invitation acceptance is email-verified, single-use, expiring, revocable, rate-limited, and audited.
- Role changes and removal take effect for HTTP and SSE without waiting for token expiry.
- Every read/write is covered by the authorization matrix and IDOR tests.
- Sensitive content and invitation email are envelope-encrypted at rest; keys rotate and restore successfully.
- Same-field conflicts retain the local draft; non-overlapping edits merge.
- Deletes are restorable during retention and purged completely afterward.
- Restricted canvas links leak no canvas title or scene content.
- Metrics, alerts, backups, recovery, purge jobs, and runbooks are operating.
- Backend, emulator, SSE, frontend, migration, load, security, and recovery suites pass.
- Explicitly permitted browser/multi-device acceptance tests pass before the production feature flag is enabled.

## Invitation Delivery Scope

The implemented delivery contract is the secure copy-link flow. Transactional email is intentionally not implied or partially configured; adding owned email delivery is a separate product capability, not a hidden dependency of safe board invitations.
