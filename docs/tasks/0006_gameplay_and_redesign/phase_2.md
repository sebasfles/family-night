---
phase: 2
branch: feat/0006_gameplay_and_redesign
updated: 2026-10-18
---

# Phase 2: Design system and platform screens

## Scope

- A warm dark palette (replacing the blue background), typography and spacing tokens in Tailwind; a motion library for shared transitions; `prefers-reduced-motion` respected.
- Animated transitions between phases and screens.
- Home, lobby (game picker, config panels, member list, share), scoreboard and Espectador restyled on the new system; games keep working on the old components until phase 3.

## Acceptance

1. No screen keeps the blue background; the palette is warm and dark and passes contrast on body text and buttons.
2. Phase and route changes animate; with `prefers-reduced-motion` they do not.
3. Home, lobby, scoreboard and Espectador screenshots at 390, 768 and 1280 px show the new system; every verification target passes.

## om-developer notes

## Result
