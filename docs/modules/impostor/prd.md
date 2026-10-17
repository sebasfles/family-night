---
updated: 2026-10-17
source: setup
---

# Impostor: product

Source of the rules: [implementation plan, Juego: Impostor](../../implementation-plan.md#juego-impostor).

## Purpose

A family sitting in one room, each on their own phone, plays a round-based social deduction game without paper, a moderator or a spoiled secret.
The phone is the private card and the ballot; the arguing stays face to face.

## User flows

### Host sets up a match

1. In the lobby the host sees the Impostor settings; everyone else sees them read-only.
2. The host picks the number of impostors (capped by the number of players), random or arrival order, the tie rule, whether impostors see the category, the categories in play, and whether a caught last impostor gets a final guess.
3. The host sees who will play (the members online at that moment) and confirms.
4. With fewer than 3 players online the start button is disabled and reads "Faltan N jugadores".

Errors: if the server finds the settings invalid at start (too many impostors, no category, too few players), the host sees the server's message and nothing starts.

### Playing a round

1. Each living player sees their card, hidden by default, and shows or hides it with a tap.
2. A civilian reads the word and its category.
3. An impostor reads "Eres el impostor" and a clue, plus the category only if the host enabled it; impostors do not learn who the other impostors are.
4. Everyone sees the speaking order with the first speaker highlighted.
5. While they talk in person, each living player may vote for another living player and may change that vote until voting closes.
6. Everyone sees who has voted (a check by the name) and "Votaron 4 de 6", never for whom.
7. Voting closes by itself when every living player has voted, or earlier when the host closes it (with a confirmation when votes are missing); missing votes are abstentions.

### Result and next round

1. Everyone sees the players ordered by votes, the eliminated one highlighted, and whether they were an impostor.
2. A tie follows the host's rule and the screen says which: "Empate: nadie es eliminado" or "Empate: eliminado por sorteo".
3. If nobody voted, nobody is eliminated.
4. If the match goes on, the host taps "Siguiente ronda" and voting reopens without the eliminated players.

### Last chance

1. When the last impostor is voted out and the setting is on, that player sees five words and picks one.
2. Everyone else sees "X está intentando adivinar la palabra...".
3. A right pick means the impostors win ("¡Robó la victoria!"); a wrong one means the civilians win.
4. If the impostor is offline the host can skip the guess and the civilians win.

### End of the match

1. Everyone sees who won, the word, who the impostors were, the elimination history by round and the points earned.
2. The host chooses "Jugar otra vez" (same settings, a new word) or "Volver al lobby"; the rest see "Esperando al host...".
3. The host can end a match at any time without points.

### Eliminated players and latecomers

- Eliminated players keep their card and the match view with an "Eliminado" label, and cannot vote or be voted for.
- Someone who joins mid-match sees "Partida en curso, juegas en la siguiente" and the public state, labelled "Espectador".
- A player who leaves or is removed during a match counts as eliminated and their role is revealed.

## Rules

- At least 3 players; impostors allowed: 1 for 3 to 5 players, 2 for 6 to 8, 3 for 9 or more.
- Anyone can be an impostor, including the host, and an impostor can be the first to speak.
- Nobody votes for themselves or for an eliminated player.
- The civilians win when no impostor is left alive; the impostors win when they are as many as the living civilians, or by a right last guess.
- A last impostor who leaves the room, rather than being voted out, gets no last guess.
- Words do not repeat within a night; when a category runs out, its used words become available again.
- Points on the night's scoreboard: +1 for each civilian who took part (alive or eliminated) when civilians win, +2 for each impostor when impostors win.

- If a living player leaves and every remaining living player has already voted, the vote closes by itself.
- If the impostor making the last guess leaves the room, civilians win, as if the host had skipped the guess.
- A vote that ends the match still shows the result screen first; the host taps "Ver resultado" to reach the final screen.

## Out of scope

- Voice, video or text chat: the debate is in person.
- Points for an aborted match.

## Open questions

- None at setup.
