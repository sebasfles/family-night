---
id: "0009"
title: wavelength_one_phone
type: feature
crew: pair
Reiteration 1 (2026-10-25, retakes before the first round; these override the lines above where they differ):

- The mode is one device: user copy says "Un solo dispositivo" (home entry, picker, titles) and never "celular"; the gate reads "Pasa el dispositivo a Y"; every "Un solo celular" above now means this label.
- Naming is `oneDevice` everywhere (files, folders, types, storage key, docs) and the route is `/un-dispositivo`; no `onePhone` left in code or docs.
- Desktop and tablet are first class: every new screen must look composed at 768 and 1280 px, not a stretched phone column; the screenshots at those widths are reviewed as strictly as 390.
- Keyboard: on a guesser's turn the dial takes focus, arrows, PageUp/PageDown, Home and End move it as in multiplayer, and Enter confirms; on gate screens Enter taps the main button. Multiplayer keeps its current keys, no Enter added there.
- Tests add: Enter confirms a guess, and no rendered text contains "celular".

clearance: repo
branch: feat/0009_wavelength_one_phone
modules: [wavelength, platform]
repos: ["."]
phases: 0
depends_on: []
ticket:
created: 2026-10-25
updated: 2026-10-25
---

# 0009 Wavelength on one phone

## Goal

Let the family play Wavelength passing a single phone around, with no room and no other phones.
From the home page the player taps "Un solo celular", picks the game (only Wavelength for now), types how many players there are and their names, and the phone runs the match: it says who is the psychic, hides the target until that player looks, lets each guesser set the dial in turn without seeing the others, and the reveal shows who was right.
Sebastian needs it as fast as possible.

## Scope

- Web only and fully client side: no room, no api call, no DynamoDB, no realtime.
- Home page: a "Un solo celular" option next to Crear sala and Unirme. It opens a game picker for the one phone mode where only Wavelength is playable; the other games show as not available on one phone yet.
- Setup: 2 to 12 players, one name each (2 to 20 visible characters, unique ignoring case and accents); the psychic order is drawn at start.
- Turn:
  1. "Le toca a X" screen; X taps to see the target with the scoring zones and the scale.
  2. X gives the clue aloud (no typed clue) and taps Listo, which hides the target.
  3. For each other player in order: "Pasa el celular a Y", Y moves the dial (same Dial component and tick as multiplayer) and confirms; the dial resets to the centre for the next one, and no previous guess is visible.
- Reveal: the target, every guess pinned by name, the round's points and the running totals, with the same bands and psychic average as the multiplayer mode (shared rules).
- No Vueltas: "Siguiente ronda" passes to the next psychic, cycling forever; "Terminar" shows the final scoreboard and winner; from there "Jugar otra vez" (same players, scores reset) or "Volver al inicio".
- Scales do not repeat within the one phone match until the bank is exhausted.
- The match state lives in localStorage so a reload or a locked screen does not lose it; "Terminar" or starting a new one clears it.
- Tutorial: the existing Wavelength how to play stays valid; add the one phone flow to it only if the `game-tutorial` check asks for it.
- Screenshots of every new screen at 390, 768 and 1280 px with mocked data, refreshed every round.
- `document-task` updates `docs/modules/wavelength/` (prd, trd, flows) and `docs/modules/platform/prd.md` for the home entry, plus `docs/PRD.md` if it lists modes.

## Out of scope

- Night scoreboard: one phone points never reach `RoomMembers.totalScore`.
- Other games on one phone, teams, typed clue, timers.
- Deferred: one phone mode for Impostor, Just One and La manada.

## Acceptance

1. From the home page, "Un solo celular" then Wavelength then players and names starts a match without any network request to `/api`.
2. Each round names the psychic, shows the target only after the psychic taps and hides it on Listo; each guesser sets the dial alone after a "Pasa el celular a Y" screen, and never sees an earlier guess.
3. The reveal shows the target, every guess by name and points computed by the same shared scoring as the multiplayer mode; totals accumulate across rounds.
4. Rounds continue with the next psychic indefinitely until "Terminar", which shows the winner (or tie) and the scoreboard.
5. Reloading the page in the middle of a round resumes the same match at the same step.
6. Names are validated (2 to 20 chars, unique ignoring case and accents, 2 to 12 players).
7. Every verification target passes; the `game-tutorial` check is clean; screenshots at the three widths are in the task workspace.

