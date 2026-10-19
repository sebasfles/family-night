---
id: "0007"
title: lobby_polish
type: feature
crew: pair
clearance: repo
branch: feat/0007_lobby_polish
modules: [platform, impostor, wavelength, justone]
repos: ["."]
phases: 0
depends_on: []
ticket:
created: 2026-10-18
updated: 2026-10-18
---

# 0007 Lobby polish

## Goal

Four polish items Sebastian found after the redesign: every screen fits a 360 px phone; the player can change their name from the home screen, not only from the lobby; the Impostor categories in the lobby config are collapsed behind a chevron; and every game card offers "¿Cómo jugar?", a step-by-step simulation of a match built with the game's own components, so a newcomer learns a game without interrupting the night.

## Scope

- 360 px: audit every screen at 360 px and fix overflow, wrapping, clipping and touch targets; the screenshot script adds 360 to 390, 768 and 1280 permanently (platform `trd.md`).
- Rename from home: a rename entry next to the greeting on the home screen, reusing the lobby rename dialog and `PATCH /api/players/me` without `roomCode`.
- Collapsed categories: the Impostor config panel shows the categories collapsed by default with a one-line summary ("Todas" or "N de M") and a chevron; tapping expands the full list; the state is remembered while the lobby is open; selection behavior unchanged.
- "¿Cómo jugar?": a link button at the bottom of each game card in the lobby picker, inside the card below the description, that does not select the game; opens a bottom drawer on phones and a centered modal on wider screens; inside, a step carousel per game that simulates a match with the game's own components (word card, impostor card, dial, clue cards) on mocked data and the same animations; dots for the steps, previous and next, close, swipe between steps on touch; 4 to 6 steps per game in Spanish written from each module's `prd.md`; `prefers-reduced-motion` respected.
- Tests: Testing Library on the rename entry, the categories toggle and the carousel navigation; screenshots at 360, 390, 768 and 1280 px of home with rename, lobby with categories collapsed and expanded, and the how-to-play drawer and modal on every step of the three games.
- Docs: `document-task` updates platform `prd.md` (home rename, how to play), impostor `prd.md` (categories), platform `trd.md` (screenshot widths).

## Out of scope

- Any rule change in the games; the simulation only shows the existing flow.
- Video or audio in the how-to-play.
- Deferred: a how-to-play entry from inside a running match.

## Acceptance

1. No screen shows horizontal scroll or clipped text at 360 px; screenshots at 360 exist for every screen.
2. A player renames themselves from the home screen with the same rules as the lobby, and the new name appears in the greeting at once.
3. Impostor categories open collapsed with a correct summary, expand and collapse on tap, and selecting categories works as before.
4. Each game card shows "¿Cómo jugar?" at the bottom; tapping it opens a drawer at phone widths and a modal at 768 px and above without selecting the game.
5. The how-to-play carousel has 4 to 6 steps per game with dots, previous, next, close and swipe, built with the game's own components and animations on mocked data.
6. Every verification target passes.

## Approach

- Module and layers touched: web only; platform (home, lobby picker, screenshot script), impostor (config panel), and the three games' components reused read-only in the how-to-play steps.
- Decisions (Sebastian, 2026-10-18):
  - How to play reuses the real game components with mocked data: chosen over illustrations so the tutorial matches the screens exactly.
  - Drawer on phones, modal on wider screens: chosen over a dedicated route so the lobby stays underneath.
  - Categories collapsed by default: chosen over always visible because the list pushes the start button out of view.
  - 360 added to the permanent screenshot widths: chosen over a one-off audit so the regression cannot return.

## Database

None.

## Infra

None.

## Design

The lobby picker as deployed (cards Impostor, Wavelength, Just One); the link button sits at the bottom of each card.

## Risks

- Reusing game components in a tutorial may require decoupling them from room state; keep the decoupling thin (props in, no hooks on the room).
- Swipe inside a drawer can conflict with the drawer's own drag to close; the drawer closes only from its handle or the close button.

## Depends on

None.

## Context & decisions

