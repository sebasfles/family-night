---
updated: 2026-10-18
source: 0007_lobby_polish
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

## 2026-10-18: Games plug in through a registry keyed by `gameType`

- Decision: `services/games.ts` maps each `gameType` to a module with default and parsed config, start check, preparation, next round, departure and `/me`; start, config, rematch, next-round, `/me`, departures and the snapshot's default configs call the game only through it. The registry is built inside a function, not at module load.
- Alternatives rejected: `services/matches` importing each game directly, as 0003 shipped.
- Reason: a second game proved the dispatch 0003 described was missing; the function form avoids reading a game binding before it is initialized, since `room-state` imports the registry and the games import `room-state`.
- Debt created: none
- Revisit when: a game needs a hook the registry does not have.
- Source: 0004_wavelength

## 2026-10-18: A route several games share lives in the platform router

- Decision: `POST {match}/next-round` moved from the Impostor router to the platform router, which hands it to the current match's game; a game command aimed at a match of another game answers `STALE_ROUND`.
- Alternatives rejected: per-game paths for the same action.
- Reason: the plan gives both games the same path, and Hono cannot hold two handlers on one method and path.
- Debt created: none
- Revisit when: two games need different bodies on one shared path.
- Source: 0004_wavelength

## 2026-10-18: The room remembers the selected game

