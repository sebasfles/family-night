---
updated: 2026-10-19
source: 0008_scoring_and_manada
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

## 2026-10-17: A vote is a plain ballot put followed by a snapshot sync

- Decision: `PUT votes` checks the round, puts the ballot keyed by round and voter, then runs the room-state write that recomputes `votedPlayerIds` from the round's ballots and closes the round when every living player has one; a retry that finds its ballot already reflected changes nothing. A late vote whose round closed answers 200 if the voter is among the closed round's voters, `STALE_ROUND` otherwise.
- Alternatives rejected: putting the ballot inside the version-conditional transaction.
- Reason: with the ballot inside the transaction, 20 simultaneous voters each need their own winning write and exhaust the four attempts; as a sync, retries collapse and the test sees at most two conflicts per request.
- Debt created: a voter who changes their vote in the instant between the closing read and the closing write gets 200 while the tally counted their earlier choice.
- Revisit when: a player reports a changed vote that was not counted.
- Source: 0003_impostor

## 2026-10-17: `votedPlayerIds` keeps the closed round's voters during the reveal

- Decision: elimination does not remove the voter; the list clears when the next round opens.
- Alternatives rejected: dropping the eliminated from the list.
- Reason: a late vote request needs to know whether its ballot was counted, and the eliminated player's ballot was.
- Debt created: none
- Revisit when: the reveal needs to show who voted.
- Source: 0003_impostor

## 2026-10-17: A guess by anyone but the caught impostor is `NOT_GUESSER`, and config errors carry their own message

- Decision: a new 403 `NOT_GUESSER`; `AppError` takes an optional Spanish message, used for "Con N jugadores puede haber como máximo M impostor(es)" and "Elige al menos una categoría".
- Alternatives rejected: reusing `INVALID_VOTE`; one generic `INVALID_CONFIG` text.
- Reason: the UI shows the server message as is, so it must say what to fix.
- Debt created: none
- Revisit when: a client needs to tell config problems apart by code.
- Source: 0003_impostor

## 2026-10-17: Secrets and ballots expire 24 h after they are written

- Decision: `MatchSecrets` and `Votes` get their `ttl` once; only the room, the writing member and the current match are renewed on activity.
- Alternatives rejected: renewing every secret on each ping.
- Reason: a match lasts minutes, and renewing up to 21 items per ping costs writes for nothing.
- Debt created: a match left open for more than a day loses its secrets and ballots.
- Revisit when: a match is seen running past a day.
- Source: 0003_impostor

## 2026-10-17: A departure during the reveal finishes the match only on a win

- Decision: a living player leaving in `REVEAL` is eliminated with the role shown, and the match finishes at once only if the outcome is already a win; the would-be guesser leaving gives civilians the win.
- Alternatives rejected: always waiting for the host's button.
- Reason: the host's button would otherwise lead to a last chance with nobody to guess or a round with a decided result.
- Debt created: none
- Revisit when: players find the jump to the final screen abrupt.
- Source: 0003_impostor

## 2026-10-17: The config schema lives on its own shared entry point

- Decision: `impostorConfigSchema` is in `shared/src/schemas.ts`, exported as `@family-night/shared/schemas` and imported only by the api; the lobby enforces the same limits through its controls.
- Alternatives rejected: keeping it in `domain.ts`.
- Reason: a module-level zod call is kept by tree shaking and put zod in the web bundle (largest chunk 124 KB to 40 KB without it).
- Debt created: none
- Revisit when: the web needs to validate a config itself.
- Source: 0003_impostor

## 2026-10-17: The caller's own vote is kept on the device per match and round

- Decision: after the server accepts a vote the web stores `{ round, targetId }` in `sessionStorage` under the match id and marks it again after a reload of the same round.
- Alternatives rejected: returning the caller's vote from the server.
- Reason: targets must never travel in a snapshot or event, and only the voter's own phone needs it.
- Debt created: none
- Revisit when: a player switches phone mid-round and expects the mark.
- Source: 0003_impostor

## 2026-10-17: The lobby starts with the impostor count it shows

- Decision: the shown count is the stored one capped by the online players, and the start sends that.
- Alternatives rejected: sending the stored count and letting the server refuse it.
- Reason: someone leaving after the host chose 2 impostors should not make the start fail.
- Debt created: none
- Revisit when: the host is surprised by a lower count.
- Source: 0003_impostor

## 2026-10-18: A vote is a provisional choice until confirmed, and an early close counts choices

- Decision: `PUT votes { round, targetId, confirmed }` serves both: a choice overwrites the ballot until it is confirmed, and a confirmed ballot is final through a put conditional on the stored ballot not being confirmed. `votedPlayerIds` lists confirmed voters while voting and every counted voter after the close; the round closes by itself when every living player has confirmed. An early close counts unconfirmed choices. A confirm carries its target, so a lost provisional request cannot confirm someone else.
- Alternatives rejected: counting only confirmed votes on an early close; a separate confirm endpoint; enforcing the lock only in the UI.
- Reason: Sebastian's call: a forgotten tap must not become an abstention; the server lock holds against racing requests; keeping counted voters after the close keeps the late-vote rule (200 if your ballot counted).
- Debt created: none new; the 2026-10-17 debt of a vote changed at the instant of the close now applies only to an unconfirmed choice.
- Revisit when: a changed choice is reported as not counted.
- Source: 0006_gameplay_and_redesign

## 2026-10-18: Choices and confirmations show at once

- Decision: a choice and a confirmation go through the platform's optimistic overlay: the phone marks them at once and steps back with the server message if refused; others see only the confirmed check from the snapshot. Supersedes "No optimistic updates on votes".
- Alternatives rejected: waiting for the server, as before.
- Reason: Sebastian's call that every tap feels instant; the overlay rolls back exactly, so a stale or invalid vote no longer lingers.
- Debt created: none
- Revisit when: a refused vote is seen as accepted.
- Source: 0006_gameplay_and_redesign

## 2026-10-18: No last chance

- Decision: the last-chance guess is gone: config flag, `IMPOSTOR_GUESS`, `POST guess`, `POST skip-guess`, `NOT_GUESSER` and the guess options of `#MATCH`. A stored config with `impostorLastGuess` still parses with the key dropped; a match left in `IMPOSTOR_GUESS` at deploy can only be aborted.
- Alternatives rejected: a typed guess instead of five options.
- Reason: Sebastian's call: the reveal in person is enough.
- Debt created: a match left in `IMPOSTOR_GUESS` at deploy shows only the header and card until the host aborts it.
- Revisit when: such a match is seen after the deploy.
- Source: 0006_gameplay_and_redesign

## 2026-10-18: The final points list everyone still in the room

- Decision: the final scoreboard shows every participant still in the room, losers at +0, counting up and moving into place; points are unchanged.
- Alternatives rejected: listing winners only, as before.
- Reason: a full scoreboard reads as a result and gives the rows somewhere to move.
- Debt created: none
- Revisit when: the list feels long in a 20-player room.
- Source: 0006_gameplay_and_redesign

## 2026-10-19: A returning departed player shows on the final with +0

- Decision: the final scoreboard keeps listing every participant still in the room, so a player in `departedIds` who came back as a spectator appears with +0.
- Alternatives rejected: hiding departed players from the final list.
- Reason: the list mirrors the room, and the points are right; only the row is debatable.
- Debt created: a player who left and came back reads as a loser with +0 rather than as absent from the match.
- Revisit when: a family finds that row confusing.
- Source: 0008_scoring_and_manada
