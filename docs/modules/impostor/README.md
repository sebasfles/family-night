---
updated: 2026-10-18
source: 0006_gameplay_and_redesign
---

# Impostor

The first game of Family Night.
Everyone in a room gets the same secret word except the impostors, who get only a clue.
The debate happens in person; the app deals the cards, shows the speaking order, runs the votes and keeps score.

## Boundaries

- Owns: the game rules and their validation, match preparation (word, roles, order, secrets), rounds and voting with confirmation, scoring, the word bank, the Impostor screen, and the `MatchSecrets` and `Votes` tables.
- Does not own: identity, rooms, presence, the room snapshot and its realtime contract, and the generic match lifecycle (start, abort, back to lobby, rematch), which belong to `platform`; AWS resources, which belong to `infra`.
- Code: `shared/src/impostor/`, `api/src/services/impostor/`, `api/src/data/impostor-words.json`, `web/src/games/impostor/`, `web/src/routes/$code/impostor.tsx`.

## Documents

- [prd.md](prd.md): product behavior
- [trd.md](trd.md): structure and endpoints
- [ard.md](ard.md): decisions and debt
- [database.md](database.md): tables and invariants
- [flows.md](flows.md): match phases
