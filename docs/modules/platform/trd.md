---
updated: 2026-10-18
source: 0004_wavelength
---

# Platform: technical

Stack, layout and verification commands live in `docs/TRD.md`.
The shared contract (request and response types, `RoomSnapshot`, `RoomEvent`, limits) is in `shared/src`; see [the plan](../../implementation-plan.md#snapshot-público-de-la-sala) for its intent.
Every payload change starts in `shared`, so an incompatible change breaks compilation, not a match.

## Structure

| Path | What |
|---|---|
| `shared/src/{api,events,domain,constants}.ts` | Types of every endpoint and event, the domain types, limits (members, TTL, thresholds, room code alphabet). Pure, no AWS. |
| `api/src/index.ts`, `api/src/app.ts`, `api/src/server.ts` | The Lambda entry and the Node entry around one Hono app (`app.ts`) for every route, platform and game. |
| `api/src/events-auth.ts` | The Events API authorizer, bundled as its own function: connect needs a valid `playerId:playerToken`, subscribe also membership of the exact channel's room; allows cached 300 s, denials never cached. |
| `api/scripts/build.mjs` | esbuild bundles of both functions, zipped reproducibly into `dist/api.zip` and `dist/events-auth.zip`. |
| `api/src/lib/` | Errors with their codes, zod validation, authentication by header. |
| `api/src/repos/` | One class per table; the only code that touches DynamoDB. |
| `api/src/services/{players,rooms,presence,matches}` | Identity and names, rooms and host rules, ping and away, match start, config, abort, lobby, rematch, next round and the departure hook that hands leave and kick to the game. |
| `api/src/services/games.ts` | The game registry keyed by `gameType`: config defaults and parsing, start check, preparation, next round, departure and `/me` of each game; also fills each game's default config into the snapshot. |
| `api/src/services/room-state.ts` | The one write path of every room request: read room then members, decide, commit, publish. |
| `api/src/deps.ts` | Repos, publisher, clock and random injected into `createApp`, so tests swap them. |
| `api/src/realtime/publish.ts` | Builds the public snapshot and posts it, signed with SigV4, to the AppSync Events channel. |
| `api/src/data/names.json` | 100 animals and 100 adjectives, masculine singular. |
| `web/src/routes/{__root,index}.tsx` | Layout, providers, toasts, identity bootstrap; home. |
| `web/src/routes/$code/{route,index}.tsx` | Join and snapshot loader, channel subscription, ping, visibility handling, state-driven navigation; lobby. |
| `web/src/identity/` | `playerId`, `playerToken` and name in localStorage, guarded by try/catch. |
| `web/src/api/` | Typed fetch client that adds the identity headers and throws `ApiError`; query and mutation hooks. |
| `web/src/realtime/` | One WebSocket per tab to AppSync Events, own client, backoff 1 s to 30 s, resubscribe and invalidate the room query on reconnect. |
| `web/src/components/` | Shared UI of the lobby, the shell and every game (`AbortMatchMenu`, `match.ts` with `nameOf`, `vibrate`, `usePhaseVibration`); games never import each other. |
| `web/public/og.png` and the Open Graph tags in `web/index.html` | The WhatsApp preview; static because WhatsApp runs no JavaScript. |

## Endpoints owned

Authentication, membership and host rules are in [the plan](../../implementation-plan.md#convenciones); every call except `POST /api/players` sends `x-player-id` and `x-player-token`.

| Method | Route | Purpose | Spec |
|---|---|---|---|
| GET | `/api/health` | `{ ok, version }` with the deployed commit; proves the CloudFront to Lambda path. No auth. | `shared/src/api.ts` |
| POST | `/api/players` | Create the permanent player and name. No auth. | [plan](../../implementation-plan.md#jugadores) |
| GET | `/api/players/me` | Validate stored identity; 401 makes the web start over. | [plan](../../implementation-plan.md#jugadores) |
| POST | `/api/rooms` | Create a room; caller becomes host. | [plan](../../implementation-plan.md#salas) |
| GET | `/api/rooms/{code}` | Snapshot, used to resync. | [plan](../../implementation-plan.md#salas) |
| POST | `/api/rooms/{code}/join` | Idempotent join and rejoin. | [plan](../../implementation-plan.md#salas) |
| POST | `/api/rooms/{code}/leave` | Remove own membership. | [plan](../../implementation-plan.md#salas) |
| POST | `/api/rooms/{code}/ping` | Presence heartbeat; answers `{ room }` so quiet members stay fresh without an extra GET. | [plan](../../implementation-plan.md#salas) |
| POST | `/api/rooms/{code}/away` | Keepalive fetch on tab hidden, same auth headers as every call. | [plan](../../implementation-plan.md#salas) |
| POST | `/api/rooms/{code}/kick` | Host removes a member. | [plan](../../implementation-plan.md#salas) |
| POST | `/api/rooms/{code}/host` | Host hands the role over. | [plan](../../implementation-plan.md#salas) |
| POST | `/api/rooms/{code}/matches` | Host starts a match of a game. | [plan](../../implementation-plan.md#partidas-comunes-a-todos-los-juegos) |
| PUT | `/api/rooms/{code}/config` | Host selects a game and stores its config; members see both live and the lobby opens with them. | `shared/src/api.ts` |
| GET | `/api/rooms/{code}/matches/{matchId}/me` | The caller's own secret, or null. | [plan](../../implementation-plan.md#partidas-comunes-a-todos-los-juegos) |
| POST | `/api/rooms/{code}/matches/{matchId}/abort` | Host ends a match without score. | [plan](../../implementation-plan.md#partidas-comunes-a-todos-los-juegos) |
| POST | `/api/rooms/{code}/matches/{matchId}/next-round` | Host leaves the result; the current game decides what comes next. | `shared/src/api.ts` |
| POST | `/api/rooms/{code}/lobby` | Host sets `currentMatchId` to null. | [plan](../../implementation-plan.md#partidas-comunes-a-todos-los-juegos) |
| POST | `/api/rooms/{code}/matches/{matchId}/rematch` | Host starts a new match with the finished match's config. | [plan](../../implementation-plan.md#partidas-comunes-a-todos-los-juegos) |

Error codes and their HTTP status are in [the plan](../../implementation-plan.md#códigos-de-error); the Spanish `message` is shown to the user as is.
There is no generated API spec; `shared` types are the contract.
Channel `/rooms/{ROOMCODE}` in namespace `rooms` carries `room.updated`, `member.kicked` and a reserved `room.closed` that nothing sends yet.

## Behaviors that are easy to get wrong

- Every state-changing endpoint answers with the public snapshot and publishes the same one.
- A failed publish is logged and never fails the request; the state is already stored.
- Client rule, for events, mutations, ping and GET alike: apply a snapshot when its `version` is greater, or equal with a newer `serverTime` (plain pings refresh presence without a new version).
- `online` is derived from `lastSeenAt` and `serverTime` (under 45 s); the client recomputes it every 5 s, so going offline sends no event.
- The version rises, and an event is published, only when the public snapshot changes: host, membership, name, score or a member's online status; plain pings and online rejoins write presence only.
- On returning to the foreground the web pings, never joins; `NOT_MEMBER` sends it home with "Te sacaron de la sala". Only opening or reloading `/{CODE}` joins.
- Host transfer is lazy: it happens on the next request of an online member, not on a timer, and counts 60 s of real silence; the away setback of `lastSeenAt` does not count.
- Every POST carries `x-amz-content-sha256`, computed in `web/src/api/client.ts`; bodyless ones use the constant empty-body hash with no `await` before `fetch`, so the away call leaves inside the `visibilitychange` handler.
- The realtime connection authenticates with `playerId:playerToken` through the AppSync Lambda authorizer; subscribing to `/rooms/{code}` needs membership of that room.
- Game endpoints are mounted in the same router by the game modules; start, config, rematch, next-round, `/me` and departures reach the game through the registry by `gameType`. A route both games share (`next-round`) lives in the platform router.
- Leaving or being kicked mid-match calls the game's own handling of a player who left.
- Match routes live under the room, which is also the membership check; a match id that exists but is no longer current answers `STALE_ROUND`.
- The `$code/route.tsx` effect moves the phone to the current match's game route (`/$code/impostor`, `/$code/wavelength`) and back to the lobby when `currentMatch` is null; aborting clears it in the same write.
- `selectedGame` changes with `PUT /config` and with every start or rematch; the lobby shows that game's panel.

## Depends on

- infra: the tables, the Lambda and its Function URL behind CloudFront, the AppSync Events API, the Lambda authorizer of the Events API, the Actions variables the web build reads.
- impostor, wavelength: their registry entries (config, start, next round, player-left handling, secret) and `publicState`.

## Depended on by

- impostor, wavelength: auth, membership checks, version and optimistic locking, snapshot building, publishing, the `$code` shell and `GET /api/rooms/{code}/matches/{matchId}/me`.
- deploy: builds and ships `shared`, `api` and `web`.

## Configuration

- API: the table names, `EVENTS_HTTP_DOMAIN`, `NODE_OPTIONS=--enable-source-maps`, set by infra on the function.
- Web build: `VITE_EVENTS_HTTP_DOMAIN` and `VITE_EVENTS_REALTIME_DOMAIN`, injected by `deploy-web` from the repository Actions variables; without them the web runs with no realtime channel.
- Local api: `pnpm dev` reads `api/.env`; `DYNAMODB_ENDPOINT` points it at a local DynamoDB, and without `EVENTS_HTTP_DOMAIN` publishes are logged and skipped.
- The web calls the API with relative `/api/...`; no variable.

## Testing

- Unit: Vitest in `shared`, `api` and `web`.
- API integration: handlers against DynamoDB Local with the publisher mocked; a vitest `globalSetup` starts `amazon/dynamodb-local` in Docker on a random port and fails without Docker, so the api suite needs Docker locally and in CI.
- Web: Testing Library on home, lobby and the `$code` session, with the realtime channel driven by a fake WebSocket.
- Screenshots: `pnpm screenshots` in `web/` with `SCREENSHOTS_DIR` set, every screen mocked at 390, 768 and 1280 px.
- A test serializes a snapshot of a running match and asserts it holds no secret.
- Module-specific run: see TRD.