Consolidated 2026-10-18 by the om-reviewer; answers by the om-manager on Sebastian's delegation.

- Scope adjusted (om-manager): rename from home is shared + api + web, not web only, because `PATCH /api/players/me` requires `roomCode` today (`shared/src/api.ts`, `api/src/handlers/players.ts`).
  `roomCode` becomes optional; without it the api runs the same transaction (player conditional on the old name, claim the new name, release the old one) with no room write and no publish, and answers `{ player }`; with it, behavior is unchanged.
  Api handler tests on DynamoDB Local cover both paths, including `NAME_TAKEN` and `INVALID_NAME` without a room.
- Acceptance 2 adjusted (om-manager): from home only the format and global uniqueness apply; the room rule (ignoring case and accents) cannot, since there is no room and no index of a player's rooms (infra, outside clearance).
  New debt for platform `ard.md`: after a home rename and a rejoin (`api/src/services/rooms.ts:100` copies the name unchecked), a room can show "Ana" and "ana".
- Home rename is optimistic (om-manager, Sebastian's rule that own actions feel instant): the dialog closes, the greeting shows the new name at once, a refusal rolls back the identity and toasts the server message.
  Crear sala and Unirme wait until the in-flight rename settles, so a new room never gets the old name.
  Identity is updated the same way as the lobby (`saveIdentity` plus the `['identity']` query data).
- Docs adjusted: besides the list in Scope, document-task updates the `PATCH /api/players/me` row in platform `trd.md`, appends a platform `ard.md` decision for the roomless rename with the debt above, and the rename rule in platform `prd.md`.
- om-reviewer decisions:
  - "¿Cómo jugar?" shows on every card for every member, host or not, and never selects the game; it sits above the card's select overlay.
  - Each game owns its steps in `web/src/games/{game}/` with mocked data; the drawer, modal and carousel live in `web/src/components/`; the lobby route wires them like `panels`, because `components/` never imports `games/`.
  - Steps compose leaf components (impostor `Card`/`CardBack`, `TurnOrder`, wavelength `Dial`, justone `WordCard`/`ClueCard`, `Avatar`, `Scoreboard`), not phase components that carry commands; no API call, no room query, no vibration, no sound (thin props where needed, e.g. `Card`).
  - The drawer closes from its close button, its handle (tap or drag down on the handle only) and Escape; the carousel swipe never closes it; no backdrop tap, as in the existing dialogs.
  - Swipe uses Pointer Events: `LazyMotion` is `domAnimation` with `strict`, which has no drag, and the platform `ard.md` design entry forbids `domMax`, exit and layout animations; step changes animate on enter only; reduced motion shows settled states.
  - Categories collapsed state lives in the lobby route, so it survives game switches while the lobby is open and resets when it reopens; non-hosts can expand it too; the summary is "Todas" or "N de M" and "Cargando categorías…" before they load.
  - The screenshot `capture` asserts no horizontal overflow (`scrollWidth <= viewport`) at every width, so Acceptance 1 has a check that fails.
- Constraints: platform `ard.md` (overlay pattern, design system and motion folder, no exit animations), platform `trd.md` (contract first in `shared`, 48 px targets, Spanish copy), CLAUDE.md (no secret in snapshots, events or logs; tests serial).
- Review focus beyond the Pipeline: steps match each module's `prd.md` without inventing rules; the select overlay still works and the link does not trigger it; the home rename rollback and the create/join wait; the 360 screenshots of every screen.
- clearance: repo

## om-developer notes

### Round 1

Done:

- Roomless rename: `RenamePlayerRequest.roomCode` is optional; `RenamePlayerResponse` is `{ player }` and `RenameInRoomResponse` adds `room`.
  The api runs the same writes (player conditional on the old name, claim, release), shared with the room path through `renameWrites`, with its own retry loop (4 attempts, jitter, then `CONFLICT`) and no room write or publish.
  A malformed `roomCode` is still `VALIDATION_ERROR`, never a silent roomless rename.
- Web client: `api.rename(name)` for home and `api.renameInRoom(code, name)` for the lobby; `storeIdentity` in `identity/identity.ts` is the one place that saves the identity and the `['identity']` query data.
- Home: pencil inline after the greeting, reusing `RenameDialog` with no room members; optimistic through `useRenameFromHome` (rollback plus toast on refusal).
  Crear sala and Unirme queue behind the in-flight rename and show busy meanwhile; the pencil ignores taps while a rename is in flight, so two renames never race their rollbacks.
- Categories: collapsed by default behind a chevron, summary "Todas", "N de M" or "Cargando categorías…"; open sections live in the lobby route as `openSections`, a generic set passed to every panel, so the state survives game switches and resets when the lobby remounts.
- How to play: `components/HowToPlay.tsx` (drawer under 768 px via `useWideScreen`, modal from 768 px, carousel, swipe on Pointer Events with `touch-pan-y`, Escape and arrow keys, focus to close and back to the opener on close); steps in `games/{game}/howToPlay.tsx` (Impostor 6, Wavelength 5, Just One 5); mocked family in `components/demoFamily.ts`.
  Scenes render inert (no taps inside a step), so the only gestures are swipe and the handle.
  New motion primitives `SlideUp` (drawer enter) and `SlideIn` (step enter, direction aware), enter only.
- Thin decoupling for the steps, no behavior change: `VoteList` extracted from `Voting`, `Verdict` and `Tally` exported from impostor `Reveal` (`Tally` takes `participants`), `CardFace` exported from `Card`, `ClueBanner` extracted from wavelength `GuessPhase`, `RevealedWord` and `TeamScore` extracted from justone `RevealPhase`.
  Demo points and cancellations come from the shared rules (`dialPoints`, `psychicPoints`, `autoCancelled`), so the steps cannot drift from the games.
- 360 px: project added to `screenshots.config.ts`; `capture` now fails on a page wider than the configured viewport (the old check compared against `innerWidth`, which a mobile viewport widens to fit overflowing content), on any text element outside the viewport or clipped by its own overflow, and on any input whose value scrolls.
  Fixed what it found: the lobby grid column grew to the longest unbreakable name (`grid-cols-1`); member rows stack "pts" under the score below `sm` so names and the crown fit; the room code input clipped "KXPR" (tighter tracking and padding below `sm`, Unirme `px-4`).
- Screenshots: `{{workspace}}/screenshots/`, 360, 390, 768 and 1280, including `home-rename`, `home-renamed`, `lobby-host-config` (collapsed), `lobby-host-config-categories` (expanded) and `howto-{impostor,wavelength,justone}-{n}` for every step (drawer at 360 and 390, modal at 768 and 1280).

Decisions not in the plan:

- Separate response types (`RenamePlayerResponse`, `RenameInRoomResponse`) over one type with an optional `room`, so the lobby keeps a non-null snapshot by type.
- The tutorial scenes are inert illustrations rather than interactive copies, so a step never competes with the swipe and no tap can reach a component's callbacks.
- The game card link carries `aria-label` "¿Cómo jugar {game}?" so every card's link has a distinct name; visible text stays "¿Cómo jugar?".

Pending: none.

Deferred:

- Names with one word longer than about 11 letters still break mid-word in member rows at 360 (`break-words` fallback); only a layout change of the row would avoid it.

### Round 2

Applied all 4 findings:

1. `verify.log` round 1 had the api and web unit counts swapped; round 2 blocks take every code and count from the `.verify/` artefacts (api 202, web 205).
2. `motion-reduce:transition-none` on the drawer snap-back and step dots (`HowToPlay.tsx`), and on the categories chevron and the switch track and knob (`ConfigPanel.tsx`).
3. Impostor "¿Quién gana?": impostors win when they are as many as the civilians "que siguen en juego".
4. Just One "Las repetidas se tachan": "Quienes dan pistas pueden tachar otra o recuperarla antes de mostrarlas".

Screenshots of the Impostor and Just One how-to-play steps and of the Impostor config refreshed at every width.

Pending: none. Deferred: unchanged from round 1.
