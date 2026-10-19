---
updated: 2026-10-19
source: 0008_scoring_and_manada
---

# La manada: technical

Stack, conventions and verification commands are in [docs/TRD.md](../../TRD.md); the types are in `shared/src/domain.ts` and `shared/src/api.ts`.

## Structure

- `shared/src/manada/rules.ts`: the pure rules (answer cleaning and matching on Just One's `sameWord`, grouping by union-find, merge and split, majority, the cow, the goal, winners, departures, night points); every recompute starts from the round's `totalsBefore` and `cowBefore`.
- `shared/src/schemas.ts`: `manadaConfigSchema`, imported only by the api.
- `api/src/services/manada/`: the game module in `platform`'s registry (prepare, next round, departure, `/me`) and the answer, close, merge and split commands.
- `api/src/data/manada-questions.json`: about 200 Spanish family questions, Peruvian where it differs, with stable slug ids; Sebastian reviews them in PRs.
- `web/src/games/manada/`: the answer, reveal and final screens, the question, answer, group and cow cards, the winner banner, the lobby panel and `howToPlay.tsx`.
- `web/src/routes/$code/manada.tsx`: the screen; `platform` navigates here when the current match is La manada.

## Endpoints owned

`{match}` is `/api/rooms/{code}/matches/{matchId}`; every body carries the round.

- `PUT {match}/answer`: a player commits one answer, once per round.
- `POST {match}/close-answers`: host reveals the round with the answers in.
- `POST {match}/merge-groups`: host merges two groups, each named by any of its members.
- `POST {match}/split-group`: host undoes every merge inside one group.

Shared with `platform` through the game registry: start, rematch and `PUT /config`, `POST {match}/next-round`, `{match}/me` (the caller's own answer, only in ANSWER), `/leave` and `/kick`.
Errors this module raises: `INVALID_CONFIG`, `NOT_ENOUGH_PLAYERS`, `NOT_IN_MATCH`, `ANSWER_CONFIRMED`, `TARGET_NOT_MEMBER`, `STALE_ROUND`, `CONFLICT`.

## Depends on

- `platform`: auth, membership, the room-state write path, the registry, the snapshot and publisher, presence at start, the match header, the scoreboard, the lobby's config and start sections.
- `impostor`: the `MatchSecrets` table and its repo.
- `justone`: `normalizeWord` and `sameWord`.

## Configuration

None; the question bank ships inside the API bundle.

## Testing

- `shared`: Vitest on the rules, one test per cow and win case.
- `api`: integration against DynamoDB Local, including 8 simultaneous answers revealing once, answer texts absent from every event and snapshot until the reveal, merge and split, a whole match with podium totals, no repeated question across a rematch, and departures.
- `web`: Testing Library on the answer input, close, reveal, merge and split (also when a merge leaves one group), the final and the lobby panel; screenshots of every state with `pnpm screenshots`.
