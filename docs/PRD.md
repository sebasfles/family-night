---
updated: 2026-10-18
source: 0005_just_one
---

# Product Requirements Document

## Product

Family Night is a web app of party games for one family, ages 20 to 60, gathered in the same room.
Each player uses their own phone inside a shared room that lasts the whole evening; the host picks a game, several matches are played in a row, and the talking happens in person.
Phase 1 shipped the common platform and the Impostor game; Wavelength and Just One followed.
Source spec: [implementation-plan.md](implementation-plan.md) (Spanish).

## Users

- Host: creates the room, shares the link, configures and starts each match, resolves stuck situations (close a vote, kick a ghost, end a match).
- Player: joins from a WhatsApp link on their phone, sees only their own card, votes, follows the result.
- Latecomer or spectator: joins a room mid-match, watches the public state and plays from the next match.

## Capabilities

### Platform

Open the app once and you are a permanent player with a random name such as "Cóndor Veloz"; create a room with a 4-letter code or join one from its link; see who is in, who is host, who is away and the night's score; share the link with Copy and Share buttons; reload or minimize the phone without losing your place.
Details: [modules/platform/prd.md](modules/platform/prd.md)

### Impostor

Everyone gets the same secret word except the impostors, who get only a clue; players talk in person, vote on their phones, see who was eliminated and whether they were an impostor, until civilians or impostors win, with a last-chance guess for the final impostor.
Details: [modules/impostor/prd.md](modules/impostor/prd.md)

### Wavelength

Each round a psychic sees where a hidden target sits on a scale between two opposites and gives a short clue; everyone turns their own dial and scores by how close they land, and the psychic scores their average, until everyone has been the psychic.
Details: [modules/wavelength/prd.md](modules/wavelength/prd.md)

### Just One

Each round one player guesses a secret word from one-word clues the others write in secret; repeated clues cancel each other, the guesser sees only what survives and guesses or passes, and the team score is everyone's.
Details: [modules/justone/prd.md](modules/justone/prd.md)

## Cross-cutting rules

- No accounts and no login: identity is the device, and the name is assigned and permanent.
- Only the host configures, starts, ends matches and removes players; the host role passes on if the host disappears.
- Nobody can learn another player's secret, from the app or from inspecting the network.
- Rooms and matches vanish after 24 hours of inactivity; players and their names stay.
- Everything the user reads is Spanish.
- Phone first: one column, big buttons, readable text, dark mode follows the system.

## Not in the product

- Accounts, login, name changes.
- Text chat, voice or video: the debate is in person.
- Monetization, internationalization.
- Teams, timers and individual scores in the cooperative game.

## Open questions

- None at setup; the spec is complete for phase 1.
