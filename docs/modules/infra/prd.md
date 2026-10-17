---
updated: 2026-10-17
source: setup
---

# Infra: product

## Purpose

A family opens one address on their phones and plays together, at almost no cost and with nothing to maintain between game nights.
Infra is what makes that address work: the site, the commands, the live updates and the data are all in place before the first player arrives.

## User flows

### Opening the site

1. A player taps the invitation link on `family-night.fless.dev`.
2. The page loads over HTTPS, and a deep link such as a room URL opens the app on that screen.

Errors and empty states: before the first deploy of the code, the site shows a placeholder page and the API answers that it is not deployed yet.

### Playing live

1. Every phone in a room sees changes (a vote, a new phase) as they happen.
2. After a pause or a lost connection, the phone resynchronizes when it returns.

Errors and empty states: if live updates stop, the screen keeps the last state until the phone resynchronizes.

## Rules

- One address serves the site and the API, so players never configure anything.
- Players never publish live events, only the server does.
- Rooms and matches disappear 24 hours after the last activity; players and their names never do.
- Abuse is bounded by a cap on concurrent executions, on top of the 20-member room limit.
- Monthly cost stays near zero (a 5 USD budget exists in the account).

## Out of scope

- A second environment or a dev stage.
- Any vendor outside AWS and GitHub.

## Open questions

- None at setup.
