---
updated: 2026-10-17
source: 0003_impostor
---

# Impostor: database

Columns and types live in the plan ([data model](../../implementation-plan.md#modelo-de-datos-dynamodb-multi-table)) and in `shared/src/domain.ts`; the tables are provisioned in `infra/`.
This file says what the module owns and what it must keep true.
Table names carry the prefix `family-night-prd-`; the kebab-case suffixes below follow `family-night-prd-rooms`.

## Tables owned

| Table | Purpose |
|---|---|
| `family-night-prd-match-secrets` | What each player alone may see (role, word or clue, category) and one `#MATCH` item with the real word, its id, the clue, the guess options and the impostor ids. |
| `family-night-prd-votes` | One item per player per round: who voted for whom. |

## Tables referenced

| Table | Owner module | Relationship |
|---|---|---|
| `family-night-prd-matches` | platform | Holds the Impostor `publicState` and status; this module defines the shape and writes it through the match service. |
| `family-night-prd-rooms` | platform | Carries `usedWordIds` (written here) and the `version` used for optimistic locking. |
| `family-night-prd-room-members` | platform | Source of who is online at start, and `totalScore`, which this module increments at the end of a match. |

## Invariants kept in code

- Nothing from `MatchSecrets` reaches the room snapshot, an event or a log; only `GET /matches/{id}/me` (filtered to the caller) and server logic read it.
- A player has at most one vote per round, because the sort key is the round plus the voter; changing a vote overwrites it.
- A ballot is a plain put; the snapshot write that follows recomputes `votedPlayerIds` from the round's ballots and closes the round when every living player has one, so concurrent voters converge instead of conflicting.
- `votedPlayerIds` keeps the closed round's voters, eliminated included, until the next round opens.
- When a living player leaves or is kicked in `VOTING`, their ballot and the ballots for them are deleted in the same transaction, each conditional on its target, so a vote changed meanwhile cancels and retries the write.
- Closing a round is idempotent: only the write that wins the version condition computes the result and publishes it; any later close, vote or next-round for that round answers `STALE_ROUND`.
- Every action body carries the round, and a vote or next-round on a closed round changes nothing.
- A vote needs a living voter and a living target different from the voter.
- Starting a match picks a word outside `usedWordIds` (a list); when none is left in the active categories, those categories' ids are cleared first; the chosen id is then added.
- A start writes the room, the match and every `MatchSecrets` item in one transaction; a published match always has its secrets.
- The five guess options are the real word plus four distinct words of its category, in random order.
- The votes of the round are cleared when the next round opens.
- `MatchSecrets` and `Votes` expire 24 hours after they are written; unlike the match, they are not renewed.
- Scores are added once, in the write that makes the match finished, and only to winners still in the room.

## Migrations of note

- 2026-10-17: none yet; the tables are created by the first release.
