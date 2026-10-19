---
updated: 2026-10-18
source: 0007_lobby_polish
---

# Just One: technical

Stack, conventions and verification commands are in [docs/TRD.md](../../TRD.md); the types are in `shared/src/domain.ts` and `shared/src/api.ts`.

## Structure

- `shared/src/justone/rules.ts`: the pure rules (normalization, duplicate and word cancelling, word choice, rotation over `cycles` times `order`, clue completion, review toggles, guess check, scoring with its floor, host override, departures); randomness comes from the caller.
- `shared/src/schemas.ts`: `justOneConfigSchema`, imported only by the api.
- `api/src/services/justone/`: the game module registered in `platform`'s registry (prepare, next round, departure, secret) and the clue, close-clues, cancel-clue, show-clues, guess, accept-guess and skip-guesser commands.
- `api/src/data/justone-words.json`: about 200 concrete Spanish nouns, Peruvian where it differs, with stable ids; Sebastian reviews them in PRs.
- `web/src/games/justone/`: the five phase screens, the word card and the skip button, and `howToPlay.tsx` (the lobby's how-to-play steps, cancellations from the shared rules); the lobby uses `platform`'s cycles panel and the screen its match header.
- `web/src/routes/$code/justone.tsx`: the screen; `platform` navigates here when the current match is Just One.

## Endpoints owned

`{match}` is `/api/rooms/{code}/matches/{matchId}`; every body carries the round.

- `PUT {match}/clue`: a clue-giver commits one word, once per round (reached through `platform`'s shared path).
- `POST {match}/close-clues`: host ends the clue phase early.
- `PUT {match}/cancel-clue`: a clue-giver sets one clue cancelled or not, idempotent.
- `POST {match}/show-clues`: a clue-giver or the host opens the guess.
- `PUT {match}/guess`: the adivinador guesses, or passes with `null` (reached through `platform`'s shared path).
- `POST {match}/accept-guess`: host counts a wrong guess as correct.
- `POST {match}/skip-guesser`: host cancels the round of an absent adivinador.

Shared with `platform` through the game registry: start, rematch and `PUT /config`, `POST {match}/next-round`, `{match}/me` (the word, the caller's clue and the reviewed clues, only for clue-givers of the current round before the reveal), `/leave` and `/kick`.
Errors this module raises: `INVALID_CONFIG`, `NOT_ENOUGH_PLAYERS`, `NOT_CLUE_GIVER`, `TARGET_NOT_MEMBER`, `INVALID_GUESS`, `STALE_ROUND`, `CONFLICT`.

## Depends on

- `platform`: auth, membership, the room-state write path, the registry, the shared match router, the snapshot and publisher, presence at start, the match header and cycles panel.
- `impostor`: the `MatchSecrets` table and its repo.

## Configuration

None; the word bank ships inside the API bundle.

## Testing

- `shared`: Vitest on the rules, normalization cases included.
- `api`: integration against DynamoDB Local, including 19 simultaneous clues opening the review once, the word and clue texts absent from every snapshot and event until they are public, `/me` per seat and phase, departures, skip and words across rematches.
- `web`: Testing Library on the clue form, review toggles, guess, pass, reveal verdicts and the host override; screenshots of every state with `pnpm screenshots`.
