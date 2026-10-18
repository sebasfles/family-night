---
id: "0005"
title: just_one
type: feature
crew: pair
clearance: repo
branch: feat/0005_just_one
modules: [justone, platform]
repos: ["."]
phases: 0
depends_on: []
ticket:
created: 2026-10-18
updated: 2026-10-18
---

# 0005 Just One

## Goal

A third game on the platform, cooperative: each round one player is the "adivinador" and everyone else secretly writes a one-word clue for a secret word; duplicate clues are cancelled, the guesser sees the surviving clues and makes one guess, or passes.
The guesser rotates until everyone has been it, and the match ends with the team's score, which every participant adds to the night's scoreboard.

## Scope

- Rules (decided by Sebastian, 2026-10-18): cooperative play with one team score per match; correct guess +1, pass 0, wrong guess -1 with a floor of 0; config `cycles` 1 to 3 (default 1), a cycle being every participant as guesser once; one secret word per round picked by the server from a bank of about 200 Spanish nouns (Peruvian vocabulary where it differs, stable ids, no repeat within a night, restart when exhausted as Wavelength does); minimum 3 online members; clue-givers write one word each; duplicates are cancelled automatically by normalization (lowercase, accents, plural) and in a REVIEW phase the clue-givers see every clue and can cancel any by hand (same root, contains the word), the host taps "Mostrar pistas" to continue; the guess is checked automatically by the same normalization and in REVEAL the host can tap "Contar como acierto" when the automatic check said wrong; the clue phase closes when every clue-giver has committed or when the host closes it early, missing clues count as none; a clue-giver who leaves is dropped from the round, a guesser who leaves cancels the round and the next guesser goes; at FINISHED every participant adds the team score to `RoomMembers.totalScore`.
- shared: `justone/rules.ts` pure functions (normalization, duplicate detection, guesser rotation, round completion, scoring, word choice from an injected random source) with Vitest cases; `JustOneConfig` with zod schema, `JustOnePublic`, `JustOneSecret` added to the `MatchPublic` union keyed by `gameType`; request and response types of the endpoints below.
- api: `services/justone` (prepare, `PUT .../clue`, `POST .../close-clues`, `PUT .../cancel-clue` toggle, `POST .../show-clues`, `PUT .../guess` with pass, `POST .../accept-guess`, `POST .../next-round`, departure hook) under `/api/rooms/{code}/matches/{matchId}/...`, dispatched by `gameType` from the platform match service through the game registry; `api/src/data/justone-words.json`; `usedWordIds` on the room; the secret word and the uncommitted clues in MatchSecrets, the word served to clue-givers of the current round through `/me` and never to the guesser before REVEAL; round in bodies and `STALE_ROUND`.
- web: Just One card active in the lobby selector with its config panel (cycles), "Próximamente" removed; route `$code/justone.tsx` reached by the platform navigation effect; screens CLUE (clue-givers: word and clue input; guesser: "Están escribiendo pistas..." with N of M), REVIEW (clue-givers: every clue with cancelled ones marked, tap to toggle; guesser: waiting; host "Mostrar pistas"), GUESS (guesser: surviving clues, guess input, Pasar; others: the clues and "X está adivinando..."), REVEAL (word, guess, result, team score, host "Contar como acierto" when wrong, "Siguiente ronda" or "Ver resultado"), FINISHED (team score with rounds won, Jugar otra vez and Volver al lobby for the host); Espectador variant; vibration on phase change.
- Tests: shared rules (normalization cases, duplicates, rotation across cycles, scoring with floor, guesser leaves, clue-giver leaves, word bank restart); api integration (start, clue commits close the phase once, early close, cancel toggle, show, guess and pass, accept-guess, `/me` never gives the word to the guesser, snapshot never carries the word or uncommitted clues before REVEAL, no word repeat, scoring into totals); web Testing Library on clue input, review toggles, guess and reveal.
- Screenshots at 390, 768 and 1280 px with mocked data of: lobby with the Just One panel, CLUE (clue-giver and guesser), REVIEW (clue-giver and host), GUESS (guesser and others), REVEAL (correct and wrong, host), FINISHED, Espectador.
- Docs: `document-task` creates `docs/modules/justone/` (README, prd, trd, ard, database) and updates `docs/TRD.md`, `docs/PRD.md` (module lists, "Not in the product" entry) and platform `trd.md`.

