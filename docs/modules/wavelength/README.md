---
updated: 2026-10-18
source: 0004_wavelength
---

# Wavelength

The second game of Family Night.
Each round one player, the psychic, sees where a hidden target sits on a scale between two opposite ideas and types a short clue; everyone else turns a dial on their own phone and commits a guess.
The reveal shows the target, every guess and the points, and the psychic role rotates until everyone has had it.

## Boundaries

- Owns: the rules (scoring bands, psychic rotation, round completion, departures), match preparation, the clue, guess, close, skip and next-round handling, the spectra bank, the Wavelength screens and the dial.
- Does not own: identity, rooms, presence, the snapshot, the match lifecycle and the game registry (`platform`); the `MatchSecrets` table (`impostor`), where this module keeps its own items; AWS resources (`infra`).
- Code: `shared/src/wavelength/`, `api/src/services/wavelength/`, `api/src/handlers/wavelength.ts`, `api/src/data/wavelength-spectra.json`, `web/src/games/wavelength/`, `web/src/routes/$code/wavelength.tsx`.

## Documents

- [prd.md](prd.md): product behavior
- [trd.md](trd.md): structure and endpoints
- [ard.md](ard.md): decisions and debt
- [database.md](database.md): items and invariants
- [flows.md](flows.md): match phases
