---
phase: 3
branch: feat/0006_gameplay_and_redesign
updated: 2026-10-18
---

# Phase 3: Game screens and reveals

## Scope

- Bespoke designs: the Impostor word card and impostor card, the Wavelength dial, the Just One clue cards and word card.
- 3D flip reveals in CSS: the Impostor eliminated player and result, the Wavelength target on the dial, the Just One word and guess.
- Animated scoreboards (points counting up, places shifting) in every game's REVEAL and FINISHED.
- Every game screen on the phase 2 design system; old components removed.

## Acceptance

1. Each game's screens use the new cards and the dial; nothing of the old visual style remains.
2. Reveals flip in 3D with CSS transforms, and reduced motion shows them without the flip.
3. Scoreboards animate in REVEAL and FINISHED of the three games.
4. Screenshots of every game screen (every phase, host and player, Espectador) at 390, 768 and 1280 px; every verification target passes; module docs and `docs/PRD.md` updated by `document-task`.

## om-developer notes

### Round 1

Done:

- Cards as surfaces in `web/src/index.css`: `card-paper` (cream paper), `card-wine` (the impostor), `card-back` (patterned back, accent per game through `--card-accent`), radius token `rounded-card`; new tokens `paper-deep`, `wine`, `wine-deep`, `sage-deep`, `orchid-deep`, keyframe `fade-in`.
- Motion in `web/src/motion/`: `Flip` (a card turned by hand, the face unmounts once it has turned away) and `FlipReveal` (shows the back, turns over after 450 ms), CSS `rotateY` with `preserve-3d` and `backface-visibility`; `CountUp` (rAF, the final value always read by screen readers); `useShuffleIn` (rows start at their old place and slide to the new one through the Web Animations API, measured with layout boxes); `Meter` (bars grow); timings in `timing.ts`. Reduced motion renders the face only, final numbers, no shift.
- Impostor: tap-to-flip card (back with the mask, paper face for civilians, wine face for the impostor), turn order and ballot with avatars and a confirmed-votes bar, reveal flips the eliminated player's card, the tally counts up and rows slide into vote order, final with winner banner, the word flipping in, impostors and eliminations with avatars, animated scoreboard.
- Wavelength: dial in three layers (face with a lagoon to ember rim, the bands, the hand with ticks, pins and needle); bands in `moon-bright`, `ember`, `orchid`; on REVEAL the bands turn over from a striped shutter; clue card with the spectrum strip; round points pills in their band colour; shared scoreboard counting from the totals before the round, places shifting, gains under the score.
- Just One: word card, clue cards (paper, tilted, crossed in ember with a stamp) in review, guess and reveal; the word card flips with the verdict; team score counts from `scoreBefore`; final counts from 0.
- Shared: `components/Scoreboard.tsx` (+ `scores.ts`), `Notice` (skipped turns), `Waiting`, `field.ts` (the rename dialog's input, now used by every game form). Removed `games/wavelength/Scoreboard.tsx` and every cream input and non-token colour of the game screens.
- Tests: `motion/Flip.test.tsx`, `motion/CountUp.test.tsx`, `motion/shuffle.test.ts`, `components/Scoreboard.test.tsx`, one 3D reveal test per game route, dial tests pointed at the layers, contrast pairs for the new surfaces in `theme.test.ts` (it caught the paper labels at `night/55`, now `night/65`). List assertions read `spokenText` (`test/text.ts`), what assistive tech reads, since avatars and gain pills are decorative.
- Screenshots: `screenshots/phase_3/`, every screen at 390, 768 and 1280 with reduced motion, plus `*-motion-*` shots taken mid-flip and mid-count with motion on; dial zones at 0, 3, 50, 97, 100.
- Bundle against phase 2: no new dependency, initial JS +0.2 KB gzip, game chunks +6.5 KB gzip in total, CSS +0.9 KB gzip.

Decisions the plan did not record:

- Places shifting without `domMax`: a FLIP through the Web Animations API (zero bundle), not motion layout animations.
- Scoreboard sequence: flip at 450 ms, count from 1 s for 0.9 s, rows shift after it, ranks fade in last.
- Wavelength REVEAL counts from the totals before the round; finals of Impostor and Wavelength count from 0 and shift from seat order. The Impostor final scoreboard lists every participant still in the room, losers at +0 (before, winners only).
- Just One has a team score, so its "scoreboard" is the team score counting; nothing shifts.
- The leader row is highlighted only when there is a single leader.
- The psychic's dial during CLUE and GUESS shows the target without a flip; only REVEAL flips.

Deferred: none.

Pending: none.

## Result
