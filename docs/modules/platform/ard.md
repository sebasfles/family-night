---
updated: 2026-10-17
source: 0003_impostor
---

# Platform: decisions

## 2026-10-17: A permanent identity with a public id and a secret token

- Decision: each device holds `playerId` (public, appears in snapshots) and `playerToken` (secret, 32 random bytes); the server keeps only the token's SHA-256, compared in constant time, and the token never leaves the device except in `x-player-token`.
- Alternatives rejected: `playerId` alone as the credential; accounts with login.
- Reason: everyone sees the id, so with it as credential an impostor could ask for another player's secret.
- Debt created: a lost or cleared device is a new player with a new name and the old one is orphaned; accepted by the plan.
- Revisit when: players ask to keep their name across devices.
- Source: setup

## 2026-10-17: Name uniqueness through a name table written in one transaction

- Decision: a `PlayerNames` item per name, put together with the player in a single transaction with a not-exists condition; 20 retries, then a numeric suffix.
- Alternatives rejected: unique by room only; a lookup on players by name.
- Reason: the name must be globally unique and permanent, and DynamoDB has no unique index.
- Debt created: 100 by 100 words give 10,000 combinations; past that, names get a number.
- Revisit when: the suffix fallback starts to fire.
- Source: setup

## 2026-10-17: AppSync Events for realtime, only the server publishes

- Decision: pub/sub over AppSync Events, namespace `rooms`, channel per room code; clients connect and subscribe through a Lambda authorizer that checks `playerId:playerToken` and room membership, publish is IAM granted only to the API Lambda; every event carries the full public snapshot.
- Alternatives rejected: API Gateway WebSocket; clients publishing; patch style events.
- Reason: Sebastian does not want to deal with WebSocket connection timeouts and lifecycle; a snapshot under 10 KB removes the need to refetch after each event.
- Debt created: none
- Revisit when: a channel needs authorization finer than room membership.
- Source: setup

## 2026-10-17: Versioned snapshots, optimistic locking and resync on reconnect

- Decision: `Rooms.version` rises on every public change; clients drop snapshots with a version not greater than theirs; writes are conditional on the version and retry up to three times; lost events are not recovered from the channel, the client refetches the room on reconnect, on returning to the foreground and on rejoin.
- Alternatives rejected: relying on ordered delivery; event replay.
- Reason: the plan guards against out of order events and simultaneous actions.
- Debt created: a failed publish is only logged, so a phone stays stale until the next event or reconnect.
- Revisit when: stale phones are reported in play.
- Source: setup

## 2026-10-17: Presence derived from last seen, going offline sends no event

- Decision: ping every 20 s while visible; online is under 45 s since `lastSeenAt`; the client recomputes every 5 s with the server's clock offset; events are published only when a member comes back or hides the tab (away call, which moves `lastSeenAt` back 60 s so the member greys out at once); the host transfer counts 60 s of real silence and ignores that setback.
- Alternatives rejected: an event for every ping; server side timers.
- Reason: there is no server process to notice silence, and per-ping events would flood the channel.
- Debt created: the host transfer is lazy, so a room with no requests keeps a silent host until someone acts.
- Revisit when: a room stays hostless in practice.
- Source: setup

## 2026-10-17: DynamoDB with one table per entity

- Decision: seven on-demand tables (five owned by platform), two permanent without TTL, the rest expiring 24 h after the room's last activity.
- Alternatives rejected: single table design.
- Reason: Sebastian expects many games and wants them to scale without tangling.
- Debt created: none
- Revisit when: a screen needs data from several tables in one consistent read.
- Source: setup

## 2026-10-17: One Lambda with an internal Hono router

- Decision: all routes, platform and game, in one function behind CloudFront under `/api/*`.
- Alternatives rejected: a function per route.
- Reason: family traffic, fewer cold starts, and the router keeps the code ordered; the contract does not change if it is split by prefix later.
- Debt created: none
- Revisit when: one game's load or deploy cadence differs from the rest.
- Source: setup

## 2026-10-17: The room snapshot decides the screen

- Decision: the web keeps the snapshot in the query cache and a single effect in the `$code` route navigates by `currentMatch`; users never move between lobby and game by hand; mutations apply the returned snapshot with the same version rule and make no optimistic updates.
- Alternatives rejected: per-screen state; navigation events.
- Reason: the host starting or ending a match must move every phone, and a reload must return to the same place.
- Debt created: none
- Revisit when: a game needs a screen the snapshot cannot express.
- Source: setup

## 2026-10-17: A small own WebSocket client instead of Amplify

- Decision: about a hundred lines speaking the AppSync Events protocol, with backoff of 1 s up to 30 s.
- Alternatives rejected: the official Amplify events library.
- Reason: avoid loading all of Amplify into the bundle.
- Debt created: protocol changes of AppSync Events are on us.
- Revisit when: AppSync Events changes its handshake, or the client grows past a few hundred lines.
- Source: setup

## 2026-10-17: Away is a keepalive fetch, not a beacon

- Decision: on `visibilitychange` to hidden the web calls `POST /api/rooms/{code}/away` with `fetch` and `keepalive: true`, carrying the usual auth headers.
- Alternatives rejected: `navigator.sendBeacon` with the credentials in the body, as the plan wrote.
- Reason: CloudFront origin access control requires `x-amz-content-sha256` on requests with a body and beacons cannot set headers; a keepalive fetch survives the tab going to the background just as well and keeps the token out of the body.
- Debt created: none
- Revisit when: a browser in use drops keepalive requests on tab hide.
- Source: setup

