---
id: "0006"
title: gameplay_and_redesign
type: feature
crew: pair
clearance: repo
branch: feat/0006_gameplay_and_redesign
modules: [platform, impostor, wavelength, justone]
repos: ["."]
phases: 3
depends_on: []
ticket:
created: 2026-10-18
updated: 2026-10-18
---

# 0006 Gameplay fixes and visual redesign

## Goal

After playing the three games, Sebastian wants every tap to feel instant, six gameplay details fixed, and the app to look like a warm, modern family game night instead of a blue utility: a dark warm palette, animations on every phase change and reveal, and bespoke designs for the word cards, impostor cards, the dial and the clue cards.
One task, three ordered phases on one branch, one PR when the last phase is done.

## Scope

- Phase 1, gameplay: optimistic updates for the player's own commands; global name change; Impostor last-chance removed; Impostor vote confirmation; Wavelength bands and dial label alignment; Wavelength dial tick sound.
- Phase 2, design system: warm dark palette replacing the blue, typography, a motion library, animated phase transitions; home, lobby, scoreboard and Espectador restyled.
- Phase 3, game screens: bespoke word card, impostor card, dial and clue cards; 3D flip reveals in CSS for the Impostor result, the Wavelength target and the Just One word; animated scoreboards.
- Each phase: its own screenshots at 390, 768 and 1280 px with mocked data, refreshed every round; `document-task` at the end of the task updates the module docs (platform prd and ard for the name change and the design system, impostor prd and ard for last chance and vote confirmation, wavelength prd and ard for bands and sound) and `docs/PRD.md`.

## Out of scope

- WebGL or three.js: CSS 3D transforms only, for bundle size and phone battery.
- Light theme.
- New games, timers, sound beyond the dial tick.
- Name change rules beyond the ones in phase 1 (profanity filter, history).

## Acceptance

See each `phase_N.md`.
Overall:

1. Every verification target passes at the end of every phase.
2. No secret (word, role, clue, Wavelength target, unrevealed guess) enters a snapshot, an event or a log; optimistic state never shows another player's secret or vote.
3. Screenshots of every changed screen at the three widths are in the task workspace at the end of every round.
4. The module docs and `docs/PRD.md` reflect the new rules and the design system when the PR opens.

## Approach

- Module and layers touched: web for every phase; shared and api in phase 1 (name change endpoint, Impostor config and phases, Wavelength bands).
- Decisions (Sebastian, 2026-10-18):
  - Optimistic updates for own commands with rollback and the server message as toast: chosen over waiting for the snapshot because taps must feel instant.
  - Name change is global per player, 2 to 20 characters, unique among players, from the lobby: chosen over per-room names and over keeping names fixed; overrides the ARD decision "no name change" (record the new decision in `docs/ARD.md` and platform `ard.md`).
  - Impostor last-chance guess removed entirely (setting, phase, skip, five-word pick): chosen over typed guesses because the in-person reveal is enough.
  - Vote confirmation: a selection is provisional, "Confirmar" makes it final; on an early close unconfirmed selections still count: chosen over counting only confirmed votes so a forgotten tap does not become an abstention.
  - Wavelength bands 4 within 2.5, 3 within 7.5, 2 within 12.5, else 0 (board game), no 1-point band: chosen over the current 5/10/15/25 bands, too generous.
  - Dial tick synthesized with the Web Audio API on each step, with a mute control, no audio asset: chosen over sound files for size and latency.
  - Palette warm and dark, CSS 3D flips plus a motion library: chosen over WebGL.
- One branch, phases as milestones, PR after phase 3, per Sebastian's global rule.

## Database

