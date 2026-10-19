---
updated: 2026-10-18
source: add-check
---

# Every game ships its tutorial

A game is not complete until a player can learn it from the lobby without anyone explaining it.
Sebastian's rule, 2026-10-18: every game, new or existing, has a "¿Cómo jugar?" tutorial, and a pull request that adds a game without one is not done.

What a game's tutorial is, as the three games do it:

- One file `web/src/games/{{game}}/howToPlay.tsx` exporting `{{game}}Steps: HowToPlayStep[]` (`web/src/games/justone/howToPlay.tsx`).
- Four to six steps, each simulating one moment of a match in Spanish, in the order a player lives them.
- Steps render the game's own components (`web/src/games/{{game}}/*`) on the example family from `web/src/components/demoFamily.ts`, never screenshots, ad-hoc markup or a second copy of a component.
- Steps are static: no room hooks, no API calls; whatever the component needs arrives as props with mocked data.
- The steps are registered in the `howToPlay` record of `web/src/routes/$code/index.tsx`, keyed by the game's `GameType`, and the game has its card in `GAMES` of `web/src/components/lobby/GamePicker.tsx`, which is where the "¿Cómo jugar?" button lives.
- `web/src/components/HowToPlay.tsx` owns the drawer, the modal, the carousel and the dots; a game never reimplements them.
- When a game's rules or screens change, its steps change in the same pull request.

See `docs/modules/platform/prd.md`, section How to play, for what the player sees.
