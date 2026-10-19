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

### Round 1

Done:

- shared: `manada/rules.ts` with answer cleaning and validation (1 to 3 words, 30 characters), `sameAnswer` (Just One's `sameWord` per word, same word count, a leading article dropped), transitive and deterministic `groupAnswers` (union-find; largest first, then by who answered first), majority, `loneAnswererId` for the cow, merge and split recomputed from the round's stored `totalsBefore` and `cowBefore`, win check, winners, departures and `manadaNightPoints` (winners share first, the rest by points with the cow holder among them); `ManadaConfig`, `ManadaPublic`, `ManadaSecret` and the endpoint types; constants `MIN_MANADA_PLAYERS` 3, `MIN_MANADA_ACTIVE` 2, rounds 5 to 15, `MANADA_WIN_POINTS` 8.
- api: `services/manada` in the registry (prepare, next round, departure, `/me`), `PUT answer` (conditional put, then the room write recomputes `answeredPlayerIds` from the stored answers and reveals once), `POST close-answers`, `POST merge-groups`, `POST split-group`; answers as `#ANSWER#{nn}#{playerId}` items in `MatchSecrets`; `usedManadaQuestionIds` on the room through `match-change.ts` and the version bump; `api/src/data/manada-questions.json` with 209 questions and stable slug ids; night points added at FINISHED from `manadaNightPoints`.
- web: La manada card in the picker (now 2 columns from `sm`), its panel (Por rondas with a 5 to 15 stepper, or Hasta 8 puntos), route `$code/manada.tsx`, screens ANSWER (question card, answer form, confirmed answer, "Respondieron N de M", host close with confirmation), REVEAL (group cards with names, "+1 cada uno" or "Empate", host merge by tapping two groups and "Separar", the pink cow card sliding to its new holder, totals), FINISHED (winners banner, cow holder, podium with night points), Espectador; optimistic answer, merge and split; `howToPlay.tsx` with 6 steps; phase vibration.
- Tests: shared (40: grouping, plural per word, article, transitivity, majority ties, every cow case, merge chain and split, win with and without cow, rounds run out, departures, night points, config, question rotation); api (12 with DynamoDB Local: start and minimum, answers absent from every event and snapshot until the reveal, 8 simultaneous answers reveal once, early close, merge and split recompute, a whole match with podium totals in `RoomMembers` and no repeated question across a rematch, until 8 points, departures); web (10 on answer input, spectator, close, reveal, merge and split, result, final and the lobby panel; lobby tests cover the fourth card and its tutorial).
- Screenshots in `screenshots/phase_2/` of the workspace, every screen at 360, 390, 768 and 1280.

Decisions not in the plan:

- Config is `{ goal: 'ROUNDS' | 'POINTS', rounds }`; `rounds` stays stored while the goal is points, so switching back keeps it.
- "Hasta 8 puntos" also ends at round 99 (`MANADA_ROUND_LIMIT`), the highest round any request body accepts, so a match can never get stuck.
- A merge names each group by any member (`groupIds: [a, b]`; a group's id is its first member) and stores the union of both groups' players, so a chain is several merges; "Separar" (`split-group`) undoes every merge inside that group at once, back to the automatic groups.
- Error codes `ANSWER_CONFIRMED` (409, "Ya confirmaste tu respuesta") and `NOT_IN_MATCH` (403, "No juegas esta partida, juegas en la siguiente"), because the UI shows the message as is.
- `/me` returns the caller's own answer only in ANSWER; there is no round secret item because the question is public.
- Winners are the players still in without the cow who have the top score, even at 0; the banner then says "Nadie sumó puntos" and the podium still ranks them first.
- Answers that differ in word count do not group ("hot dog", "hotdog"); the host merge covers them.
- `Scoreboard` takes optional `ranks` so La manada's final lists the podium order (a cow holder with more points below the winners) with the medals of the night points.
- `Row` and `StepButton` moved from Impostor's `ConfigPanel` to `components/lobby/ConfigSection.tsx`, shared by both panels.
- New colour tokens `rose` and `rose-deep` for the game and the pink cow, with contrast tests.
- Group cards list names without avatars: the avatar tones do not read on a paper card.
- `Waiting` puts its dots inline with the text: at 360 px a wrapped message left the dots far from it, in every game.

Pending: none.

Deferred: none.

## Result
