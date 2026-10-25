---
updated: 2026-10-25
source: 0009_wavelength_one_phone
---

# Wavelength

The second game of Family Night.
Each round one player, the psychic, sees where a hidden target sits on a scale between two opposite ideas and types a short clue; everyone else turns a dial on their own phone and commits a guess.
The reveal shows the target, every guess and the points, and the psychic role rotates until everyone has had it.
It also plays on one device passed around the table, with no room and no server.

## Boundaries

- Owns: the rules (scoring bands, psychic rotation, round completion, departures), match preparation, the clue, guess, close, skip and next-round handling, the spectra bank, the Wavelength screens, the dial and its tick, and the one device match.
- Does not own: identity, rooms, presence, the snapshot, the match lifecycle and the game registry (`platform`); the `MatchSecrets` table (`impostor`), where this module keeps its own items; AWS resources (`infra`).
- Code: `shared/src/wavelength/`, `api/src/services/wavelength/`, `api/src/handlers/wavelength.ts`, `web/src/games/wavelength/`, `web/src/routes/$code/wavelength.tsx`, `web/src/routes/un-dispositivo/wavelength.tsx`.

## Documents

- [prd.md](prd.md): product behavior
- [trd.md](trd.md): structure and endpoints
- [ard.md](ard.md): decisions and debt
- [database.md](database.md): items and invariants
- [flows.md](flows.md): match phases
