---
updated: 2026-10-17
source: 0002_identity_and_rooms
---

# Platform: product

## Purpose

A family of ages 20 to 60 plays party games together, each on their own phone, with no accounts and nothing to install.
The platform gets everyone into the same room in seconds and keeps all phones in step, so the games can focus on being games.
A room lasts the whole night and holds many matches of different games.

## User flows

### First visit

1. The player opens the site and is given a name like "Cóndor Veloz", with nothing to fill in.
2. The name is theirs on this device from then on, across reloads and future visits.

Errors and empty states: if the stored identity is no longer valid, the player silently gets a new one and a new name.

### Create or join a room

1. On the home page the player is greeted by name and either taps Crear sala or types a four letter code and taps Unirme.
2. Creating opens the room as its host; joining opens the lobby of that room.
3. Opening an invitation link `/{CODE}` joins directly, also on a reload, without losing the place.

Errors and empty states: a code that does not exist or expired shows "Esta sala no existe o ya expiró" with a button to create a new room; a full room (20) refuses the newcomer; a malformed code goes back to the home page.

### Invite

1. In the lobby the code is shown large, with Copiar link and Compartir.
2. Copiar puts the link on the clipboard and says "¡Link copiado!".
3. Compartir opens the phone's share sheet, or WhatsApp when the device has none.
4. The link previews in WhatsApp with title "Noche de juegos" and an image.

Errors and empty states: cancelling the share sheet does nothing.

### Lobby

1. Everyone sees the members, a crown on the host, a green dot online or grey "ausente", the night's score, and "(tú)" on themselves.
2. The host picks a game and its settings; others see the settings read only and "Esperando a que el host inicie...".
3. The host can make another member host or remove one, for example a phone that was closed; the removed phone goes home with "Te sacaron de la sala", and opening the link again lets it back in.
4. Any member can leave after confirming; if the host leaves, the oldest online member takes the crown, and a room left empty waits for its next joiner, who becomes host.
5. Starting a match moves every phone to the game screen; ending it or returning to the lobby moves every phone back, with nobody navigating by hand.

Errors and empty states: Just One and Wavelength appear as "Próximamente".

### Presence

1. A phone with the tab visible counts as online.
2. Hiding the tab turns the member grey "ausente" for everyone at once; coming back turns them online and refreshes their screen.
3. A member offline is never removed automatically.

### Join during a match

1. A newcomer sees the match in progress as a spectator and plays from the next one.

## Rules

- The name is permanent, unique among all players ever, with no way to change it; clearing browser data or switching device means a new player.
- Only the host chooses the game, configures, starts, ends and removes members, and returns the room to the lobby.
- If the host gives no sign of life for 60 s, the oldest online member becomes host; minimizing the phone alone does not count.
- At most 20 members per room.
- Rooms and matches vanish after 24 h without activity; players and names stay.
- Changes show on every phone in under a second.
- Secrets of a match (words, roles) are never visible to other players, not even by inspecting the network.
- The UI is Spanish only, built for a vertical phone, buttons at least 48 px, base text 18 px, dark mode supported.

## Out of scope

- Accounts or login, changing the name, text chat, voice or video, monetization, other languages.
- Rules of any game; they live in each game module.

## Open questions

- None; the QR code of the room is out of phase 1 for now (Sebastian, 2026-10-17).
