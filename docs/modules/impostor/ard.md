---
updated: 2026-10-17
source: setup
---

# Impostor: decisions

Decisions come from [the plan](../../implementation-plan.md); where the plan states no reason, the reason is marked.

## 2026-10-17: The rules are pure functions in `shared`

- Decision: role assignment, vote resolution and win evaluation live in `shared/src/impostor/rules.ts` with no I/O.
- Alternatives rejected: none stated.
- Reason: they can be tested with Vitest without AWS, and web and api share one source of truth.
- Debt created: none
- Revisit when: a rule needs data the caller cannot pass in.
- Source: setup

## 2026-10-17: An impostor may speak first

- Decision: the turn order is shuffled (or by arrival) with no attempt to keep impostors out of the first place.
- Alternatives rejected: forcing a civilian first.
- Reason: if impostors were never first, the first speaker would be known to be clean.
- Debt created: none
- Revisit when: Sebastian wants the first speaker to carry no information.
- Source: setup

## 2026-10-17: Votes show who voted, never for whom

- Decision: the public state lists only `votedPlayerIds`; targets appear only in the tally when the round closes.
- Alternatives rejected: showing live targets.
- Reason: a visible ballot would sway the people who vote later and spoil the in-person debate.
- Debt created: none
- Revisit when: players ask to see live targets.
- Source: setup

## 2026-10-17: Secrets live in their own table and never travel the channel

- Decision: roles, words and clues sit in `MatchSecrets`, read only by the caller's own `/me` and by server logic; the snapshot is built without them.
- Alternatives rejected: per-player fields in the public match.
- Reason: the room snapshot goes to every phone on the channel, so any secret in it is visible by inspecting the network; a snapshot test guards this.
- Debt created: none
- Revisit when: a game needs a secret that changes during the match (the same table still fits, but check the caching of `/me`).
- Source: setup

## 2026-10-17: Every round action carries the round

- Decision: votes, close-voting and next-round send the round; one aimed at a closed round answers `STALE_ROUND` and changes nothing.
- Alternatives rejected: none stated.
- Reason: double taps and retries must not vote twice or skip a round.
- Debt created: none
- Revisit when: a new action is added that could repeat.
- Source: setup

## 2026-10-17: Closing the round is decided by the winning conditional write

- Decision: the vote that completes the set, or the host's close, computes the result under the room's version condition; only the winner publishes.
- Alternatives rejected: none stated.
- Reason: two players can vote in the same millisecond, and the round must close exactly once (tested with 20 parallel votes).
- Debt created: none
- Revisit when: a close needs work that cannot fit in one conditional write.
- Source: setup

## 2026-10-17: One vote per player per round is the table key

- Decision: `Votes` sorts by round and voter, so a vote is an overwrite and "all voted" is a prefix query.
- Alternatives rejected: none stated.
- Reason: no read-modify-write races between simultaneous voters.
- Debt created: none
- Revisit when: votes need history, since an overwrite loses the earlier choice.
- Source: setup

## 2026-10-17: No optimistic updates on votes

- Decision: the vote button waits for the server response, which carries the new room.
- Alternatives rejected: optimistic updates.
- Reason: the answer arrives in under 300 ms and optimistic state could show a vote that the server rejected as stale or invalid.
- Debt created: none
- Revisit when: response times exceed what a player tolerates on a poor connection.
- Source: setup

## 2026-10-17: Used words are tracked per room, reset per category

- Decision: `Rooms.usedWordIds` records the night's words; an empty pool in the active categories clears only their ids.
- Alternatives rejected: tracking by match or never repeating.
- Reason: a rematch or later match must not repeat a word during the night, yet a small category must not block the game.
- Debt created: none
- Revisit when: the bank grows enough that resets stop happening.
- Source: setup

## 2026-10-17: Server-side crypto randomness for roles and order

- Decision: impostors are drawn with `crypto.randomInt` and the order shuffled with Fisher-Yates over crypto randomness.
- Alternatives rejected: `Math.random`.
- Reason: the draw decides who the impostor is, so it should not be predictable.
- Debt created: none
- Revisit when: tests need seeds beyond the injected random source.
- Source: setup
