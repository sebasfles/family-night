---
updated: 2026-10-19
source: 0008_scoring_and_manada
---

# La manada: product

## Purpose

A question everyone answers at once ("Una fruta amarilla"), and the fun is in finding out who thinks like the rest of the family.
There is no right answer: the biggest group wins the round, and the one who stands alone takes the pink cow.

## User flows

### Host sets up a match

1. In the lobby the host taps the La manada card; every phone shows it as the chosen game.
2. The host picks "Rondas" with 5 to 15 rounds (10 by default) or "8 puntos".
3. With at least 3 players online the host taps Iniciar and every phone moves to the game.

### Answers

1. Every phone shows the round's question.
2. Each player writes 1 to 3 words, up to 30 characters, and taps "Confirmar respuesta"; a confirmed answer cannot change.
3. Everyone sees "Respondieron N de M"; nobody sees an answer before the reveal.
4. The round reveals when the last player confirms, or when the host taps "Cerrar respuestas" (with a confirmation when some are missing); a missing answer counts as none.

### Reveal

1. Answers appear grouped, each group with its words and the names in it, the largest first; players without an answer are listed apart.
2. The largest group, when it is the only one that size, is marked "+1 cada uno"; tied largest groups are marked "Empate" and nobody scores.
3. The pink cow card shows who holds it, sliding to its new holder when it moves.
4. The totals count up from before the round.
5. The host can tap two groups that mean the same thing to merge them, and "Separar" on a merged group to undo it; points and the cow recompute at once, until the host taps "Siguiente ronda" or "Ver resultado".

### End

1. The final screen names the winner or the shared winners, who kept the cow, and every player's points with what each adds to the night.
2. The host chooses "Jugar otra vez" (same settings, unseen questions) or "Volver al lobby", or ends the match at any time without points.

### Leaving and latecomers

- A player who leaves takes their answer out of the round, also during the reveal, and the round recomputes; a leaver who held the cow drops it.
- Someone who left and comes back, or joins mid-match, watches as "Espectador".
- With fewer than 2 players left the match ends at once.

## Rules

- At least 3 players online to start.
- Answers match ignoring case, accents, plural per word and a leading article (el, la, los, las, un, una, unos, unas); "perros calientes" matches "perro caliente", and matching is transitive.
- The largest group scores 1 point per member when it is 2 or more and no other group has its size.
- The cow goes to the only player alone with their answer when some group has 2 or more; with two or more players alone, or everyone alone, it stays where it was.
- The cow holder cannot win. "8 puntos" ends at the end of the first round where someone without the cow has 8 or more; "Rondas" plays every round. In both, the highest score without the cow wins and ties share the win.
- Night points by podium: the winners share first place and get one point per player still in the match, the rest follow by points with shared places, the cow holder ranked by points among them.
- Questions do not repeat within a night; when the bank is used up it starts over.

## Out of scope

- Timers and the board game's printed cards.

## Open questions

- Whether automatic grouping misses matches the family expects often enough that the host merge feels like work.
