---
id: "0004"
title: wavelength
type: feature
crew: pair
clearance: repo
branch: feat/0004_wavelength
modules: [wavelength, platform]
repos: ["."]
phases: 0
depends_on: ["0003"]
ticket:
created: 2026-10-17
updated: 2026-10-17
---

# 0004 Wavelength

## Goal

A second game on the platform: one player per round is the "psíquico", sees where a hidden target sits on a spectrum between two opposite concepts (e.g. "Frío ... Caliente"), types a short clue, and everyone else turns a dial on their own phone and commits a guess; when all have committed, the reveal shows the target, every guess and the points.
The psychic rotates until everyone has been it, and the match ends with a final scoreboard.

## Scope

- Rules (decided by Sebastian, 2026-10-17): individual play, no teams, each player with their own dial; the clue is typed by the psychic (max 40 characters) and shown on every screen; a guess scores by distance on a 0 to 100 dial (4 points within 5, 3 within 10, 2 within 15, 1 within 25, else 0) and the psychic scores the rounded average of the guessers' points; config `cycles` 1 to 3 (default 1), a cycle being every participant as psychic once; the guess phase closes when every guesser has committed or when the host closes it early, uncommitted guessers scoring 0; a guesser who leaves is dropped from the round, a psychic who leaves cancels the round and the next psychic goes; spectra do not repeat within a night.
- shared: `wavelength/rules.ts` pure functions (scoring, psychic rotation, round completion, spectrum choice from an injected random source) with Vitest cases; `WavelengthConfig` with zod schema, `WavelengthPublic`, `WavelengthSecret` added to the `MatchPublic` union keyed by `gameType`; request and response types of the endpoints below.
- api: `services/wavelength` (prepare, `PUT .../clue`, `PUT .../guess`, `POST .../close-guessing`, `POST .../next-round`, departure hook) under `/api/rooms/{code}/matches/{matchId}/...`, dispatched by `gameType` from the platform match service as Impostor is; `api/src/data/wavelength-spectra.json` with about 150 Spanish pairs, Peruvian vocabulary where it differs, stable ids; `usedSpectrumIds` on the room with per-exhaustion reset; the target in MatchSecrets `#MATCH`, served to the psychic of the current round through `/me`; round in bodies and `STALE_ROUND`; scoring into `RoomMembers.totalScore` at `FINISHED`.
- web: Wavelength card active in the lobby selector with its config panel (cycles); route `$code/wavelength.tsx` reached by the platform navigation effect; screens CLUE (psychic: spectrum, target on the dial, clue input; others: spectrum and "X está pensando la pista..."), GUESS (clue on every screen, own dial with commit button, "Adivinaron N de M", host Cerrar), REVEAL (target, every guess with name on the dial, round points and totals, host "Siguiente ronda" or "Ver resultado"), FINISHED (final scoreboard, Jugar otra vez and Volver al lobby for the host); Espectador variant; vibration on phase change.
- Tests: shared rules (scoring bands, psychic average, rotation across cycles, round completion, psychic leaves, guesser leaves); api integration (start, clue, concurrent guesses close the round once, early close scores 0, `/me` only for the psychic, snapshot never carries the target before reveal, spectra do not repeat, scoring); web Testing Library on dial, clue input and reveal.
- Screenshots at 390, 768 and 1280 px with mocked data of: lobby with the Wavelength panel, CLUE (psychic and others), GUESS (before and after commit, host), REVEAL, FINISHED, Espectador.
- Docs: `document-task` creates `docs/modules/wavelength/` (README, prd, trd, ard, database) and updates `docs/TRD.md` and `docs/PRD.md` module lists and platform `trd.md`.

## Out of scope

- Teams and the original left/right counter-guess.
- Timers.
- Deferred: Just One (next game).

## Acceptance

1. The host configures cycles and starts Wavelength with at least 3 online members; every phone moves to the game within a second.
2. Only the psychic sees the target; the snapshot, the events and `/me` of other players never carry it before the reveal (network inspection and automated test).
3. The clue typed by the psychic appears on every phone and opens the guess phase; each guesser commits once per round and may adjust before committing.
4. The round reveals when the last guesser commits, or when the host closes it; uncommitted guessers score 0.
5. Points follow the distance bands and the psychic gets the rounded average; totals accumulate on the lobby scoreboard at the end.
6. The psychic rotates in order through every participant per cycle; the match ends after the configured cycles with the final scoreboard, and Jugar otra vez picks unseen spectra.
7. A psychic who leaves cancels the round and the next one goes; a guesser who leaves is dropped from the round.
8. Repeated taps answer `STALE_ROUND`; concurrent guesses close the round exactly once (test).
9. Every verification target passes; screenshots of every screen and state are in the workspace.

