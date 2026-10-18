---
updated: 2026-10-18
source: 0004_wavelength
---

# Wavelength: technical

Stack, conventions and verification commands are in [docs/TRD.md](../../TRD.md); the types are in `shared/src/domain.ts` and `shared/src/api.ts`.

## Structure

- `shared/src/wavelength/rules.ts`: the pure rules (bands, psychic average, rotation over `cycles` times `order`, completion, departures, spectrum choice); randomness comes from the caller.
- `shared/src/schemas.ts`: `wavelengthConfigSchema`, imported only by the api.
- `api/src/services/wavelength/`: the game module registered in `platform`'s registry (prepare, next round, departure, secret) and the clue, guess, close-guessing and skip-psychic commands.
- `api/src/data/wavelength-spectra.json`: about 150 Spanish pairs with stable `{left}.{right}` ids; Sebastian reviews them in PRs.
- `web/src/games/wavelength/`: `Dial`, the lobby panel, the four phase screens, the scoreboard, `myGuess.ts` (the caller's committed value per match and round in `sessionStorage`).
- `web/src/routes/$code/wavelength.tsx`: the screen; `platform` navigates here when the current match is Wavelength.

## Endpoints owned

`{match}` is `/api/rooms/{code}/matches/{matchId}`; every body carries the round.

- `PUT {match}/clue`: the psychic's clue, opens guessing.
- `PUT {match}/guess`: a guesser commits a value, once per round.
- `POST {match}/close-guessing`: host reveals early.
- `POST {match}/skip-psychic`: host cancels the round of an absent psychic.

Shared with `platform` through the game registry: start, rematch and `PUT /config` (config parse and preparation), `POST {match}/next-round`, `{match}/me` (the target, only for the current psychic in CLUE or GUESS) and `/leave` and `/kick`.
Errors this module raises: `INVALID_CONFIG`, `NOT_ENOUGH_PLAYERS`, `NOT_PSYCHIC`, `INVALID_GUESS`, `STALE_ROUND`, `CONFLICT`.
The typed contract is `shared/src/api.ts`.

## Depends on

- `platform`: auth, membership, the room-state write path, the registry, the snapshot and publisher, presence at start.
- `impostor`: the `MatchSecrets` table and its repo.

## Configuration

None; the spectra bank ships inside the API bundle.

## Testing

- `shared`: Vitest on the rules.
- `api`: integration against DynamoDB Local, including 19 simultaneous guesses revealing once, the target and guesses absent from every snapshot and event before the reveal, departures, skip and spectra across rematches.
- `web`: Testing Library on the dial (drag, keys, buttons), the clue form, guessing, the reveal and a tied scoreboard; screenshots of every state with `pnpm screenshots`.