## Approach

- Module and layers touched: shared (spectra bank exposed to web, reuse of scoring rules), web (home entry, one phone route and screens under `web/src/games/wavelength/`, local state machine), docs.
- Entities, endpoints, tables: none new.
- Decisions (Sebastian, 2026-10-25):
  - Entry on the home page as "Un solo celular", before any room: chosen over a mode inside the lobby because a lobby needs a room and phones.
  - Each guesser sets the dial in turn, hidden: chosen over one shared dial because it keeps the multiplayer mind reading.
  - Local scoreboard for the match only: chosen over feeding the night because there are no registered players.
  - Clue given aloud only: chosen over typing it because it is faster.
  - No Vueltas setting: flexible rounds until Terminar.
  - Fully client side: chosen over an api backed match because there is no secret to protect from other phones and it ships faster.

## Database

None.

## Infra

None.

## Design

Follow the design system of 0006 and the existing Wavelength screens; the hand off screens ("Le toca a X", "Pasa el celular a Y") are new in the same family.

## Risks

- The spectra bank lives in `api/src/data/`; moving it to `shared/` must keep the api import working and the bundle size of web reasonable.
- The CLAUDE.md secret rule targets snapshots, events and logs; the target in localStorage is acceptable in one phone mode because no other device exists.

## Depends on

None.

## Context & decisions

Consolidated 2026-10-25; no product fork needed Sebastian, every point below is the om-reviewer's call from the task and the docs.

Decisions:

- Guessers take the phone in the order the names were typed, starting after the psychic, so it travels around the table; setup asks for names in seating order; the psychic order is still drawn (Scope).
- Every secret sits behind a gate: "Le toca a X" before the target, "Pasa el celular a Y" before each dial, and after the last Confirmar a "Todos adivinaron" screen with Revelar, so the last guesser does not see the reveal alone.
- Acceptance 5 reads as: a reload resumes the same turn at the gate of its step; with the target or a dial on screen it comes back to "Le toca a X" or "Pasa el celular a Y" with the dial at the centre; confirmed guesses are kept, an unconfirmed dial value is not.
- "Terminar" is on the reveal (Scope) and also in a header menu at every step, with a confirmation; mid-round it discards the unrevealed round, so a match always has an exit.
- "Un solo celular" on home goes straight back to a stored match; the picker and setup show only when there is none.
- Scope adjustment: used scales live in their own device key, kept across one phone matches and "Jugar otra vez", restarting when the bank is exhausted; the match key is the one Terminar clears. Reason: the multiplayer rule keeps scales unseen for a night (`docs/modules/wavelength/prd.md#Rules`).
- "Jugar otra vez" redraws the psychic order and resets the scores.
- The one phone picker has no "¿Cómo jugar?": the lobby steps describe own phones and a typed clue; each hand off screen carries one line of instruction instead; the lobby tutorial stays as is.
- The one phone final shows no night points, no "Con 2 jugadores siempre empatan" line and no "Esperando al host".
- Home: the games chip row also gets La manada, missing since 0008.

Constraints:

- No `/api` request from the one phone routes, also on a reload: `IdentityGate` in `web/src/routes/__root.tsx` calls `/api/players/me` on every load, so these routes render outside it while home and `$code` keep it; a test spies on fetch.
- Points only from `shared/src/wavelength/rules.ts` (`dialPoints`, `psychicPoints` or `revealRound`), scales by `pickSpectrum`, target by `drawTarget`, order by `shuffle`, fed by a crypto random int (`docs/modules/wavelength/ard.md`, rotation); no band math in web.
- Reuse `Dial`, `useDialSound`, `Scoreboard` and the reveal and final pieces by extracting them from `RevealPhase` and `Final`, never by copying; the multiplayer screens, their tests and `howToPlay.tsx` stay unchanged in what they render.
- No fake `RoomMember` presence (online dot, "ausente") may show in the one phone UI.
- The spectra bank moves to `shared/` as a subpath export like `./schemas`, not re-exported from `shared/src/index.ts`; web imports it only from the one phone Wavelength route so it lands in that lazy chunk; api and its bank test import the new path.
- Names go through `normalizePlayerName` and `playerNameKey` (`shared/src/players.ts`) with the same Spanish messages as `RenameDialog`; the 12 player limit is a constant in `shared/src/constants.ts`.
- Stored state: one versioned localStorage key, guarded with try/catch as `web/src/identity/storage.ts` does, validated on load and dropped when invalid; never logged.
- Layout per `docs/modules/platform/trd.md`: game agnostic pieces (picker, player setup) in `web/src/components/`, the Wavelength one phone screens and state machine in `web/src/games/wavelength/`; `components/` never imports `games/`.
- Screenshots with `pnpm screenshots` (stored state mocked), every new screen, into `.workspaces/0009_wavelength_one_phone/screenshots/`.