## Approach

- Module and layers touched: wavelength in shared (rules, types), api (`services/wavelength`, spectra bank) and web (`games/wavelength`, `$code/wavelength.tsx`); platform in api (dispatch by `gameType`, config defaults) and web (lobby card and panel).
- Entities, endpoints, tables: WavelengthPublic, WavelengthSecret, Guess; the four endpoints above plus the shared lifecycle; Matches, MatchSecrets, Rooms (`usedSpectrumIds`, config), RoomMembers (`totalScore`).
- Follow the Impostor module's shape (pure rules in shared, service dispatched by game type, nested routes, round in bodies) so the second game proves the platform's extension points.
- Decisions:
  - Guesses stored in the match public state only after reveal, committed guesses kept in MatchSecrets until then: chosen over public guesses during GUESS because seeing others' dials would anchor the rest.
  - Dial as an own component (semicircle, touch drag, 0 to 100): chosen over a native range input because the game's feel is the dial.

## Database

Referenced: Matches (`publicState`), MatchSecrets (`#MATCH` target and per-round committed guesses), Rooms (`usedSpectrumIds`, remembered config), RoomMembers (`totalScore`).
No new tables, no migrations.

## Infra

None. Code ships through `deploy-api` and `deploy-web`.

## Design

None; the design rules in `docs/TRD.md`.

## Risks

- The dial on touch screens must feel precise at 1 point of 100; the screenshots cannot show that, Sebastian tries it on a phone after merge.
- Spectrum quality (pairs that are not opposites, or culturally foreign) only shows in play; Sebastian reviews the JSON in the PR.

## Depends on

0003 (match lifecycle, dispatch by `gameType`, nested match routes, config endpoint). Merged 2026-10-17.

## Context & decisions

Consolidated 2026-10-17 by the om-reviewer with Sebastian through the om-manager.

Decisions (Sebastian):

- The psychic scores the rounded average of the committed guessers' points only, 0 when nobody committed.
- Scope addition: host-only `POST {match}/skip-psychic {round}` in CLUE, shown as "Saltar turno" only while the psychic is offline; the round is cancelled as on a psychic departure and the skipped player keeps their later turns.
- Leave or kick drops the player from the whole match: current round (committed guess discarded) and psychic rotation; a rejoin watches as Espectador, no points; under 2 participants left the match finishes at once with the points so far.
- Psychic order is drawn once at start with crypto randomness and kept for every cycle.

Decisions (om-reviewer, accepted by Sebastian):

