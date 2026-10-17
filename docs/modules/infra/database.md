---
updated: 2026-10-17
source: setup
---

# Infra: database

Columns and types live with the modules that own the data (see their `database.md`); this file says which tables infra provisions and what it keeps true.

## Tables owned

All tables are on demand and named `family-night-prd-{table}` in lowercase (for example `family-night-prd-rooms`).

| Table | Owner module | Provisioned as |
|---|---|---|
| `Players` | platform | point-in-time recovery and deletion protection, no TTL |
| `PlayerNames` | platform | point-in-time recovery and deletion protection, no TTL |
| `Rooms` | platform | TTL attribute `ttl` |
| `RoomMembers` | platform | TTL attribute `ttl` |
| `Matches` | platform | TTL attribute `ttl` |
| `MatchSecrets` | impostor | TTL attribute `ttl` |
| `Votes` | impostor | TTL attribute `ttl` |

## Outside Terraform

| Resource | Why |
|---|---|
| `family-night-terraform-state-985610663508` | Terraform state, created once with the AWS CLI |

## Invariants kept in code

- Only `Players` and `PlayerNames` are protected against deletion and restorable, because they are the only permanent data.
- The five game tables expire through `ttl`; the application writes the value, infra only enables the expiry.

## Migrations of note

- None; greenfield.
