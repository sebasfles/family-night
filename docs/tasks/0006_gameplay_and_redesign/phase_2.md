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

### Round 1

Done:

- Palette in `web/src/index.css` tokens, warm and dark: `night` #1a1210, `night-soft`, `night-raised`, `moon` amber #f6b23c (and `moon-bright`), `ember` coral, `sage`, `orchid`, `lagoon`, `sand`, `cream`; the token names stay, so every game screen left the blue at once. Utilities `surface` and `popover`, shadows `glow` and `lift`, ease `soft`, the amber glow on `html`.
- Typography: Fraunces (SOFT axis) for headings and numbers, Nunito for body, both self-hosted through `@fontsource-variable`, latin subset about 100 KB woff2 with `font-display: swap`.
- Motion: `motion` (LazyMotion with `domAnimation`, `m` components only) behind `web/src/motion/`: `MotionProvider`, `Enter`, `Stagger`/`StaggerItem`, `Pop`, `Fade`, and an own `useReducedMotion` on `matchMedia` (live). Under reduced motion every component renders with `initial={false}`, so nothing animates.
- Transitions: every screen's `main` enters on mount (route changes, lobby to game, rematch); each game's phase block is keyed by phase and round and enters on change; lists stagger, dialogs and toasts pop, the backdrop fades, the config panel re-enters on game switch.
- Restyled: home, lobby (invite tiles, member list as the room scoreboard with avatars and score pills, game picker with a glyph per game, config panels on shared `ConfigSection`/`Segmented`, start section), match header and the Espectador badge and notice (`SpectatorNotice`, shared by the three games), dialogs, menus, toast, loading and error screens, favicon, `theme-color` and `og.png`.
- Shared pieces extracted in files already touched: `Menu` (replaces the two copies of the dropdown), `Backdrop`, `Avatar`, `Loading`, `SpectatorNotice`, `ConfigSection`.
- Tests: `src/theme.test.ts` (background not blue, AA contrast of body, muted and button text), `src/routes/$code/transitions.test.tsx` (a phase change and the lobby to game change animate, and do not with reduced motion). Test setup stubs `matchMedia` with reduced motion on by default.
- Screenshots: `screenshots/phase_2/` in the workspace, every screen at 390, 768 and 1280, taken with reduced motion so each shows its settled state.
- Bundle: initial JS +30.6 KB gzip (motion), CSS +3 KB gzip, plus the fonts.

Decisions the plan did not record:

- "Scoreboard" in this phase is the lobby member list with room totals; the per-game scoreboards are phase 3.
- Enter-only transitions, no exit animations: content of the new phase is in the DOM at once, so nothing waits on an animation and the route outlet never renders stale content.
- `domAnimation` only, no layout animations (`domMax`, about 10 KB more); phase 3 adds it if the scoreboards need places shifting.
- The dial keeps its band colors; only its blue surfaces moved to tokens. Its redesign is phase 3.
- Lobby goes to two columns from 1024 px.

Deferred: none.

Pending: none.

### Round 2

Applied both findings, none disputed:

1. The three malformed `verify.log` blocks of round 1 rewritten in the verify-task shape from the same run's artefacts (the test count had landed in the header through zsh not splitting `set -- $t`).
2. The room code placeholder is `cream/50` (4.86:1 on `night`); `src/theme.test.ts` checks that pair.

Screenshots refreshed in `screenshots/phase_2/`.

## Result

Clean at 5148779 after 2 rounds; no gate per the 2026-10-18 adjustment, phase 3 started at once.

- Delivered: warm dark tokens (names kept, so every screen left the blue), Fraunces and Nunito self-hosted, `motion` with LazyMotion `domAnimation` behind `web/src/motion/`, enter-only transitions on screens and phases, reduced motion honoured; home, lobby, match header, Espectador, dialogs, menus, toast restyled.
- Deviations: "scoreboard" here is the lobby member list; per-game scoreboards are phase 3. No exit animations; no layout animations (`domMax`) yet.
- Cost: initial JS +30.6 KB gzip, CSS +3 KB gzip, fonts about 100 KB woff2.
- For phase 3: the dial still carries its band colors and blue-ish labels; game screens still use the old components.

