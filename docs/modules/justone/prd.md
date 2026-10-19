---
updated: 2026-10-19
source: 0008_scoring_and_manada
---

# Just One: product

## Purpose

A family helps one of its own guess a word with one-word clues, and the fun is in the clues that collide: two people who wrote "Verde" for "Palta" cancel each other out.
Everyone plays for the same score, so the table cheers together.

## User flows

### Host sets up a match

1. In the lobby the host taps the Just One card; every phone shows it as the chosen game.
2. The host picks Vueltas 1, 2 or 3: how many times each player will be the adivinador; the panel says how many rounds that makes with the players online.
3. With at least 4 players online the host taps Iniciar and every phone moves to the game.

### Clues

1. Every clue-giver sees the secret word and writes one word, up to 30 letters, with no spaces; a clue cannot be changed once given.
2. The adivinador sees "Están escribiendo pistas..." and how many are ready.
3. The phase ends when the last clue-giver writes, or when the host taps "Cerrar pistas" (with a confirmation when some are missing); a missing clue counts as none.

### Review

1. Clue-givers see every clue with the repeated ones already crossed out, including any clue that is the word itself, written differently.
2. Any clue-giver taps a clue to cross it out (same root, contains the word) or bring it back.
3. The adivinador sees nothing yet; any clue-giver or the host taps "Mostrar pistas", even a host who is the adivinador.

### Guess and reveal

1. The adivinador sees only the surviving clues, types a guess and taps Adivinar, or taps Pasar.
2. The word card turns over to show the word and the verdict ("¡Acertaste!" for the adivinador, the name for the rest), then every clue card with the crossed ones marked, the round's points and the team score counting from where it was.
3. A wrong guess that was really right (a typo, a synonym the family accepts) can be counted by the host with "Contar como acierto".
4. The host taps "Siguiente ronda", or "Ver resultado" after the last turn.
5. The final screen counts up the team score and shows the rounds won; the host chooses "Jugar otra vez" (same settings, unseen words) or "Volver al lobby".

### Leaving and latecomers

- A clue-giver who leaves takes their clue out while clues are written or reviewed; once the clues are shown, they stay.
- An adivinador who leaves before the reveal cancels the round, and the next one goes.
- If the adivinador is offline, the host sees "Saltar turno"; after a confirmation the next adivinador goes, and the skipped player keeps their later turns.
- Someone who left and comes back, or joins mid-match, watches as "Espectador" and sees no word.
- With fewer than 2 players left the match ends at once with the score so far.

## Rules

- At least 4 players online to start; one team score per match.
- Correct +1, pass 0, wrong -1, and the score never goes below 0; counting a wrong guess as correct recomputes that round from the score before it.
- Clues match when they are equal ignoring case, accents and plural (s, es, ces to z); ñ is not n.
- The adivinador order is drawn at the start and repeats every cycle.
- Words do not repeat within a night; when the bank is used up it starts over.
- The team score stays in the match: the night's scoreboard does not change, because a cooperative score is not comparable with the other games; the final screen says so.

## Out of scope

- Individual scoring, the 5-word card and the dice of the board game, timers.

## Open questions

- Whether automatic plural matching cancels clues the family would keep; the manual review covers it until Sebastian sees it in play.
