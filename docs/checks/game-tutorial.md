---
name: game-tutorial
model: sonnet
paths:
  - shared/src/domain.ts
  - web/src/games/**/*.tsx
  - web/src/routes/$code/index.tsx
  - web/src/components/lobby/GamePicker.tsx
reference: docs/conventions/game-tutorial.md
---

# game-tutorial

A `GameType` added to `shared/src/domain.ts` comes with `web/src/games/{{game}}/howToPlay.tsx` exporting `{{game}}Steps: HowToPlayStep[]` in the same diff.
A new `howToPlay.tsx` has between four and six steps, in match order, with Spanish text.
Each step renders components imported from the game's own folder `web/src/games/{{game}}/` and the example family from `web/src/components/demoFamily.tsx`; no inline markup that imitates a game component, no image, no copy of a component.
A `howToPlay.tsx` imports nothing from `web/src/api/`, `web/src/realtime/` or `web/src/components/roomSession.ts`; it builds every prop from constants.
A new `GameType` is a key of the `howToPlay` record in `web/src/routes/$code/index.tsx` and an entry of `GAMES` in `web/src/components/lobby/GamePicker.tsx`.
A change to a game's phase components or rules in `web/src/games/{{game}}/` that alters what a player sees in a step is reflected in that game's `howToPlay.tsx` in the same diff.
Report as clean: test files; style-only changes to a component that keep its props and behavior; changes to `web/src/components/HowToPlay.tsx` itself; a diff that touches an existing game's components without changing their props; layout wrappers in a step (lists, grids, spacing, headings, captions) around the game's components; small decorative elements such as a placeholder glyph, as long as the cards, dials, clues and scoreboards themselves come from the game's folder.
