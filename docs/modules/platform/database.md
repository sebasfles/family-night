---
updated: 2026-10-18
source: 0006_gameplay_and_redesign
---

# Platform: database

Keys, attributes and the TTL setup live in [the plan](../../implementation-plan.md#modelo-de-datos-dynamodb-multi-table) and, once built, in the repo classes under `api/src/repos/`; this file says what the module owns and what it must keep true.
All tables are on demand and named `family-night-prd-{entity}` (for example `family-night-prd-rooms`); Terraform in `infra` provisions them.
Multiword names are kebab case (`player-names`, `room-members`, `match-secrets`).

## Tables owned

| Table | Purpose |
|---|---|
| `family-night-prd-players` | The permanent player; stores a hash of the secret token, never the token. No TTL. |
| `family-night-prd-player-names` | One item per name in use, so a name is unique across all rooms. No TTL. |
| `family-night-prd-rooms` | The room, its host, its current match, the selected game and its version. Expires. |
| `family-night-prd-room-members` | Membership with presence and the night's score. Expires. |
| `family-night-prd-matches` | The night's matches in order, each with its public state. Expires. The `publicState` shape of each game belongs to that game. |

## Tables referenced

| Table | Owner module | Relationship |
|---|---|---|
| `family-night-prd-match-secrets` | impostor | Holds the secrets of every game; read only by `GET /api/rooms/{code}/matches/{matchId}/me`, filtered to the caller, never to build a snapshot. |
| `family-night-prd-votes` | impostor | Not touched by this module. |

## Invariants kept in code

- `Rooms.version` increases by one on every write that changes the public snapshot, and only through a conditional write; a failed condition rereads and retries up to three times, then answers `CONFLICT`.
- `ttl` is now plus 24 h, recalculated on every write to the room, to the writing member and to the current match; ping counts as a write.
- Players and PlayerNames never expire; a name is deleted only by its owner's rename, conditional on its `playerId`, in the same transaction that claims the new one.
- A name is created only by one transaction that puts the name with `attribute_not_exists` and the player together; 20 random collisions fall back to a numeric suffix from 2.
- Names are trimmed with inner spaces collapsed (`normalizePlayerName` in `shared/`) and compare exactly across players; inside a room a rename is also refused when it equals another member's name ignoring case and accents (`playerNameKey`).
- A rename writes the player (conditional on the old name), the names and that room's member in the version-conditional room write; a rejoin refreshes a stale member name.
- A room code uses only `ABCDEFGHJKMNPQRSTUVWXYZ` (no I, L, O), is created with `attribute_not_exists`, and is retried at most 10 times on collision.
- A room has at most 20 members; the 21st gets `ROOM_FULL`.
- `Matches` sorts by ULID `matchId`, so a query by room code returns the night in order.
- A room has at most one current match; starting another while one runs is `MATCH_IN_PROGRESS`, and so is `/lobby` while it plays.
- Aborting writes the match as `ABORTED` and sets `currentMatchId` to null in the same transaction; no points.
- `Rooms.configs` holds each game's config as the host stored it; `selectedGame` defaults to `IMPOSTOR` and changes only in a version-conditional write; `usedWordIds` is a list owned by impostor, `usedSpectrumIds` one owned by wavelength, `usedJustOneWordIds` one owned by justone; each restarts only its own.
- The host is a member, except in an empty room, where `hostId` keeps the last host until the next joiner takes it.
- `RoomMembers.lastActiveAt` is the real-activity time and only the member's own requests set it; away moves `lastSeenAt` back 60 s and never touches it. After 60 s without activity, any member request except away hands the role to the oldest online member by `joinedAt`.
- Writes that change the snapshot are one transaction: the room update conditional on `version` plus the member puts and deletes. Presence-only writes update just `lastSeenAt`, `lastActiveAt` and `ttl` of the caller, never the whole item.
- An item past its `ttl` but not yet deleted by DynamoDB is absent on every read; a new room may reuse an expired code.
- A member is never removed for being offline, only by leave or kick.
- `MatchSecrets` never enters a snapshot, an event or a log.

## Migrations of note

- None; greenfield.
