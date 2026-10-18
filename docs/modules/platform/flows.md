---
updated: 2026-10-17
source: 0002_identity_and_rooms
---

# Platform: flows

## Command flow

Every action of every game follows this path; clients never publish to the channel.

```mermaid
sequenceDiagram
  participant P as Phone
  participant C as CloudFront
  participant L as Lambda api
  participant D as DynamoDB
  participant E as AppSync Events
  participant O as Other phones
  P->>C: POST /api/... with x-player-id and x-player-token
  C->>L: /api/* via Function URL, no cache
  L->>L: check token hash, membership, zod body
  L->>D: conditional write, version + 1, ttl renewed
  D-->>L: ok (on conflict: reread, up to 3 tries)
  L->>E: signed POST of room.updated with the public snapshot
  L-->>P: 200 with the same snapshot
  E-->>O: room.updated over WebSocket
  O->>O: apply only if version is greater than cached
```

If the publish fails the request still succeeds, and phones resync on their next event or reconnect.
On every subscription, the first and each after a reconnect, a phone refetches `GET /api/rooms/{code}`; on return to the foreground it pings, and the ping answers the room.

## Presence states

A member is online while the last sign of life is under 45 s old; the client recomputes this every 5 s, so going offline sends no event.

```mermaid
stateDiagram-v2
  [*] --> Online: join
  Online --> Online: ping every 20 s while visible
  Online --> Absent: 45 s without ping (computed by clients)
  Online --> Absent: tab hidden, away call, event published
  Absent --> Online: tab visible, ping answers the room, resubscribe, event published
  Absent --> Absent: host silent for more than 60 s, next request of an online member transfers the role
  Online --> [*]: leave or kick
  Absent --> [*]: leave or kick
```