`Players` referenced for the name change (uniqueness as today's name assignment keeps it); Impostor config loses the last-chance flag; no new tables, no migrations.

## Infra

None.

## Design

None; the om-developer proposes the palette and card designs in phase 2 screenshots and Sebastian iterates from them.

## Risks

- Optimistic state diverging from the snapshot on `CONFLICT` or `STALE_ROUND`; rollback must be exact.
- A name change colliding with an existing name; needs the same uniqueness path as assignment.
- Animations on low-end phones; prefer transforms and opacity, respect `prefers-reduced-motion`.
- Audio needs a user gesture to start on iOS; the first dial touch unlocks it.

## Depends on

None.

## Context & decisions

Consolidated 2026-10-18 by the om-reviewer; the om-manager answered on Sebastian's delegation, taking every om-reviewer recommendation.

Decisions (om-manager for Sebastian, on the om-reviewer's recommendation):

- Phase gate, no PR per phase: after a clean review of phases 1 and 2 the om-reviewer pushes the branch (no PR, no docs) and reports `phase k of 3 ready, commit {sha}, screenshots at {path}`; retakes or `phase k approved, continue` follow; phase k+1 starts with a fresh om-developer on the same branch. `document-task` runs once, after phase 3, then the single PR.
- Optimistic lobby actions: game pick, config changes, host handover, kick and rename. Start, rematch, back to lobby and leave keep the busy button.
- Vote confirmation: the check by the name and "Votaron N de M" count confirmed votes only; a provisional selection is invisible to others; the host's early close dialog says how many have not confirmed and that their selections count.
- Names: global uniqueness stays exact through `PlayerNames` as assignment does; a name equal to another member of the same room ignoring case and accents is also refused.
- The old name is released in the same transaction (delete conditional on its `playerId`). Adjustment to the invariant "PlayerNames are never deleted" in `docs/modules/platform/database.md`.
- `PATCH /api/players/me` carries `{ name, roomCode }` and writes the player, the names and that room's member in one version-conditional `updateRoom` write that publishes; a rejoin refreshes a stale member name, so other rooms catch up when reopened. No index by player (infra is out of clearance).

Decisions (om-reviewer, accepted):

- Optimistic state is an overlay of pending commands over the snapshot, never written into the room cache; rollback drops the overlay and toasts the server message. Supersedes platform `ard.md` "The room snapshot decides the screen" (its no-optimistic clause) and impostor `ard.md` "No optimistic updates on votes".
- A confirmed vote is enforced on the server by a conditional write, not only in the UI; when a target leaves in VOTING its ballots are deleted as today, confirmed included, and those voters vote again.
- Name rules: trimmed, inner spaces collapsed, 2 to 20 characters, no control characters, one shared function in `shared/` used by web and api. The UI offers rename only in the lobby; the server accepts it any time. The identity in localStorage takes the new name.
- Rooms stored before the deploy keep working: a stored Impostor config with `impostorLastGuess` parses (the key is dropped); a match left in `IMPOSTOR_GUESS` can only be aborted.
- Tick on every value change of one's own dial (drag, buttons, keys); mute on the Wavelength screen, in localStorage.
- Screenshots in `{{workspace}}/screenshots/phase_N/`, refreshed every round. Fonts self-hosted, no CDN.

Constraints:

- Contract first in `shared/`; the version rule and single write path of `api/src/services/room-state.ts` (`docs/modules/platform/ard.md`); ballots follow the plain put plus sync pattern (`docs/modules/impostor/ard.md`).
- Last chance removed everywhere: config, `IMPOSTOR_GUESS`, `ImpostorGuess`, guess options in `#MATCH`, `POST guess`, `POST skip-guess`, `NOT_GUESSER`, `LastChance.tsx`; no dead code left.
- `DIAL_BANDS` drive both scoring and the dial drawing; integer distances, so the bands read 0 to 2, 3 to 7, 8 to 12.
- Web client gains `PATCH`; CloudFront already allows it.
- Docs at the end, beyond the task's list: `docs/ARD.md` identity entry and `docs/PRD.md` (name, last chance, "Not in the product"), platform `database.md`, impostor `trd.md`, `flows.md`, `database.md` and debt index entry on changed votes, wavelength `prd.md` bands, the two superseded ARD entries.

Review beyond the Pipeline:

- 20 concurrent confirms close the round once; a confirmed vote cannot be overwritten by a racing request; an early close counts unconfirmed ballots.
- Rename: concurrent claims of one name, one wins; old name freed; rejoin refreshes; snapshot carries the name, no other change.
- Optimistic tests that check the UI before the request resolves and the rollback on a refused command; nothing of another player in the overlay.
- Dial screenshots with targets at 0, 3, 50, 97 and 100; motion library bundle cost per round in phases 2 and 3.

Adjustment (om-manager for Sebastian, 2026-10-18): phase 1 approved; no gate after phase 2, phase 3 starts as soon as phase 2 is clean; after phase 3 the om-reviewer reports only `PRs ready` with the screenshot paths of phases 2 and 3.

clearance: repo

## om-developer notes
