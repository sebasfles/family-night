---
updated: 2026-10-18
source: 0006_gameplay_and_redesign
---

# Impostor: flows

## Match phases

The public phase of a running match, driven by votes, host actions and members leaving.
Aborting is a match status, not a phase, so it can happen from any state.
Per-state rules are in [prd.md](prd.md).

```mermaid
stateDiagram-v2
  [*] --> VOTING: match starts (round 1)
  VOTING --> REVEAL: all living confirmed, or host closes voting
  REVEAL --> VOTING: host next-round, match goes on
  REVEAL --> FINISHED: host next-round, a side has won
  VOTING --> FINISHED: a living player leaves or is kicked and the win condition is met
  REVEAL --> FINISHED: a living player leaves or is kicked and the win condition is met
  VOTING --> VOTING: a living player leaves or is kicked, match goes on
  FINISHED --> [*]
  VOTING --> ABORTED: host ends the match
  REVEAL --> ABORTED: host ends the match
  ABORTED --> [*]
```

- A vote that ends the match passes through `REVEAL`; the host moves everyone to `FINISHED` with "Ver resultado".
- In `REVEAL` a departure finishes the match at once only when the outcome is already a win.
- A leaving or kicked living player is recorded as eliminated with reason `LEFT` or `KICKED` and the win is evaluated.
- After `FINISHED` or `ABORTED` the host goes back to the lobby or starts a rematch; both belong to `platform`.