## 2026-10-17: The version bump is derived from the snapshot, and every room request has one write path

- Decision: `services/room-state.ts` reads the room then its members, lets the command return the new host and member list, and bumps `version` only when host, membership, name, score or a member's online status differs at the same instant; a bump is one transaction conditional on `version`, otherwise only the caller's presence fields and the room `ttl` are written. Four attempts with jitter, then `CONFLICT`.
- Alternatives rejected: each command flagging whether it bumps; putting whole member items on presence writes.
- Reason: one rule keeps plain pings and online rejoins silent and every visible change published, and presence writes cannot revert a field a concurrent bump just changed.
- Debt created: none
- Revisit when: a game needs a snapshot field this comparison does not see.
- Source: 0002_identity_and_rooms

## 2026-10-17: Host-only commands judge the host after the lazy transfer

- Decision: kick and host handover first apply the transfer rule, then check the caller against the resulting host; if the command then fails (`NOT_HOST`, `TARGET_NOT_MEMBER`, kicking oneself), nothing is written, transfer included.
- Alternatives rejected: committing the transfer in a separate write before the command.
- Reason: one write per request; the next ping, at most 20 s later, performs the transfer.
- Debt created: a failed host-only command does not hand over a silent host's crown.
- Revisit when: a room is seen with a silent host after such a failure.
- Source: 0002_identity_and_rooms

## 2026-10-17: Error choices the plan left open

- Decision: a malformed room code in the path is 400 `VALIDATION_ERROR`; a kick or handover target outside the room is 409 `TARGET_NOT_MEMBER`; kicking oneself is `VALIDATION_ERROR` and handing the crown to oneself is a no-op; unknown routes answer 404 `NOT_FOUND` and unhandled errors 500 `INTERNAL_ERROR`, both in the envelope; `POST /players` answers 200, as the plan marks 201 only for rooms and matches.
- Alternatives rejected: 404 for malformed codes; 404 for a missing target.
- Reason: the web never sends a malformed code, so 400 flags a client bug; a missing target is a state that changed under the host, not an absent resource.
- Debt created: none
- Revisit when: a client needs to tell these cases apart differently.
- Source: 0002_identity_and_rooms

## 2026-10-17: The authorizer allows only exact room channels and caches allows for 300 s

- Decision: the token is `playerId:playerToken`; connect needs a valid identity; subscribe also needs a non-expired membership of the room in exactly `/rooms/{CODE}`, no wildcards; publish and anything else are denied; an error denies; allows carry `ttlOverride: 300`, denials 0.
- Alternatives rejected: no caching; checking membership on connect.
- Reason: AppSync caches per token, operation and channel, so caching allows spares a Lambda call on most reconnects while a denial never sticks.
- Debt created: a kicked or departed member can resubscribe to the room's channel within the 300 s allow cache.
- Revisit when: a removed member is seen still receiving a room's events.
- Source: 0002_identity_and_rooms

## 2026-10-17: Web session details

- Decision: the room cache holds the snapshot with the clock offset taken when it was applied; the join on `/{CODE}` is a query with `gcTime: 0`, so opening or reloading joins and nothing else does; identity falls back to memory when localStorage throws.
- Alternatives rejected: storing the offset apart from the snapshot; a join mutation in an effect.
- Reason: presence is computed against the server clock of the snapshot in hand; a query deduplicates the join under StrictMode; a private tab still works for its session.
- Debt created: none
- Revisit when: a screen needs the offset without a room.
- Source: 0002_identity_and_rooms

## 2026-10-17: The lobby ships on the dark palette only

- Decision: the shell keeps 0001's dark palette for every screen of this task.
- Alternatives rejected: adding a light theme driven by `prefers-color-scheme` now.
- Reason: out of the task's scope; the plan's dark mode is met, a light mode is not.
- Debt created: no light theme for players whose system is in light mode.
- Revisit when: a player asks for it or a game needs it.
- Source: 0002_identity_and_rooms

## 2026-10-17: The version bump also sees the current match and the game configs

- Decision: `changesSnapshot` compares the current match's public state and the stored configs too; `updateRoom` takes an async decide, writes the match, `usedWordIds`, `configs` and any extra items in the same version-conditional transaction, bumps whenever extra items are written, and renews the current match's `ttl` with the room. Extends the 0002 entry on the version bump.
- Alternatives rejected: a separate write path for games.
- Reason: one rule keeps every visible change published and every match change conditional on the room version.
- Debt created: none
- Revisit when: a game needs a snapshot field outside the match and configs.
- Source: 0003_impostor

## 2026-10-17: The snapshot always carries a config for every game

- Decision: `RoomSnapshot.configs` is filled with the game's default (Impostor: every category) until the host stores one with `PUT /config`.
- Alternatives rejected: a nullable config the web fills in.
- Reason: server and lobby must agree on what Iniciar sends.
- Debt created: none
- Revisit when: defaults need to differ per room.
- Source: 0003_impostor

## 2026-10-17: Error and status choices for match routes

- Decision: a match id that exists but is not current answers `STALE_ROUND`, an unknown one `MATCH_NOT_FOUND`; abort of a match not playing is `STALE_ROUND`; rematch while playing is `MATCH_IN_PROGRESS`, answers 200 and leaves the room's stored config untouched; `usedWordIds` is a list.
- Alternatives rejected: `MATCH_NOT_FOUND` for an old match; 201 for rematch; a string set.
- Reason: a double tap on an old match is stale, not missing; the plan marks 201 only for the start; a list round-trips without an empty-set case.
- Debt created: none
- Revisit when: a client needs to tell these apart.
- Source: 0003_impostor
