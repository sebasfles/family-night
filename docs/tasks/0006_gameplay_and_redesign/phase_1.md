---
phase: 1
branch: feat/0006_gameplay_and_redesign
updated: 2026-10-18
---

# Phase 1: Gameplay fixes

## Scope

- Optimistic updates for the player's own commands (lobby actions, Impostor vote and confirm, Wavelength clue and dial confirm, Just One clue, cancel, guess): the UI reflects the action at once and rolls back with the server message as toast when refused.
- Name change: `PATCH /api/players/me` with a 2 to 20 character name unique among players; editable from the lobby; the new name reaches every phone through the snapshot.
- Impostor: remove the last-chance guess (config flag, LAST_CHANCE phase, host skip, five-word pick, docs); civilians win when the last impostor is voted out.
- Impostor: vote selection is provisional, "Confirmar" locks it; a confirmed vote cannot change; unconfirmed selections count when the host closes early; voting closes by itself when every living player has confirmed.
- Wavelength: bands 4 within 2.5, 3 within 7.5, 2 within 12.5, else 0; the dial's numbers and band regions aligned.
- Wavelength: a synthesized tick on each dial step through the Web Audio API, unlocked on the first touch, with a mute control remembered on the device.

## Acceptance

1. Tapping a vote, confirm, clue or guess changes the screen within one frame, and a refused command restores the previous state with the server message.
2. A player renames themselves from the lobby; the name is validated (2 to 20 characters, unique) and appears on every phone; the ARD records the overridden decision.
3. Impostor has no last-chance setting or phase; when the last impostor is voted out, the result screen declares the civilians winners.
4. A confirmed vote cannot be changed; voting closes when all living players have confirmed; an early close counts unconfirmed selections.
5. Wavelength scores by the new bands (shared tests) and the dial labels sit on the regions they name at the three widths.
6. The dial ticks while turning and the mute control silences it across reloads.
7. Every verification target passes; screenshots of the changed screens at 390, 768 and 1280 px.

## om-developer notes

## Result
