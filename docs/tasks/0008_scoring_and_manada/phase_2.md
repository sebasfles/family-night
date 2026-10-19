---
phase: 2
branch: feat/0008_scoring_and_manada
updated: 2026-10-18
---

# Phase 2: La manada

## Scope

- Rules (Sebastian, 2026-10-18), adapted from Herd Mentality (Big Potato Games): each round a question appears on every phone; every player writes a short answer (1 to 3 words, up to 30 characters) in secret and confirms; a confirmed answer cannot change; the round reveals when everyone has confirmed or the host closes it early, missing answers count as none; answers are grouped by normalization (lowercase, accents, plural) and shown with names; the host may merge two groups before counting and points recompute at once; the largest group scores 1 point per member, a tie for the largest group scores nobody; the pink cow goes to the player who is the only one alone with their answer when at least one group of 2 or more exists, with two or more solos or everyone solo the cow does not move, and the holder cannot win while holding it; at the end of a round a player with 8 or more points and no cow wins, if only the cow blocks play continues; config `rounds` 5 to 15 (default 10) or "until 8 points", when rounds run out the highest score without the cow wins with ties shared; minimum 3 players; questions do not repeat within a night, restart when exhausted; departures as Just One, a leaver drops the cow; night points by the phase 1 podium.
- shared: `manada/rules.ts` (normalization reuse, grouping, merge, majority, cow, win, rotation of nothing: no turn roles), `ManadaConfig`, `ManadaPublic`, `ManadaSecret` in the `MatchPublic` union, endpoint types.
- api: `services/manada` (prepare, `PUT .../answer`, `POST .../close-answers`, `POST .../merge-groups`, `POST .../next-round`, departure hook) in the game registry; `api/src/data/manada-questions.json` with about 200 Spanish family-friendly questions, Peruvian vocabulary where it differs, stable ids; `usedManadaQuestionIds` on the room; answers in MatchSecrets until the reveal.
- web: La manada card in the lobby picker with its config panel; route `$code/manada.tsx`; screens ANSWER (question, own answer input, "Respondieron N de M", host Cerrar), REVEAL (groups as cards with names, points per group, the cow moving to its new holder with an animation, totals, host merge by tapping two groups, "Siguiente" or "Ver resultado"), FINISHED (winner or shared winners, cow holder, night points), Espectador variant; `games/manada/howToPlay.tsx` with 4 to 6 steps on the game's own components; vibration on phase change.
- Tests: shared rules (grouping, merge, majority ties, every cow case, win with and without cow, rounds exhausted, departures); api integration (concurrent answers close once, early close, merge recomputes, secrets never in snapshot, questions do not repeat, night points); web Testing Library on answer input, merge and reveal.
- Screenshots at 360, 390, 768 and 1280 px of: lobby with the La manada panel and tutorial, ANSWER (before and after confirm, host), REVEAL (with and without cow move, merge in progress), FINISHED, Espectador.

## Acceptance

1. The host configures rounds or "until 8" and starts La manada with at least 3 online players; every phone moves to the game.
2. Answers never leave MatchSecrets before the reveal (network inspection and automated test).
3. The round reveals when the last player confirms or the host closes it; groups follow normalization and the host can merge two groups, with points and cow recomputed.
4. Scoring, cow and win rules behave as listed for every edge case (shared tests one per case).
5. The match ends on a win without the cow or when rounds run out; night points follow the phase 1 podium.
6. The lobby card has "¿Cómo jugar?" with 4 to 6 steps on the game's components; the `game-tutorial` check is clean.
7. Every verification target passes; screenshots at the four widths; `document-task` creates `docs/modules/manada/` and updates the rest.

## om-developer notes

## Result
