---
id: "0008"
title: scoring_and_manada
type: feature
crew: pair
clearance: repo
branch: feat/0008_scoring_and_manada
modules: [platform, manada, impostor, wavelength, justone]
repos: ["."]
phases: 2
depends_on: []
ticket:
created: 2026-10-18
updated: 2026-10-18
---

# 0008 Night scoring and La manada

## Goal

Make the night's scoreboard comparable across games, give each game the right minimum of players, and add La manada (an adaptation of Herd Mentality) as the fourth game, with its tutorial.
Today Wavelength hands out 20 points a match while Impostor hands out 1 or 2, so a mixed night is decided by one game; Sebastian wants podium-style points per match and a game where everyone, from 8 to 80, can laugh at the same answers.
One task, two ordered phases on one branch, one PR when phase 2 is done.

## Scope

- Phase 1, scoring and minimums, across shared, api and web: night points per game as decided (Impostor, Wavelength, Just One), Wavelength playable with 2, minimum players per game as shared constants validated by the api and shown by the web.
- Phase 2, La manada: rules, endpoints, screens, question bank, tutorial and docs, scoring with the phase 1 rules.
- Each phase: screenshots at 360, 390, 768 and 1280 px with mocked data, refreshed every round; `document-task` at the end of the task creates `docs/modules/manada/` and updates platform, impostor, wavelength and justone docs for the scoring and minimums, plus `docs/PRD.md` and `docs/TRD.md`.

## Out of scope

- A per-game score history beyond the night total.
- Timers.
- Changing in-match scoring of Wavelength (bands) or Just One (team score); only what reaches the lobby changes.

## Acceptance

See each `phase_N.md`.
Overall:

1. Every verification target passes at the end of every phase; the `game-tutorial` check is clean.
2. No secret (La manada answers before the reveal, and every existing secret) enters a snapshot, an event or a log.
3. Screenshots of every changed screen at the four widths are in the task workspace at the end of every round.
4. Module docs, `docs/PRD.md` and `docs/TRD.md` reflect the scoring, the minimums and the new game when the PR opens.

## Approach

- Module and layers touched: shared (constants and rules per game, `manada/rules.ts`, contract), api (points at FINISHED in each game module through `match-change.ts`, `services/manada`, game registry, question bank), web (lobby Empezar state and messages, FINISHED and lobby scoreboards showing night points, `games/manada/` screens and `howToPlay.tsx`, GamePicker card, route).
- Decisions (Sebastian, 2026-10-18):
  - Night points by podium (N for first, N-1 for second, ...) for Wavelength and La manada: chosen over raw match points so every game weighs the same on the night.
  - Ties share the place and get its points: chosen over splitting points because the scoreboard already shows shared places.
  - Impostor: each impostor gets ceil(civilians / impostors) when impostors win, each civilian gets 1 when civilians win: chosen over the flat 1 and 2 because beating a bigger table is worth more and rounding up rewards the rarer win.
  - Just One gives 0 to the night: chosen over the team score because a cooperative score is not comparable.
  - Wavelength with 2 players gives 0 to the night: chosen over N and N-1 because the two always tie.
  - Minimum players live in `shared/` as a constant per game (Impostor 3, Wavelength 2, Just One 4, La manada 3): chosen over DynamoDB or the web because they are rules, not data, and api and web must agree.
  - La manada rules as in phase_2.md: adaptation of Herd Mentality with host merge of groups and automatic normalization because phones cannot argue like a table.
- One branch, phases as milestones, PR after phase 2, per Sebastian's global rule; phase gate as in 0006 (branch pushed, screenshots path reported, `phase 1 approved, continue`).

## Database

`RoomMembers.totalScore` referenced; `Rooms` gets `usedManadaQuestionIds`; `MatchSecrets` holds La manada answers until the reveal; no new tables, no migrations.

## Infra

None.

## Design

Follow the design system of 0006; the La manada cards (question, answer, group reveal, pink cow) are new designs in the same family.

## Risks

