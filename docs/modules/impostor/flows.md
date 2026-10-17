---
updated: 2026-10-17
source: setup
---

# Impostor: flows

## Match phases

The public phase of a running match, driven by votes, host actions and members leaving.
Aborting is a match status, not a phase, so it can happen from any state.
Per-state rules are in [prd.md](prd.md).

```mermaid
stateDiagram-v2
  [*] --> VOTING: match starts (round 1)
  VOTING --> REVEAL: all living voted, or host closes voting
  REVEAL --> VOTING: host next-round, match goes on
  REVEAL --> IMPOSTOR_GUESS: last impostor voted out and last guess on
  REVEAL --> FINISHED: win evaluated, no guess
  IMPOSTOR_GUESS --> FINISHED: guess right (impostors win) or wrong (civilians win)
  IMPOSTOR_GUESS --> FINISHED: host skips guess (civilians win)
  VOTING --> FINISHED: a living player leaves or is kicked and the win condition is met
  REVEAL --> FINISHED: a living player leaves or is kicked and the win condition is met
  VOTING --> VOTING: a living player leaves or is kicked, match goes on
  FINISHED --> [*]
  VOTING --> ABORTED: host ends the match
  REVEAL --> ABORTED: host ends the match
  IMPOSTOR_GUESS --> ABORTED: host ends the match
  ABORTED --> [*]
```

- A vote that ends the match passes through `REVEAL`; the host moves everyone to `FINISHED` with "Ver resultado".
- A leaving or kicked living player is recorded as eliminated with reason `LEFT` or `KICKED` and the win is evaluated; a last impostor who leaves gives the civilians the win without a last guess.
- After `FINISHED` or `ABORTED` the host goes back to the lobby or starts a rematch; both belong to `platform`.
