---
updated: 2026-10-19
source: 0008_scoring_and_manada
---

# Just One: database

No table of its own; the shapes are in `api/src/repos/match-secrets.ts` and `shared/src/domain.ts`.

## Tables referenced

| Table | Owner module | Relationship |
|---|---|---|
| `family-night-prd-match-secrets` | impostor | One `#ROUND#{nn}` item per round (adivinador and word) and one `#CLUE#{nn}#{playerId}` item per committed clue. |
| `family-night-prd-matches` | platform | Holds the Just One `publicState`. |
| `family-night-prd-rooms` | platform | `usedJustOneWordIds`, written here; the room `version`. |
| `family-night-prd-room-members` | platform | Not written: the team score never reaches `totalScore`. |

## Invariants kept in code

- The word never enters a snapshot, an event or a log before the reveal; no clue text does in CLUE or REVIEW; a cancelled clue's text does not until the reveal.
- A round's item is written once, with `attribute_not_exists`, in the version-conditional write that opens the round, together with `usedJustOneWordIds`.
- `/me` returns the word only to active clue-givers of the stored current round in CLUE, REVIEW or GUESS, never to the adivinador, a spectator or a departed player; the caller's own clue comes from the stored items in CLUE and from the reviewed clues after.
- A clue is a plain put conditional on not existing; the room-state write that follows recomputes `committedPlayerIds` from the round's clues and opens the review when every clue-giver has one, so concurrent commits converge and the review opens once.
- A clue stored after the clues closed never counts: the review, the guess and the reveal read only the authors in `committedPlayerIds`.
- A clue-giver leaving in CLUE or REVIEW deletes their clue in the same write.
- `usedJustOneWordIds` is a list separate from Impostor's `usedWordIds`; when every word is used it restarts empty.

## Migrations of note

- 2026-10-18: none; new items in an existing table and a new attribute on `Rooms`.
