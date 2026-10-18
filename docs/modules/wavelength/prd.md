---
updated: 2026-10-18
source: 0004_wavelength
---

# Wavelength: product

## Purpose

A family reads each other's minds on a scale: how "Shrek 2" sits between "Mala película" and "Buena película" is a matter of taste, so the fun is in guessing how the psychic thinks.
Everyone plays on their own dial, so nobody waits for a team to agree.

## User flows

### Host sets up a match

1. In the lobby the host taps the Wavelength card; every phone shows it as the chosen game.
2. The host picks Vueltas 1, 2 or 3: how many times each player will be the psychic; the panel says how many rounds that makes with the players online.
3. With at least 3 players online the host taps Iniciar and every phone moves to the game.

### The clue

1. The psychic sees the scale with the scoring zones around the hidden target and types a clue of up to 40 characters.
2. Everyone else sees the scale and "X está pensando la pista...".
3. If the psychic is offline the host sees "Saltar turno"; after a confirmation the turn passes to the next psychic, who keeps their own later turns.

### Guessing

1. The clue appears on every phone.
2. Each guesser moves their dial by dragging, with the − and + buttons (1 point) or the arrow keys, and taps Confirmar; the dial locks from that tap.
3. Everyone sees "Adivinaron N de M"; nobody sees where the others put their dial.
4. The round reveals when the last guesser confirms, or when the host taps Cerrar (with a confirmation when some are missing).

### Reveal and end

1. Everyone sees the target, every guess with its name on the dial, the round's points and the running totals; players with equal points share a place.
2. The host taps "Siguiente ronda", or "Ver resultado" after the last turn; the rest wait.
3. The final screen names the winner (or the tie) and the scoreboard; the host chooses "Jugar otra vez" (same settings, unseen scales) or "Volver al lobby".
4. The host can end a match at any time without points.

### Leaving and latecomers

- A guesser who leaves or is removed drops out of the round and of the match, and their confirmed guess is discarded.
- A psychic who leaves cancels the round; the next psychic goes and every phone says who left.
- Someone who left and comes back, or joins mid-match, watches as "Espectador" and plays from the next match.
- With fewer than 2 players left the match ends at once with the points so far.

## Rules

- At least 3 players online to start; individual play, no teams.
- The psychic order is drawn at the start and repeats every cycle.
- The target is a whole number from 0 to 100; a guess scores 4 points within 5 of it, 3 within 10, 2 within 15, 1 within 25, otherwise 0.
- The psychic scores the average of the confirmed guesses' points, rounded half up; 0 when nobody confirmed. Guessers who did not confirm score 0.
- Scales do not repeat within a night; when all have been played they start over.
- Points reach the night's scoreboard when the match ends, only for players still in it.

## Out of scope

- Teams and the original left/right counter-guess.
- Timers.

## Open questions

- Whether the dial feels precise enough on a phone; Sebastian tries it after merge.