- Podium points with departures: the podium counts only players still in the match, as the other games do.
- Grouping free-text answers: normalization will miss some matches; the host merge covers it, and a merge must recompute points and the cow without double counting.
- The cow rule has edge cases (two solos, everyone solo, holder leaves); they are listed in phase_2.md and need shared tests one by one.

## Depends on

None.

## Context & decisions

Consolidated 2026-10-18 by the om-reviewer; the om-manager answered on Sebastian's delegation, taking every om-reviewer recommendation.

Decisions (om-manager for Sebastian, on the om-reviewer's recommendation):

- Impostor: ceil(civilians / impostors) uses the counts at match start (participants minus impostors, over `impostorCount`); every impostor scores on an impostor win, voted out or not; a player who left or was kicked scores nothing, even back as a spectator.
- Wavelength gives 0 only to a match that started with 2; a match that ends with 2 after a departure uses the podium, and a lone survivor gets 1.
- La manada modes (adjustment to phase_2.md Scope): "N rondas" plays every round and the highest score without the cow wins; "Hasta 8 puntos" ends at the end of the first round where someone has 8+ without the cow. In both, several qualifiers: highest score wins, ties shared.
- La manada podium: the winners share first place; everyone else follows by points with shared ties, the cow holder ranked by points among them.
- A player with no answer is in no group, scores nothing and is never "the one alone" for the cow; the largest group needs 2 or more members to score.
- The host can undo a merge until Siguiente, points and cow recomputed; merges chain (A+B, then +C).
- Grouping ignores a leading article (el, la, los, las, un, una, unos, unas) besides case, accents and plural.

Decisions (om-reviewer, accepted):

- Podium ties use the scoreboard's ranking (`web/src/components/scores.ts`): 1, 1, 3, so place p gets N - p + 1.
- La manada departures: a leaver's answer leaves the groups in ANSWER and REVEAL and the round recomputes; a leaver drops the cow; the match ends under 2 players, as Just One.
- Phase gate as 0006: phase 1 clean, the om-reviewer pushes the branch (no PR, no docs) and reports `phase 1 of 2 ready, commit {sha}, screenshots at {path}`; on `phase 1 approved, continue`, phase 2 starts on the same branch with a fresh om-developer; `document-task` once after phase 2; one PR.
- Night points are one pure shared function per game over the FINISHED public state; the api adds exactly its output and the FINISHED screen renders exactly it (as `Final.tsx` of Impostor already does with `matchScores`). Just One's FINISHED says it adds nothing to the night. The lobby button keeps "Iniciar".
- A La manada answer is confirmed by its one `PUT answer`; no provisional server state; a second one is refused.
- Screenshots in `{{workspace}}/screenshots/phase_N/`, refreshed every round.
- `ImpostorPublic` gains `departedIds`: every participant who leaves or is kicked while PLAYING, living or already voted out, so a returning spectator scores nothing; a stored match without it reads as []. Reason: the public state could not tell a voted-out leaver apart (om-developer question, 2026-10-18).

Constraints:

- Contract first in `shared/`; minimums stay the `MIN_*_PLAYERS` constants in `shared/src/constants.ts` (Wavelength 2, Just One 4, La manada 3); `MIN_*_ACTIVE` unchanged.
- Single write path and version rule of `api/src/services/room-state.ts`, games only through the registry (`docs/modules/platform/ard.md`); `usedManadaQuestionIds` follows `usedJustOneWordIds` in `match-change.ts` and the version bump.
- Answers only in `MatchSecrets` before the reveal (`docs/TRD.md` Conventions); the game-tutorial check (`docs/checks/game-tutorial.md`) covers the Impostor step "suman 2" in phase 1 and La manada's tutorial in phase 2.

Review beyond the Pipeline:

- Grouping is transitive and deterministic ("perros calientes" with "perro caliente", plural per word); merge and undo recompute from the round's stored starting totals and cow holder, never by adding twice.
- Concurrent answers reveal once; secrets absent from every snapshot and event; a 2-player Wavelength match end to end in api tests.

Adjustment (om-manager for Sebastian, 2026-10-18): phase 1 approved; no gate after phase 2: when it is clean, `document-task` and publish directly, reporting only `PRs ready` with the screenshot paths.

clearance: repo

## om-developer notes
