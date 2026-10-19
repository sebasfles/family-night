---
updated: 2026-10-19
source: 0008_scoring_and_manada
---

# Just One

The third game of Family Night, cooperative.
Each round one player, the adivinador, must guess a secret word; everyone else writes a one-word clue without seeing the others', repeated clues are cancelled, and the adivinador sees only what survives and guesses once or passes.
The team scores together; the score stays in the match and adds nothing to the night's scoreboard.

## Boundaries

- Owns: the rules (normalization, duplicate cancelling, guesser rotation, scoring with its floor, departures), match preparation, the clue, close, review, show, guess, accept and skip handling, the word bank, the Just One screens.
- Does not own: identity, rooms, presence, the snapshot, the match lifecycle, the game registry, the shared `clue` and `guess` paths, the match header and the cycles panel (`platform`); the `MatchSecrets` table (`impostor`), where this module keeps its own items; AWS resources (`infra`).
- Code: `shared/src/justone/`, `api/src/services/justone/`, `api/src/handlers/justone.ts`, `api/src/data/justone-words.json`, `web/src/games/justone/`, `web/src/routes/$code/justone.tsx`.

## Documents

- [prd.md](prd.md): product behavior
- [trd.md](trd.md): structure and endpoints
- [ard.md](ard.md): decisions and debt
- [database.md](database.md): items and invariants
- [flows.md](flows.md): match phases
