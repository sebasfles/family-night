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

## Result
