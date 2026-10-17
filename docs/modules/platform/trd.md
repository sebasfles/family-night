---
updated: 2026-10-17
source: setup
---

# Platform: technical

Stack, layout and verification commands live in `docs/TRD.md`.
The shared contract (request and response types, `RoomSnapshot`, `RoomEvent`, limits) is in `shared/src`; see [the plan](../../implementation-plan.md#snapshot-público-de-la-sala) for its intent.
Every payload change starts in `shared`, so an incompatible change breaks compilation, not a match.

## Structure

| Path | What |
|---|---|
| `shared/src/{api,events,domain,constants}.ts` | Types of every endpoint and event, the domain types, limits (members, TTL, thresholds, room code alphabet). Pure, no AWS. |
| `api/src/index.ts` | The single Lambda entry; one Hono router for every route, platform and game. |
| `api/src/lib/` | Errors with their codes, zod validation, authentication by header. |
| `api/src/repos/` | One class per table; the only code that touches DynamoDB. |
| `api/src/services/{players,rooms,presence,matches}` | Identity and names, rooms and host rules, ping and away, match start, abort, lobby and rematch. |
| `api/src/realtime/publish.ts` | Builds the public snapshot and posts it, signed with SigV4, to the AppSync Events channel. |
| `api/src/data/names.json` | 100 animals and 100 adjectives, masculine singular. |
| `web/src/routes/{__root,index}.tsx` | Layout, providers, toasts, identity bootstrap; home. |
| `web/src/routes/$code/{route,index}.tsx` | Join and snapshot loader, channel subscription, ping, visibility handling, state-driven navigation; lobby. |
| `web/src/identity/` | `playerId`, `playerToken` and name in localStorage, guarded by try/catch. |
| `web/src/api/` | Typed fetch client that adds the identity headers and throws `ApiError`; query and mutation hooks. |
| `web/src/realtime/` | One WebSocket per tab to AppSync Events, own client, backoff 1 s to 30 s, resubscribe and invalidate the room query on reconnect. |
| `web/src/components/` | Shared UI of the lobby and the shell. |
| `web/public/og.png` and the Open Graph tags in `web/index.html` | The WhatsApp preview; static because WhatsApp runs no JavaScript. |

## Endpoints owned

Authentication, membership and host rules are in [the plan](../../implementation-plan.md#convenciones); every call except `POST /api/players` sends `x-player-id` and `x-player-token`.

| Method | Route | Purpose | Spec |
|---|---|---|---|
| POST | `/api/players` | Create the permanent player and name. No auth. | [plan](../../implementation-plan.md#jugadores) |
| GET | `/api/players/me` | Validate stored identity; 401 makes the web start over. | [plan](../../implementation-plan.md#jugadores) |
| POST | `/api/rooms` | Create a room; caller becomes host. | [plan](../../implementation-plan.md#salas) |
| GET | `/api/rooms/{code}` | Snapshot, used to resync. | [plan](../../implementation-plan.md#salas) |
| POST | `/api/rooms/{code}/join` | Idempotent join and rejoin. | [plan](../../implementation-plan.md#salas) |
| POST | `/api/rooms/{code}/leave` | Remove own membership. | [plan](../../implementation-plan.md#salas) |
| POST | `/api/rooms/{code}/ping` | Presence heartbeat. | [plan](../../implementation-plan.md#salas) |
| POST | `/api/rooms/{code}/away` | Keepalive fetch on tab hidden, same auth headers as every call. | [plan](../../implementation-plan.md#salas) |
| POST | `/api/rooms/{code}/kick` | Host removes a member. | [plan](../../implementation-plan.md#salas) |
| POST | `/api/rooms/{code}/host` | Host hands the role over. | [plan](../../implementation-plan.md#salas) |
| POST | `/api/rooms/{code}/matches` | Host starts a match of a game. | [plan](../../implementation-plan.md#partidas-comunes-a-todos-los-juegos) |
| GET | `/api/matches/{matchId}/me` | The caller's own secret, or null. | [plan](../../implementation-plan.md#partidas-comunes-a-todos-los-juegos) |
| POST | `/api/matches/{matchId}/abort` | Host ends a match without score. | [plan](../../implementation-plan.md#partidas-comunes-a-todos-los-juegos) |
| POST | `/api/rooms/{code}/lobby` | Host sets `currentMatchId` to null. | [plan](../../implementation-plan.md#partidas-comunes-a-todos-los-juegos) |
| POST | `/api/matches/{matchId}/rematch` | Host starts a new match with the same config. | [plan](../../implementation-plan.md#partidas-comunes-a-todos-los-juegos) |

Error codes and their HTTP status are in [the plan](../../implementation-plan.md#códigos-de-error); the Spanish `message` is shown to the user as is.
There is no generated API spec; `shared` types are the contract.
Channel `/rooms/{ROOMCODE}` in namespace `rooms` carries `room.updated`, `member.kicked` and a reserved `room.closed` that nothing sends yet.

## Behaviors that are easy to get wrong

- Every state-changing endpoint answers with the public snapshot and publishes the same one.
- A failed publish is logged and never fails the request; the state is already stored.
- Client rule: apply a snapshot only if its `version` is greater than the cached one, for events and for mutation responses alike.
- `online` is derived from `lastSeenAt` and `serverTime` (under 45 s); the client recomputes it every 5 s, so going offline sends no event.
- `ping` publishes only when the member comes back from offline.
- Host transfer is lazy: it happens on the next request of an online member, not on a timer, and counts 60 s of real silence; the away setback of `lastSeenAt` does not count.
- Every request with a body carries `x-amz-content-sha256` (SHA-256 of the exact body sent), computed once in `web/src/api/client.ts`; CloudFront origin access control rejects it otherwise.
- The realtime connection authenticates with `playerId:playerToken` through the AppSync Lambda authorizer; subscribing to `/rooms/{code}` needs membership of that room.
- Game endpoints are mounted in the same router by the game modules; the platform router dispatches by `gameType` when starting a match.
- Leaving or being kicked mid-match calls the game's own handling of a player who left.

## Depends on

- infra: the tables, the Lambda and its Function URL behind CloudFront, the AppSync Events API, the Lambda authorizer of the Events API, the Actions variables the web build reads.
- impostor: game start, config validation, `publicState` and player-left handling that matches call into.

## Depended on by

- impostor: auth, membership checks, version and optimistic locking, snapshot building, publishing, the `$code` shell and `GET /matches/{id}/me`.
- deploy: builds and ships `shared`, `api` and `web`.

## Configuration

- API: the table names, `EVENTS_HTTP_DOMAIN`, `NODE_OPTIONS=--enable-source-maps`, set by infra on the function.
- Web build: `VITE_EVENTS_HTTP_DOMAIN` and `VITE_EVENTS_REALTIME_DOMAIN`, injected by `deploy-web` from the repository Actions variables.
- The web calls the API with relative `/api/...`; no variable.

## Testing

- Unit: Vitest in `shared`, `api` and `web`.
- API integration: handlers against DynamoDB Local with the publisher mocked, covering forced name collision, create and join, idempotent rejoin and automatic host transfer.
- Web: Testing Library; the plan names only the Impostor screens; lobby and shell get the same treatment.
- A test serializes a snapshot of a running match and asserts it holds no secret.
- Module-specific run: see TRD.