## Out of scope

- Individual scoring.
- The 5-word card and the dice of the board game.
- Timers.
- Deferred: a fourth game.

## Acceptance

1. The host configures cycles and starts Just One with at least 3 online members; every phone moves to the game within a second.
2. Only the clue-givers see the word; the snapshot, the events and `/me` of the guesser never carry it before REVEAL, and uncommitted clues never leave MatchSecrets (network inspection and automated test).
3. Each clue-giver commits one word per round; the phase moves to REVIEW when the last one commits or the host closes it early.
4. In REVIEW the duplicates found by normalization are already cancelled, any clue-giver can toggle a clue, the guesser sees nothing until the host taps "Mostrar pistas".
5. The guesser sees only surviving clues and submits one guess or passes; the result is checked by normalization and the host can count a wrong guess as correct.
6. Team score follows +1, 0, -1 with a floor of 0 and is added to every participant's lobby total at the end.
7. The guesser rotates in order through every participant per cycle; the match ends after the configured cycles with the final score, and Jugar otra vez picks unseen words.
8. A guesser who leaves cancels the round and the next one goes; a clue-giver who leaves is dropped from the round.
9. Repeated taps answer `STALE_ROUND`; concurrent clue commits close the phase exactly once (test).
10. Every verification target passes; screenshots of every screen at the three widths are in the task workspace.

## Approach

- Module and layers touched: `justone` (new, primary) across shared, api and web; `platform` for the lobby card, the game registry entry, the `MatchPublic` union and the navigation effect.
- Entities, endpoints, tables: `JustOnePublic` phases CLUE, REVIEW, GUESS, REVEAL, FINISHED; endpoints listed in Scope; `MatchSecrets` for the word and clues, `usedWordIds` on the room, `RoomMembers.totalScore`.
- Decisions:
  - Cooperative team score added to every participant's total: chosen over individual points because the game is cooperative by design and the lobby scoreboard needs a number per player.
  - Wrong guess costs 1 with a floor of 0: chosen over no penalty because passing must remain a real choice, as in the board game.
  - One word per round from the server: chosen over the 5-word card and dice because the choice adds no fun on a phone.
  - Automatic normalization plus a manual REVIEW by the clue-givers: chosen over automatic only because the cancellation of near-duplicates is the social part of the game and the guesser must not take part.
  - Automatic guess check with a host override: chosen over a vote because the host already resolves stuck situations on the platform.
  - Same departure policy as Wavelength: one rule for leave and kick.

## Database

Tables referenced: `Matches`, `MatchSecrets`, `Rooms` (`usedWordIds`), `RoomMembers` (`totalScore`), as documented in `docs/modules/platform/database.md` and `docs/modules/wavelength/database.md`.
No migrations; no new tables.
Invariant: the word and the uncommitted clues exist only in `MatchSecrets` until REVEAL.

## Infra

None.

## Design

None; follow the Wavelength screens.

## Risks

- Spanish normalization (plural, accents, same root) can miss near-duplicates or cancel false ones; the manual REVIEW covers it.
- Typed guesses with typos read as wrong; the host override covers it.

## Depends on

None.

## Context & decisions

Consolidated 2026-10-18 by the om-reviewer with Sebastian through the om-manager.

