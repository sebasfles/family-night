---
updated: 2026-10-19
source: 0008_scoring_and_manada
---

# La manada: flows

## Match phases

```mermaid
stateDiagram-v2
  [*] --> ANSWER: match starts (round 1)
  ANSWER --> REVEAL: last player answers, host closes, or a departure completes the answers
  REVEAL --> REVEAL: host merges or splits groups, or a player leaves
  REVEAL --> ANSWER: host next-round, goal not reached
  REVEAL --> FINISHED: host next-round, goal reached
  ANSWER --> FINISHED: fewer than 2 players left
  REVEAL --> FINISHED: fewer than 2 players left
  FINISHED --> [*]
  ANSWER --> ABORTED: host ends the match
  REVEAL --> ABORTED: host ends the match
  ABORTED --> [*]
```

- The goal is reached at the last configured round, or with "8 puntos" when someone without the cow has 8 or more; the reveal's button reads "Ver resultado" then.
- After `FINISHED` or `ABORTED` the host goes back to the lobby or starts a rematch; both belong to `platform`.
