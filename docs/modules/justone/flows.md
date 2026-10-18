---
updated: 2026-10-18
source: 0005_just_one
---

# Just One: flows

## Match phases

`round` rises with every opened round, cancelled ones included; `turn` walks the `cycles` times `order` sequence, skipping players who left.

```mermaid
stateDiagram-v2
  [*] --> CLUE: match starts (round 1, turn 0)
  CLUE --> REVIEW: last clue-giver commits, host closes, or a departure completes the clues
  REVIEW --> GUESS: a clue-giver or the host shows the clues
  GUESS --> REVEAL: the adivinador guesses or passes
  REVEAL --> REVEAL: host counts a wrong guess as correct
  REVEAL --> CLUE: host next-round, a turn is left
  REVEAL --> FINISHED: host next-round, no turn left
  CLUE --> CLUE: adivinador leaves or is skipped, a turn is left
  REVIEW --> CLUE: adivinador leaves or is skipped, a turn is left
  GUESS --> CLUE: adivinador leaves or is skipped, a turn is left
  CLUE --> FINISHED: no turn left after a cancel, or fewer than 2 players
  REVIEW --> FINISHED: no turn left after a cancel, or fewer than 2 players
  GUESS --> FINISHED: no turn left after a cancel, or fewer than 2 players
  REVEAL --> FINISHED: fewer than 2 players left
  FINISHED --> [*]
  CLUE --> ABORTED: host ends the match
  REVIEW --> ABORTED: host ends the match
  GUESS --> ABORTED: host ends the match
  REVEAL --> ABORTED: host ends the match
  ABORTED --> [*]
```

- A cancelled round records `skipped` (who and why), shown during the next CLUE until the review opens.
- After `FINISHED` or `ABORTED` the host goes back to the lobby or starts a rematch; both belong to `platform`.
