---
phase: 1
branch: feat/0008_scoring_and_manada
updated: 2026-10-18
---

# Phase 1: Night scoring and minimum players

## Scope

- Night points awarded at FINISHED to players still in the match, replacing the current rules:
  - Impostor: impostors win, each impostor gets ceil(civilians / impostors); civilians win, each civilian (alive or eliminated) gets 1.
  - Wavelength: podium by final match points, first gets N (players in the match at the end), second N-1, and so on; ties share the place and its points; with 2 players everyone gets 0.
  - Just One: 0.
- Wavelength playable with 2 players (rotation, psychic average and reveal work with one guesser).
- Minimum players per game as one shared constant each (Impostor 3, Wavelength 2, Just One 4) used by `checkStart` in the api and by the lobby, which disables Empezar and says how many are missing for the selected game.
- The FINISHED screen of each game shows the night points each player just earned next to the match result; the lobby scoreboard is unchanged in shape.
- Shared tests for every scoring rule and tie case; api tests that totals reach `RoomMembers`; web tests on the Empezar state.

## Acceptance

1. After an Impostor match the night points follow ceil(civilians / impostors) per impostor or 1 per civilian (shared tests and an api test).
2. After a Wavelength match the night points follow the podium with shared places, and a 2-player match gives 0.
3. After a Just One match nobody's night total changes.
4. Wavelength starts with 2 online players; Impostor needs 3 and Just One 4; the lobby button says what is missing for the selected game.
5. Each FINISHED screen shows the night points earned; screenshots at 360, 390, 768 and 1280 px.
6. Every verification target passes.

## om-developer notes

### Round 1

Done:

- shared: `scoring.ts` with `place` (1, 1, 3 ranking) and `podiumPoints` (N - place + 1); `impostorWinPoints(impostorCount, participantCount)` and `impostorNightPoints(state)` replace `matchScores` and `IMPOSTOR_WIN_POINTS`; `wavelengthNightPoints(state)` replaces `wavelengthScores` (0 when the match started with `WAVELENGTH_UNSCORED_PLAYERS` = 2, podium of the players still in otherwise); `justOneScores` removed.
- shared: `ImpostorPublic.departedIds` (om-reviewer answer): `removePlayer` records every participant who leaves or is kicked while PLAYING; a voted-out player only gets recorded, a living one is also eliminated as before. Night points skip `departedIds`.
- shared: `MIN_WAVELENGTH_PLAYERS` 2, `MIN_JUST_ONE_PLAYERS` 4; `notEnoughPlayersMessage(min)`; the default `NOT_ENOUGH_PLAYERS` message no longer names a number.
- api: each game's `checkStart` throws `notEnoughPlayers(MIN_*)`, so the message names that game's minimum; Impostor and Wavelength add exactly their night-points function at FINISHED; Just One adds nothing (its `finished` helper and the unused `before` of `advance` are gone); `MatchesRepo.get` reads a stored Impostor match without `departedIds` as `[]`.
- web: `scores.ts` ranks with the shared `place`; `Scoreboard` takes `night` and shows "+N a la noche" under each name; Impostor FINISHED titles its list "Puntos para la noche" and renders `impostorNightPoints`; Wavelength FINISHED shows the podium points and, for a match of 2, says it adds nothing; Just One FINISHED says the team score does not reach the night; "Falta 1 jugador" in the singular.
- Tutorials: Impostor's last step explains ceil(civilians / impostors) with the demo family's number from the shared rule; Wavelength's and Just One's last steps say what reaches the night.
- Tests: shared (every win-points case, departed players on both sides, podium ties, 2-player rotation and tie, lone survivor); api (5-player impostor win scores 4, voted-out leaver back as spectator scores 0, legacy match without `departedIds`, Wavelength podium totals, full 2-player Wavelength match with night 0, Just One leaves totals at 0, per-game minimum messages); web (Empezar state per game and count, night points on each FINISHED screen).
- Screenshots in `screenshots/phase_1/` of the workspace, all screens at 360, 390, 768 and 1280, with new shots `lobby-host-justone-missing-players`, `lobby-host-wavelength-two` and `wavelength-final-two`.

Decisions not in the plan:

- No `justOneNightPoints` function: Just One gives nothing, so the api passes no scores and the screen says so; a function returning `{}` would only be ceremony.
- The 0 rule of Wavelength is its own constant (`WAVELENGTH_UNSCORED_PLAYERS`), not `MIN_WAVELENGTH_PLAYERS`, because it is about two players always tying, not about the minimum.
- Night points of the podium are shown as a "+N a la noche" line under each name of the match scoreboard, instead of a second list; under the score it squeezed names at 360 px.
- "Faltan 1 jugador" corrected to "Falta 1 jugador" (it is the copy of this phase's lobby button).

Pending: none.

Deferred: none.

## Result
