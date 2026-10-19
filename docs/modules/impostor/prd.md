---
updated: 2026-10-19
source: 0008_scoring_and_manada
---

# Impostor: product

Source of the rules: [implementation plan, Juego: Impostor](../../implementation-plan.md#juego-impostor).

## Purpose

A family sitting in one room, each on their own phone, plays a round-based social deduction game without paper, a moderator or a spoiled secret.
The phone is the private card and the ballot; the arguing stays face to face.

## User flows

### Host sets up a match

1. In the lobby the host sees the Impostor settings; everyone else sees them read-only.
2. The host picks the number of impostors (capped by the number of players), random or arrival order, the tie rule, whether impostors see the category, and the categories in play; the categories start collapsed behind a chevron with a summary ("Todas" or "5 de 10"), and anyone can open them while the lobby is open.
3. The host sees who will play (the members online at that moment) and confirms.
4. With fewer than 3 players online the start button is disabled and reads "Faltan N jugadores".

Errors: if the server finds the settings invalid at start (too many impostors, no category, too few players), the host sees the server's message and nothing starts.

### Playing a round

1. Each living player sees their card face down, and turns it over or back with a tap.
2. A civilian reads the word and its category.
3. An impostor reads "Eres el impostor" and a clue, plus the category only if the host enabled it; impostors do not learn who the other impostors are.
4. Everyone sees the speaking order with the first speaker highlighted.
5. While they talk in person, each living player taps another living player as their choice, may change it freely, and taps "Confirmar voto" to make it final; a confirmed vote cannot change. Their own choice stays marked on their phone after a reload.
6. Everyone sees who has confirmed (a check by the name) and "Votaron 4 de 6", never for whom; a choice not yet confirmed is invisible to the others.
7. Voting closes by itself when every living player has confirmed, or earlier when the host closes it; the confirmation says how many have not confirmed and that their choices count. A player with no choice at all abstains.

### Result and next round

1. The eliminated player's card turns over to say whether they were an impostor, and the vote counts climb while the players move into vote order.
2. A tie follows the host's rule and the screen says which: "Empate: nadie es eliminado" or "Empate: eliminado por sorteo", naming the player drawn.
3. If nobody voted, nobody is eliminated.
4. If the match goes on, the host taps "Siguiente ronda" and voting reopens without the eliminated players.

### End of the match

1. Everyone sees who won, the word turning over, who the impostors were, the elimination history by round, and the points of every player still in the room counting up.
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
- The civilians win when no impostor is left alive; the impostors win when they are as many as the living civilians.
- Words do not repeat within a night; when a category runs out, its used words become available again.
- Points on the night's scoreboard: when civilians win, +1 for each civilian who took part (alive or eliminated); when impostors win, each impostor (voted out or not) gets the civilians at the start divided by the impostors, rounded up (4 civilians and 1 impostor: +4). A player who left or was removed during the match scores nothing, even back as a spectator.

- If a living player leaves and every remaining living player has already voted, the vote closes by itself.
- A vote that ends the match still shows the result screen first; the host taps "Ver resultado" to reach the final screen.

## Out of scope

- Voice, video or text chat: the debate is in person.
- Points for an aborted match.
- A last-chance guess of the word by a caught impostor: the reveal in person is enough.

## Open questions

- None at setup.