Review beyond the Pipeline:

- Privacy: no target or earlier guess is reachable from a gate screen, exit animations included.
- One test per Acceptance item: fetch never called (1), gated target and a centred dial per guesser (2), points equal to the shared rules over two rounds (3), cycling past a full turn and a tie on Terminar (4), reload at every step (5), each name rule (6).

clearance: repo

## om-developer notes

### Round 1

Done:

- Spectra bank moved to `shared/src/wavelength/spectra.json` behind the subpath `@family-night/shared/wavelength-spectra`; the api and its bank test import it there; in web it lands only in the `/un-dispositivo/wavelength` chunk (checked in the build).
- `IdentityGate` moved from `__root.tsx` into the home and `$code` route components, so `/un-dispositivo` and `/un-dispositivo/wavelength` never call `/api`, also on reload.
- Home: "Un solo dispositivo" under a new "o sin sala" divider; the games chip row now maps the shared catalog, so La manada shows.
- Game agnostic pieces in `components/`: `OneDevicePicker`, `PlayerSetup`, `HandOff`, `games.ts` (the catalog, moved out of `GamePicker.tsx`), `random.ts` (crypto `RandomInt`), `keys.ts` (`useEnterKey`), `DeviceIcon`.
- Wavelength: `oneDevice.ts` (state machine over `WavelengthPublic` and the shared rules, storage and validation), `OneDeviceWavelength.tsx`; `RoundResult`, `Standings` and `SoundToggle` extracted from `RevealPhase`, `Final` and `GuessPhase`, which render the same.
- Reiteration 1 folded in: one device copy and naming, route `/un-dispositivo`, two column layouts at 768 and up, Enter on gates and on the dial.
- Screenshots at 390, 768 and 1280 of every new screen and home in `.workspaces/0009_wavelength_one_phone/screenshots/`.

Decisions not in the plan:

- The local match is a `WavelengthPublic` driven by `startWavelength`, `openRound(turn + 1)`, `recordCommits`, `revealRound` and `finishWavelength`; `turn` grows forever and `psychicOfTurn` wraps it, so no new rule code.
- Player ids are `seat-N`; avatars keep their colour across "Jugar otra vez".
- Storage keys `family-night.one-device.wavelength` (v1, dropped when invalid) and `family-night.one-device.wavelength.spectra`; the match key is cleared on Terminar, so a reload of the final screen opens a new setup.
- `nameOf` and `Scoreboard` take `readonly Player[]` instead of `RoomMember[]`, so local players need no fake presence fields.
- `GAMES` moved to `web/src/components/games.ts` (picker, home chips, lobby share it); `docs/checks/game-tutorial.md` and `docs/conventions/game-tutorial.md` point there now.
- Duplicate name message is "Otro jugador ya se llama así", not RenameDialog's "Alguien de la sala ya se llama así": there is no room here. The length message is the same.
- `MatchHeader` takes an optional `abortTitle`; one device says "¿Terminar la partida? Esta ronda no suma puntos." mid-round and "¿Terminar la partida?" on the reveal; Terminar on the reveal also asks.
- Gates take Enter through a page listener (only when focus is on the body, never on a held key) instead of autofocusing the button, which drew a focus ring on fresh loads; the dial gets `autoFocus` and `onSubmit` props, unused by multiplayer.

Pending: none.

Deferred:

- One device for Impostor, Just One and La manada (out of scope).
- The keyboard hint on the guesser screen shows only at 1024 px and up; tablets with keyboards do not see it.

Note to the om-reviewer: Reiteration 1 was inserted inside the YAML frontmatter of this file, between `crew` and `clearance`; it should move under `Context & decisions`.
