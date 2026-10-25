---
updated: 2026-10-25
source: 0009_wavelength_one_phone
---

# Wavelength: flows

## Match phases

`round` rises with every opened round, cancelled ones included; `turn` walks the `cycles` times `order` sequence, skipping players who left.

```mermaid
stateDiagram-v2
  [*] --> CLUE: match starts (round 1, turn 0)
  CLUE --> GUESS: psychic gives the clue
  GUESS --> REVEAL: last guesser commits, host closes, or a departure completes the round
  REVEAL --> CLUE: host next-round, a turn is left
  REVEAL --> FINISHED: host next-round, no turn left
  CLUE --> CLUE: psychic leaves or host skips, a turn is left
  GUESS --> CLUE: psychic leaves, a turn is left
  CLUE --> FINISHED: psychic leaves or is skipped, no turn left
  GUESS --> FINISHED: psychic leaves, no turn left
  CLUE --> FINISHED: fewer than 2 players left
  GUESS --> FINISHED: fewer than 2 players left
  REVEAL --> FINISHED: fewer than 2 players left
  FINISHED --> [*]
  CLUE --> ABORTED: host ends the match
  GUESS --> ABORTED: host ends the match
  REVEAL --> ABORTED: host ends the match
  ABORTED --> [*]
```

- A cancelled round records `skipped` (who and why), shown in the next CLUE until the clue is given.
- After `FINISHED` or `ABORTED` the host goes back to the lobby or starts a rematch; both belong to `platform`.

## One device steps

Only CLUE, GUESS and REVEAL are stored; the open target and an open dial live in memory, so a reload lands on the gate before them.

```mermaid
stateDiagram-v2
  [*] --> PsychicGate: Empezar or Jugar otra vez
  PsychicGate --> Target: Ver el objetivo
  Target --> GuesserGate: Listo (phase GUESS)
  GuesserGate --> Dial: Soy Y
  Dial --> GuesserGate: Confirmar, a guesser is left
  Dial --> AllGuessed: Confirmar, nobody left
  AllGuessed --> Reveal: Revelar
  Reveal --> PsychicGate: Siguiente ronda
  Reveal --> Final: Terminar
  PsychicGate --> Final: Terminar from the menu
  GuesserGate --> Final: Terminar from the menu
  Final --> [*]: Volver al inicio, the stored match is gone
```