- Platform scope addition: `selectedGame` on the room and in the snapshot, set by `PUT /config` (the host tapping a card sends that game's config) and by start, default `IMPOSTOR`; members see the chosen game and its config read only.
- Platform scope addition: a game registry keyed by `gameType` in the api; start, config, rematch, `/me`, departure and default configs call the game through it. `services/matches` imports Impostor directly today, so 0003 did not deliver the dispatch.
- The Wavelength header carries the host menu Terminar partida as Impostor; shared pieces (host menu, `vibrate`, name of a departed player) move to `web/src/components/`, never imported across `games/` folders.
- Dial: drag plus −/+ buttons of 1 point (48 px), `role="slider"` with arrow keys.
- Target an integer 0 to 100 drawn with crypto; guesses integers 0 to 100; bands inclusive on `|guess − target|`; average rounded half up (2.5 is 3).
- A second clue, or a second commit by the same guesser, in the same round answers `STALE_ROUND` and changes nothing; the UI locks the control from the first tap.
- Round 1 delivers `shared` and `api` only; web follows from round 2.

Constraints:

- Commits follow Impostor's ballot pattern (`docs/modules/impostor/ard.md`, plain ballot put then snapshot sync): a plain put of the guess (`#`-prefixed sort key in MatchSecrets, conditional on not existing), then the `room-state.ts` write that recomputes who committed and reveals when all have; the close reads the round's guess items. Guesses inside the version transaction exhaust the four attempts at 20 players.
- Every snapshot change goes through `api/src/services/room-state.ts`; the round's target, the `#MATCH` update and `usedSpectrumIds` are written in the same version-conditional transaction as the round that uses them.
- The target is the secret, the Wavelength clue is public: the target and uncommitted or unrevealed guesses never enter a snapshot, an event or a log (`docs/TRD.md` Conventions). `/me` returns the target only to the current round's psychic in CLUE or GUESS, judged from the stored public state; `getPlayer` refuses any `#` key.
- The web secret query is keyed by match and round (`web/src/api/match.ts` caches `['match-secret', matchId]` forever, which would hide the target from a later psychic).
- The public state keeps only the last round's result and the running totals, no history; the snapshot stays small at 20 players by 3 cycles.
- `shared/src/index.ts` re-exports every rules file: generic helpers (`RandomInt`, `shuffle`) move to a common shared file and the Wavelength names must not collide with Impostor's. The `cycles` zod schema lives in `@family-night/shared/schemas`, kept out of the web bundle.
- Docs beyond the task's list: platform `database.md` (`selectedGame`, `usedSpectrumIds`), `ard.md` (registry), `prd.md` and `docs/PRD.md` ("Próximamente" lines), the secrets list in `docs/TRD.md` and `CLAUDE.md` gains the Wavelength target.

Review beyond the Pipeline:

- All guessers committing at once: all 200, all counted, one REVEAL publish, no `CONFLICT`; skip, departures and rotation across cycles tested in shared and api.
- Spectra bank: about 150 real opposites, unique stable ids, family friendly, Peruvian vocabulary.
- Navigation effect generalized by game; screenshots of every listed state, Saltar turno and Terminar partida included, at 390, 768 and 1280.

clearance: repo

## om-developer notes

### Round 1

Done (shared and api, as `Context & decisions` set for this round):
- `shared`: `random.ts` holds `RandomInt` and `shuffle` (moved out of Impostor's rules); `wavelength/rules.ts` with scoring, rotation, round completion, departures and spectrum choice; Wavelength types, `selectedGame` on `RoomSnapshot`, `GameConfigRequest` as a union by `gameType`, `MatchSecret` union, `wavelengthConfigSchema` in `schemas.ts`.
- `api`: game registry `services/games.ts` (`gameOf`, `resolveConfigs`, replaces `configs.ts`) used by start, config, rematch, next-round, `/me`, departure and defaults; `services/wavelength` with clue, guess, close-guessing, skip-psychic; `data/wavelength-spectra.json` with 152 pairs; `Rooms.selectedGame` and `usedSpectrumIds`; guesses as `#GUESS#{round}#{playerId}` items in MatchSecrets, the round's target in `#MATCH`.
- `web`: only what the new contract needs to compile (fixtures get `selectedGame` and the Wavelength config; the Impostor screen narrows by `gameType` and ignores a psychic secret). No Wavelength UI yet.

Decisions not recorded in the plan:
- `POST {match}/next-round` moved from the Impostor router to the platform router, which dispatches by the current match's `gameType`; both games use that path, and two routes on one method and path cannot coexist in Hono.
- A command meant for the other game (a clue on an Impostor match) answers `STALE_ROUND`.
- New error codes: `NOT_PSYCHIC` (403, a clue from anyone but the psychic) and `INVALID_GUESS` (422, a guess from the psychic, a departed player or a spectator).
- `skip-psychic` does not check that the psychic is offline on the server; the client shows the button only then, and the server's 45 s window could disagree with the phone's view at the edge.
- The registry is a function, not a module-level object: `room-state` imports it and the game services import `room-state`, so an object built at load time could hit a binding not yet initialized.
- Public state fields: `turn` (position in the cycles times order sequence) beside `round` (bumped by every opened round, cancelled ones included), `departedIds`, `totals` per participant, `skipped` (the cancelled turn, cleared by the next clue), `lastResult.guesses` listing every guesser with `value: null` for those who did not commit.
- A second commit answers `STALE_ROUND` only if the first one is already counted; if its sync had failed, the retry syncs it and answers 200.
- Spectrum ids are `{left}.{right}` slugs; on exhaustion `usedSpectrumIds` restarts from empty.

Pending: web (round 2): lobby card and panel, `$code/wavelength.tsx`, the dial, the screens, the match-and-round-keyed secret query, the generalized navigation, shared pieces into `web/src/components/`, screenshots.

Deferred: none.

### Round 2

Finding applied:
- Each round's target is its own MatchSecrets item, `#ROUND#{nn}`, put with `attribute_not_exists` in the version-conditional write that opens the round; reveal, close and `/me` read the key of the round they hold, so a decide that lost the race fails the version condition and retries instead of reading a newer round. `#MATCH` stays Impostor's. Test: a later round's item already stored leaves `/me` and the reveal of the earlier round untouched.

Web done:
- Lobby: `GamePicker` takes the selected game; the host taps a card (`Jugar {game}`, a stretched button over the card) and `PUT /config` sends that game's current config; members see the chosen card only. `StartSection` (players online plus Iniciar) is shared by both panels. Wavelength panel: Vueltas 1 to 3 as a radiogroup with the rounds it means.
- `$code/route.tsx` navigates by a `gameType` to path map; `$code/wavelength.tsx` renders CLUE, GUESS, REVEAL and FINISHED, the Espectador variant, Saltar turno (host, psychic offline, with confirm), Cerrar (host, confirm when guesses are missing) and the Terminar partida menu.
- `Dial`: SVG semicircle, pointer drag with capture, 1-point −/+ buttons, `role="slider"` with arrows, PageUp/PageDown by 10, Home and End; bands with their points around a target, name markers for the reveal; read-only it is an `img`.
- Moved to `web/src/components/`: `AbortMatchMenu` (host menu plus confirm), `match.ts` (`nameOf`, `vibrate`, `usePhaseVibration`); Impostor imports them.
- `useMatchSecret` is keyed by match and round (Impostor passes `null`); a test shows a psychic in a later round fetching again, and it fails with the old key.
- `myGuess.ts` keeps the caller's committed value per match and round in `sessionStorage`, as `myVote` does.
- Screenshots: `{{workspace}}/screenshots/`, 129 files at 390, 768 and 1280 (Impostor and lobby refreshed too), every listed Wavelength state including Saltar turno with confirm, Cerrar confirm, psychic waiting, member views, Espectador and Terminar partida.

Decisions not recorded in the plan:
- The clue form and Confirmar lock on the first tap and unlock only if the server refuses (the command's promise rejects), so a failed request is not a dead end.
- On a locked dial the −/+ buttons are hidden, not disabled; the value stays shown.
- The psychic sees no badge in the header (the screen already says "Eres el psíquico"), the subtitle reads "Psíquico: tú".
- The final screen ranks the players still in the match by `totals`; ties are named together, nobody scoring says so.

Fixed along the way: my round 1 api test used `room.member(3)` as a latecomer while it was a participant, so it failed whenever that player drew the psychic; it now uses a player who joins after the start.

Pending: docs (after the clean signal).

Deferred: in the lobby member list at 390 px the host's crown wraps under "(tú)" on its own line (`components/lobby/MemberList.tsx`, from 0002, untouched here). Fixed in round 3.

### Round 3

Findings applied:
- `MemberList`: "(tú)" and the crown sit in one no-wrap group with the last word of the name, so they never wrap alone; at 390 px a name that does not fit takes them to the next line with its last word, at 768 and 1280 they stay on the name's line.
- Scoreboard ranks are shared on ties (competition ranking: 4, 2, 2, 0 reads 1, 2, 2, 4), computed in `ranking()` of `games/wavelength/model.ts`; a Testing Library case pins a tied table.
- Screenshots regenerated, all 129.

Pending: docs (after the clean signal).

Deferred: none.

### Docs

- `document-task` created `docs/modules/wavelength/` (README, prd, trd, ard, database, flows) and updated platform (README, prd, trd, database, ard) and impostor (trd, database).
- Beyond `docs/modules/` and the debt index, as the task's Scope and `Context & decisions` ask: module and secret lists in `docs/TRD.md`, the Wavelength capability in `docs/PRD.md`, the secret list in `CLAUDE.md`. No global `Decisions` entry of `docs/ARD.md` was edited.
- Debt index: one new row (wavelength, spectra restart may repeat the last spectrum). No earlier debt resolved.