Decisions (Sebastian, on the om-reviewer's recommendation):

- The floor of 0 applies after every round, so the team score never shows below 0; "Contar como acierto" recomputes that round from the score before it.
- "Mostrar pistas" can be tapped by any clue-giver and by the host, also when the host is the adivinador (without seeing the clues).
- Scope addition: host-only `POST {match}/skip-guesser {round}` ("Saltar turno", with confirmation), shown while the adivinador is offline in CLUE, REVIEW or GUESS; it cancels the round as a departure does and the skipped player keeps their later turns, with no server presence check, as skip-psychic in `docs/modules/wavelength/ard.md`.
- A clue equal to the word after normalization is auto-cancelled in REVIEW like a duplicate and can be toggled back.

Decisions (om-reviewer, accepted by Sebastian):

- Adjustment to Acceptance 2 and the Database invariant: committed clues stay in MatchSecrets until GUESS, when only the surviving ones enter the public state; cancelled clues stay there until REVEAL. In REVIEW the clue texts reach clue-givers only through `/me`; the public state carries only who has a clue and which are cancelled.
- Adjustment to Scope: Just One keeps its own `usedJustOneWordIds` on the room, not Impostor's `usedWordIds` (`docs/modules/platform/database.md`); on exhaustion only that list restarts.
- `PUT {match}/cancel-clue` carries `{ round, authorId, cancelled }`, the state wanted, not a blind toggle; repeating it changes nothing.
- Departures, rotation and spectators as Wavelength: order drawn once with crypto; a leaver is out of the whole match; a rejoin is Espectador and gets nothing secret; under 2 active players the match finishes with the score so far; the team score reaches only players still in the match.
- The adivinador leaving in REVEAL changes nothing; a clue-giver leaving in CLUE or REVIEW takes only their own clue out; in GUESS or REVEAL the clues stay as they are.
- One clue per clue-giver per round, not editable, second commit as Wavelength's guess; a clue is one word, no whitespace, 1 to 30 characters.
- Round 1 delivers shared and api only; web follows from round 2.

Constraints:

- Clue commits follow Wavelength's guess pattern (`docs/modules/wavelength/ard.md`): a plain put of a `#`-keyed MatchSecrets item conditional on not existing, then the `api/src/services/room-state.ts` sync that recomputes who committed and moves to REVIEW exactly once.
- The round's word item is put with `attribute_not_exists` in the version-conditional write that opens the round, together with `usedJustOneWordIds`; games reach the platform only through `api/src/services/games.ts` (`docs/modules/platform/ard.md`).
- `/me` returns the word only to active clue-givers of the stored current round before REVEAL, never to the adivinador, a spectator or a departed player; `getPlayer` keeps refusing `#` keys.
- The secret now changes within a round (CLUE: word and own clue; REVIEW: every clue), which is the revisit condition of platform `ard.md` "The secret query is keyed by match and round": the web key adds the phase.
- New error codes only where an existing message names another game's concept (`docs/modules/wavelength/ard.md`); `INVALID_GUESS` already fits a guess from a non-adivinador.
- Normalization removes accents but keeps `ñ` distinct from `n`; plural cases cover `-s`, `-es` and `-ces` to `-z`.
- The lobby's game `pick` in `web/src/routes/$code/index.tsx` is generalized by `gameType`, and the "Próximamente" branch of `GamePicker.tsx` is removed, not kept as dead code.
- Docs beyond the task's list: platform `database.md` (`usedJustOneWordIds`), `prd.md` ("Próximamente"), `ard.md` (secret key); impostor `database.md` (Just One items in MatchSecrets); the secret lists in `docs/TRD.md` and `CLAUDE.md`.

Review beyond the Pipeline:

- 19 simultaneous clue commits: all 200, one REVIEW publish, no `CONFLICT`; a serialized snapshot and every event free of the word and of any clue text in CLUE and REVIEW, and of cancelled clue text in GUESS.
- Word bank: about 200 family-friendly concrete nouns, guessable from one-word clues, unique stable ids, Peruvian vocabulary.
- Screenshots of every listed state plus Saltar turno at 390, 768 and 1280 px.

clearance: repo

## om-developer notes
