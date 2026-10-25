---
updated: 2026-10-25
source: 0009_wavelength_one_phone
---

# Wavelength: technical

Stack, conventions and verification commands are in [docs/TRD.md](../../TRD.md); the types are in `shared/src/domain.ts` and `shared/src/api.ts`.

## Structure

- `shared/src/wavelength/rules.ts`: the pure rules (bands, psychic average, rotation over `cycles` times `order`, completion, departures, spectrum choice); randomness comes from the caller.
- `shared/src/schemas.ts`: `wavelengthConfigSchema`, imported only by the api.
- `api/src/services/wavelength/`: the game module registered in `platform`'s registry (prepare, next round, departure, secret) and the clue, guess, close-guessing and skip-psychic commands.
- `shared/src/wavelength/spectra.json` behind the subpath `@family-night/shared/wavelength-spectra` (never the package index): about 150 Spanish pairs with stable `{left}.{right}` ids; Sebastian reviews them in PRs.
- `web/src/games/wavelength/`: `Dial` (three stacked layers: face, the scoring bands drawn from `DIAL_BANDS`, the hand with ticks, pins and needle), the four phase screens, `ClueBanner`, `howToPlay.tsx` (the lobby's how-to-play steps, points from the shared rules), `tick.ts` (the Web Audio tick and its mute in localStorage), `myGuess.ts` (the caller's committed value per match and round in `sessionStorage`), `RoundResult` and `Standings` (the reveal and final bodies both modes render), `oneDevice.ts` (the one device match over the shared rules, its storage and validation) and `OneDeviceWavelength.tsx` (its screens).
- `web/src/routes/un-dispositivo/wavelength.tsx`: the one device match, the only web importer of the spectra bank, so the bank stays in that lazy chunk.
- `web/src/routes/$code/wavelength.tsx`: the screen; `platform` navigates here when the current match is Wavelength; the lobby uses `platform`'s cycles panel and the screen its match header.

## Endpoints owned

`{match}` is `/api/rooms/{code}/matches/{matchId}`; every body carries the round.

- `PUT {match}/clue`: the psychic's clue, shown at once on the psychic's phone, opens guessing (reached through `platform`'s shared path).
- `PUT {match}/guess`: a guesser commits a value, once per round (reached through `platform`'s shared path).
- `POST {match}/close-guessing`: host reveals early.
- `POST {match}/skip-psychic`: host cancels the round of an absent psychic.

Shared with `platform` through the game registry: start, rematch and `PUT /config` (config parse and preparation), `POST {match}/next-round`, `{match}/me` (the target, only for the current psychic in CLUE or GUESS) and `/leave` and `/kick`.
Errors this module raises: `INVALID_CONFIG`, `NOT_ENOUGH_PLAYERS`, `NOT_PSYCHIC`, `INVALID_GUESS`, `STALE_ROUND`, `CONFLICT`.
The typed contract is `shared/src/api.ts`.

## Depends on

- `platform`: auth, membership, the room-state write path, the registry, the snapshot and publisher, presence at start.
- `impostor`: the `MatchSecrets` table and its repo.

## Configuration

None; the spectra bank ships inside the API bundle and the one device chunk.
The one device match lives in localStorage under `family-night.one-device.wavelength` (versioned, dropped when it does not validate) and the scales it played under `family-night.one-device.wavelength.spectra`.

## Testing

- `shared`: Vitest on the rules.
- `api`: integration against DynamoDB Local, including 19 simultaneous guesses revealing once, the target and guesses absent from every snapshot and event before the reveal, departures, skip and spectra across rematches.
- `web`: Testing Library on the dial (drag, keys, buttons, name pins), the clue form, guessing, the reveal and a tied scoreboard, and the one device match (no `/api` call, gates, shared scoring, cycling, reload at every step, names); screenshots of every state with `pnpm screenshots`.
