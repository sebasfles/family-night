---
updated: 2026-10-19
source: 0008_scoring_and_manada
---

# La manada: database

No table of its own; the shapes are in `api/src/repos/match-secrets.ts` and `shared/src/domain.ts`.

## Tables referenced

| Table | Owner module | Relationship |
|---|---|---|
| `family-night-prd-match-secrets` | impostor | One `#ANSWER#{nn}#{playerId}` item per committed answer. |
| `family-night-prd-matches` | platform | Holds the La manada `publicState`, the question and, after the reveal, the answers. |
| `family-night-prd-rooms` | platform | `usedManadaQuestionIds`, written here; the room `version`. |
| `family-night-prd-room-members` | platform | `totalScore`, incremented when the match finishes. |

## Invariants kept in code

- No answer text enters a snapshot, an event or a log before its round reveals.
- An answer is a plain put conditional on not existing; the room write that follows recomputes `answeredPlayerIds` from the round's stored answers and reveals when every player still in has one, so concurrent answers converge and the round reveals once.
- An answer stored after the reveal never counts: from the reveal on, only the answers copied into the public result exist for the round.
- A player leaving in ANSWER deletes their answer in the same write.
- Merges, splits and departures recompute groups, totals and the cow from the round's `totalsBefore` and `cowBefore`, never from the current totals.
- Night points reach `RoomMembers.totalScore` once, in the write that finishes the match, only for players still in it.
- `usedManadaQuestionIds` is a list of its own; when every question is used it restarts empty.

## Migrations of note

- 2026-10-19: none; new items in an existing table and a new attribute on `Rooms`, read as `[]` when absent.
