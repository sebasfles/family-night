---
updated: 2026-10-17
source: setup
---

# Platform: database

Keys, attributes and the TTL setup live in [the plan](../../implementation-plan.md#modelo-de-datos-dynamodb-multi-table) and, once built, in the repo classes under `api/src/repos/`; this file says what the module owns and what it must keep true.
All tables are on demand and named `family-night-prd-{entity}` (for example `family-night-prd-rooms`); Terraform in `infra` provisions them.
The kebab case of the multiword names (`player-names`, `room-members`, `match-secrets`) is.

## Tables owned

| Table | Purpose |
|---|---|
| `family-night-prd-players` | The permanent player; stores a hash of the secret token, never the token. No TTL. |
| `family-night-prd-player-names` | One item per name ever issued, so a name is unique across all rooms. No TTL. |
| `family-night-prd-rooms` | The room, its host, its current match and its version. Expires. |
| `family-night-prd-room-members` | Membership with presence and the night's score. Expires. |
| `family-night-prd-matches` | The night's matches in order, each with its public state. Expires. The `publicState` shape of each game belongs to that game. |

## Tables referenced

| Table | Owner module | Relationship |
|---|---|---|
| `family-night-prd-match-secrets` | impostor | Read only by `GET /matches/{id}/me`, filtered to the caller, never to build a snapshot. |
| `family-night-prd-votes` | impostor | Not touched by this module. |

## Invariants kept in code

- `Rooms.version` increases by one on every write that changes the public snapshot, and only through a conditional write; a failed condition rereads and retries up to three times, then answers `CONFLICT`.
- `ttl` is now plus 24 h, recalculated on every write to the room, to the writing member and to the current match; ping counts as a write.
- Players and PlayerNames never expire and are never deleted.
- A name is created only by one transaction that puts the name with `attribute_not_exists` and the player together; 20 random collisions fall back to a numeric suffix from 2.
- Names compare exactly, with accents and case.
- A room code uses only `ABCDEFGHJKMNPQRSTUVWXYZ` (no I, L, O), is created with `attribute_not_exists`, and is retried at most 10 times on collision.
- A room has at most 20 members; the 21st gets `ROOM_FULL`.
- `Matches` sorts by ULID `matchId`, so a query by room code returns the night in order.
- A room has at most one current match; starting another while one runs is `MATCH_IN_PROGRESS`.
- The host is always a member; after 60 s of real silence the next request from an online member transfers it to the oldest online member.
- A member is never removed for being offline, only by leave or kick.
- `MatchSecrets` never enters a snapshot, an event or a log.

## Migrations of note

- None; greenfield.
