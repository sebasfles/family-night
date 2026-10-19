---
updated: 2026-10-19
source: 0008_scoring_and_manada
---

# La manada

The fourth game of Family Night, an adaptation of Herd Mentality (Big Potato Games).
Each round everyone answers the same question in secret, and the answers that match the most people score; being the only one with a different answer earns the pink cow, and the cow holder cannot win.
It is meant for the whole family at once, from children to grandparents, because there is no right answer, only the family's.

## Boundaries

- Owns: the rules (answer grouping, host merges, majority, the cow, the win, departures, night points by podium), match preparation, the answer, close, merge and split handling, the question bank, the La manada screens and tutorial.
- Does not own: identity, rooms, presence, the snapshot, the match lifecycle, the game registry, `next-round`, the match header, the scoreboard and the lobby's start section (`platform`); the `MatchSecrets` table (`impostor`), where this module keeps its own items; the word normalization it reuses (`justone`); AWS resources (`infra`).
- Code: `shared/src/manada/`, `api/src/services/manada/`, `api/src/handlers/manada.ts`, `api/src/data/manada-questions.json`, `web/src/games/manada/`, `web/src/routes/$code/manada.tsx`.

## Documents

- [prd.md](prd.md): product behavior
- [trd.md](trd.md): structure and endpoints
- [ard.md](ard.md): decisions and debt
- [database.md](database.md): items and invariants
- [flows.md](flows.md): match phases