- Decision: `selectedGame` on the room and in the snapshot, default `IMPOSTOR`, set by `PUT /config` (the host tapping a card sends that game's current config) and by every start or rematch; members see the chosen game and its config read only. The version bump compares it too.
- Alternatives rejected: keeping the selection on the host's phone.
- Reason: every phone and a reload must show the same lobby.
- Debt created: none
- Revisit when: games need settings shared across games.
- Source: 0004_wavelength

## 2026-10-18: Pieces shared by game screens live in `web/src/components/`

- Decision: the host's "Terminar partida" menu with its confirmation, `vibrate`, `usePhaseVibration` and the departed player's name moved from `games/impostor` to `web/src/components/`; game folders never import each other.
- Alternatives rejected: Wavelength importing from `games/impostor`.
- Reason: a game must be removable without breaking another.
- Debt created: none
- Revisit when: a piece is needed by only one game again.
- Source: 0004_wavelength

## 2026-10-18: The secret query is keyed by match and round

- Decision: `useMatchSecret` caches under `['match-secret', matchId, round]`; Impostor, whose secret does not change, passes `null`.
- Alternatives rejected: the 0003 key by match only.
- Reason: cached forever by match, a player who is the psychic again in a later round would see the earlier target.
- Debt created: none
- Revisit when: a game's secret changes within a round.
- Source: 0004_wavelength

## 2026-10-18: Clue and guess paths shared by games with different bodies

- Decision: `PUT {match}/clue` and `PUT {match}/guess` live in `handlers/shared-match.ts`, which checks membership, reads the match's `gameType` and hands the request to that game's handler, which parses its own body; a game without the path answers `STALE_ROUND`; `roundSchema` lives in `handlers/context.ts` so handler modules do not import each other. Extends "A route several games share lives in the platform router", whose revisit condition Just One met.
- Alternatives rejected: per-game paths for the same action; one body schema that is the union of every game's.
- Reason: Hono holds one handler per method and path, and each game must keep validating its own body.
- Debt created: none
- Revisit when: a shared path needs a check before the game is known beyond membership.
- Source: 0005_just_one

## 2026-10-18: The secret query is keyed by match, round and phase

- Decision: `useMatchSecret` takes an optional phase as the last part of its key; Just One passes it, Impostor and Wavelength pass nothing. Extends "The secret query is keyed by match and round", whose revisit condition Just One met.
- Alternatives rejected: invalidating the secret on every snapshot.
- Reason: a Just One clue-giver's secret changes within a round (own clue in CLUE, every clue in REVIEW).
- Debt created: none
- Revisit when: a secret changes within a phase other than through the caller's own command.
- Source: 0005_just_one

## 2026-10-18: One match header and one cycles panel for every game

- Decision: `web/src/components/MatchHeader.tsx` (round or end title, subtitle, optional badge, host menu) serves Impostor, Wavelength and Just One; `web/src/components/lobby/CyclesPanel.tsx` is the lobby panel of every game whose config is `{ cycles }`, typed by `CyclesGame`; the lobby maps each `gameType` to its panel.
- Alternatives rejected: a copy per game folder.
- Reason: copies drift with the next fix; pieces shared by game screens live in `web/src/components/`.
- Debt created: none
- Revisit when: a game's header or cycles panel needs more than a subtitle, a badge or a phrase.
- Source: 0005_just_one

## 2026-10-18: Config requests are mapped over the game type

- Decision: `GameConfigRequest` is `{ gameType: G; config: GameConfigs[G] }` for each `G` of `GameType`, so a new game needs no edit there; the lobby's game pick sends `configs[game]` with one cast, since TypeScript cannot correlate the two across the union.
- Alternatives rejected: a hand-written union and a ternary per game.
- Reason: the third game showed the hand-written list as a place to forget.
- Debt created: none
- Revisit when: a game's config request needs more than its config.
- Source: 0005_just_one

## 2026-10-18: Own commands show at once through an overlay of pending commands

- Decision: the screen is the served snapshot plus the phone's pending commands (`web/src/api/optimistic.ts`); the overlay is never written into the room cache, a refusal drops it and toasts the server message, and all room commands of a phone share one mutation scope so they reach the server in tap order. Lobby pick, config, host, kick and rename are optimistic; start, rematch, lobby and leave keep their busy button. Supersedes the no-optimistic clause of "The room snapshot decides the screen"; navigation still follows the snapshot.
- Alternatives rejected: waiting for the snapshot; writing the optimistic state into the cache.
- Reason: Sebastian's call: taps must feel instant; an overlay rolls back exactly on `CONFLICT` or `STALE_ROUND` because the snapshot underneath was never touched.
- Debt created: none
- Revisit when: a command's effect cannot be expressed from the caller's own data.
- Source: 0006_gameplay_and_redesign

## 2026-10-18: A rename is one room write, and the old name is released

- Decision: `PATCH /api/players/me { name, roomCode }` renames the player conditional on the old name, claims the new `PlayerNames` item unless the caller owns it, deletes the old one conditional on its `playerId`, and updates that room's member, all in the room's version-conditional write that publishes. Name rules live once in `shared/src/players.ts`: trimmed, spaces collapsed, 2 to 20 graphemes, visible characters only. Other rooms catch up on rejoin.
- Alternatives rejected: an index of rooms by player to update them all (infra was out of clearance); keeping old names reserved forever.
- Reason: one transaction keeps global uniqueness exact as at assignment; graphemes make an emoji one character; invisible fillers would make names nobody can read.
- Debt created: other rooms show the old name until the player opens them again.
- Revisit when: a stale name in another room matters.
- Source: 0006_gameplay_and_redesign

## 2026-10-18: A warm dark design system with motion behind one folder

- Decision: one warm dark palette as tokens in `web/src/index.css` (token names kept from the blue one), Fraunces for headings and numbers and Nunito for text, self-hosted; `motion` with LazyMotion `domAnimation` and `m` components only, reached through `web/src/motion/`; transitions enter only, no exit animations; `useReducedMotion` on `matchMedia` makes every piece render its settled state.
- Alternatives rejected: WebGL or three.js; a light theme; layout animations (`domMax`, about 10 KB more); exit animations, which delay the new phase.
- Reason: Sebastian's call for a warm family night look on phones; transforms and opacity are cheap on low-end phones and the bundle grew about 31 KB gzip once.
- Debt created: none (the light theme debt of 2026-10-17 stands).
- Revisit when: a screen needs an exit or layout animation.
- Source: 0006_gameplay_and_redesign

## 2026-10-18: Reveals flip in CSS 3D and scoreboards count, then shift places

- Decision: reveals are `FlipReveal` (back first, turn after 450 ms, `rotateY` with `preserve-3d`); a card turned by hand is `Flip`, whose face unmounts once turned away. Scoreboards count up from the points before (`CountUp`, the final value always read by screen readers) and then slide rows from their old place (`useShuffleIn`, Web Animations API on layout boxes); ranks fade in last. Reduced motion shows the face, the final numbers and the final order. The leader row is highlighted only when one player leads alone.
- Alternatives rejected: motion layout animations for the shift (needs `domMax`); flips on SVG groups (no real 3D inside SVG).
- Reason: zero bundle for the shift and the flip; one sequence (flip, count, shift) reads as a reveal.
- Debt created: none
- Revisit when: a list must animate while it changes, not only on mount.
- Source: 0006_gameplay_and_redesign

## 2026-10-18: A rename from home is the same transaction without a room

- Decision: `PATCH /api/players/me` takes `roomCode` optionally; without it the api renames the player conditional on the old name, claims the new name and releases the old one, with no room write and no publish, retrying conflicts four times. The contract has two responses, `RenamePlayerResponse` (`{ player }`) and `RenameInRoomResponse` (also `room`), so the lobby keeps a snapshot by type. The web applies it optimistically and queues Crear sala and Unirme behind it. Extends "A rename is one room write, and the old name is released".
- Alternatives rejected: a separate endpoint; one response with an optional `room`; an index of a player's rooms to check names there (infra, outside clearance).
- Reason: Sebastian wants the name editable from home; one shared set of writes keeps global uniqueness exact on both paths.
- Debt created: a rename from home skips the room rule (ignoring case and accents), and a rejoin copies the name unchecked, so a room can show "Ana" and "ana".
- Revisit when: two members of one room show names that differ only in case or accents.
- Source: 0007_lobby_polish

## 2026-10-18: How to play is built from each game's leaf components

- Decision: `components/HowToPlay.tsx` holds the drawer (under 768 px, closed from its handle, the close button or Escape), the modal and the carousel (Pointer Events swipe with `touch-action: pan-y`, enter-only step animation); each game exports its steps from `games/{game}/howToPlay.tsx`, composing leaf components (cards, turn order, vote list, dial, clue cards, scoreboard) on an example family, with points and cancellations computed by the shared rules. Scenes render inert. Leaves the games needed were extracted from their phase screens without behavior change.
- Alternatives rejected: illustrations; a route per tutorial; reusing phase components that carry commands; interactive scenes.
- Reason: the tutorial must match the real screens and rules; inert scenes cannot compete with the swipe or reach a command, and `components/` stays free of `games/`.
- Debt created: none
- Revisit when: a game wants an interactive step, or a how-to-play entry inside a running match.
- Source: 0007_lobby_polish

## 2026-10-18: Screenshots guard 360 px against the configured viewport

- Decision: every screenshot fails when the page is wider than the configured viewport, when a text element lies outside it or is clipped by its own overflow, or when an input's value scrolls; 360 px is a permanent width. The lobby column is `grid-cols-1` and member rows stack "pts" under the score below `sm`.
- Alternatives rejected: comparing against `innerWidth`, which a mobile viewport widens to fit overflowing content; a one-off audit.
- Reason: the old check passed a lobby 369 px wide at 360.
- Debt created: a name with one word longer than about 11 letters still breaks mid-word in a member row at 360.
- Revisit when: a family uses such a name.
- Source: 0007_lobby_polish
