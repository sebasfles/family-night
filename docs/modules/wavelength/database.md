---
updated: 2026-10-18
source: 0004_wavelength
---

# Wavelength: database

No table of its own; the shapes are in `api/src/repos/match-secrets.ts` and `shared/src/domain.ts`.

## Tables referenced

| Table | Owner module | Relationship |
|---|---|---|
| `family-night-prd-match-secrets` | impostor | One `#ROUND#{nn}` item per round (psychic and target) and one `#GUESS#{nn}#{playerId}` item per committed guess. |
| `family-night-prd-matches` | platform | Holds the Wavelength `publicState`. |
| `family-night-prd-rooms` | platform | `usedSpectrumIds`, written here; the room `version`. |
| `family-night-prd-room-members` | platform | `totalScore`, incremented when the match finishes. |

## Invariants kept in code

- The target and any guess before its round is revealed never enter a snapshot, an event or a log; the clue is public.
- A round's item is written once, with `attribute_not_exists`, in the version-conditional write that opens the round, together with `usedSpectrumIds`; nothing overwrites it, so every reader gets the target of the round it holds.
- `/me` returns a target only to the psychic of the stored current round while it is in CLUE or GUESS; `getPlayer` refuses every `#` key.
- A guess is a plain put conditional on not existing; the room-state write that follows recomputes `committedPlayerIds` from the round's guesses and reveals when every guesser has one, so concurrent guessers converge.
- Only guesses of players still in the match count; a departure deletes the leaver's guess in the same write.
- The public state keeps only the last round's result and the running totals.
- Points reach `RoomMembers.totalScore` once, in the write that finishes the match, only for players still in it.
- `usedSpectrumIds` is a list; when every spectrum is used it restarts empty.

## Migrations of note

- 2026-10-18: none; new items in an existing table and new attributes on `Rooms`.
