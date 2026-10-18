---
updated: 2026-10-18
source: 0005_just_one
---

# Platform

The layer every game of Family Night stands on.
A player gets a permanent anonymous identity, creates or joins a room by a four letter code, waits in a lobby, and the host starts matches of any game.
Every phone sees the same room in real time.

## Boundaries

- Owns: identity and the random name, rooms and membership, host rules and transfer, lobby, presence, invitation, the realtime channel and the room snapshot contract, the match lifecycle shared by every game, the game registry and the selected game, and the web shell (routes, identity bootstrap, state-driven navigation, HTTP and realtime clients).
- Does not own: game rules, endpoints and screens (`impostor`, `wavelength`, `justone`), AWS resources (`infra`), workflows (`deploy`).
- Code: `shared/src/` except the game folders, `api/src/{lib,repos,realtime}`, `api/src/handlers/{context,matches,shared-match,rooms,players}.ts`, `api/src/services/{players,rooms,presence,matches,games.ts}`, `web/src/{routes,identity,api,realtime,components}` except the game routes.

## Documents

- [prd.md](prd.md): product behavior
- [trd.md](trd.md): structure and endpoints
- [ard.md](ard.md): decisions and debt
- [database.md](database.md): tables and invariants
- [flows.md](flows.md): command flow and presence states
