---
updated: 2026-10-19
source: 0008_scoring_and_manada
---

# Wavelength: decisions

## 2026-10-18: Committed guesses stay secret until the reveal

- Decision: guesses live in `MatchSecrets` until the round closes; the public state lists only who committed, and the values enter `lastResult` at the reveal.
- Alternatives rejected: public guesses during GUESS.
- Reason: seeing the others' dials would anchor the rest.
- Debt created: none
- Revisit when: players ask to see live dials.
- Source: 0004_wavelength

## 2026-10-18: A guess is a plain put followed by a snapshot sync

- Decision: `PUT guess` puts `#GUESS#{round}#{playerId}` conditional on not existing, then the room-state write recomputes `committedPlayerIds` from the round's guesses and reveals when every guesser has one; close reads the same items. Follows Impostor's ballot pattern.
- Alternatives rejected: the guess inside the version-conditional transaction.
- Reason: 20 simultaneous guessers would exhaust the four attempts.
- Debt created: none
- Revisit when: a guess is reported as not counted.
- Source: 0004_wavelength

## 2026-10-18: One secret item per round

- Decision: each round's psychic and target are their own `#ROUND#{nn}` item, put with `attribute_not_exists` in the write that opens the round; reveal, close and `/me` read the key of the round they hold.
- Alternatives rejected: one `#MATCH` item overwritten every round; turning a round mismatch into a retry.
- Reason: with one item, a departure opening round r+1 between a commit's room read and its target read made the commit read the wrong round and answer 500; per-round items let the stale attempt fail on the version condition and retry.
- Debt created: none
- Revisit when: a round needs more secret data than the target.
- Source: 0004_wavelength

## 2026-10-18: Rotation by turn over a fixed drawn order

- Decision: the psychic order is drawn once with crypto randomness; `turn` indexes the `cycles` times `order` sequence and skips players who left; `round` rises with every opened round, cancelled ones included, so stale taps of a cancelled round answer `STALE_ROUND`.
- Alternatives rejected: a queue of remaining turns in the snapshot; one counter for both.
- Reason: the snapshot stays small at 20 players by 3 cycles, and a skipped psychic keeps their later turns with no bookkeeping.
- Debt created: none
- Revisit when: the order must change mid-match.
- Source: 0004_wavelength

## 2026-10-18: Leaving drops the player from the whole match

- Decision: leave or kick adds the player to `departedIds`: out of the current round (their guess deleted) and of the rotation; a psychic leaving in CLUE or GUESS cancels the round; a rejoin watches as Espectador with no points; under 2 players the match finishes with the points so far.
- Alternatives rejected: keeping a returning player's turns and points.
- Reason: Sebastian's call; one rule for leave and kick, no half-member states.
- Debt created: none
- Revisit when: families ask to resume after a dropped connection that turned into a leave.
- Source: 0004_wavelength

## 2026-10-18: Two error codes of its own

- Decision: `NOT_PSYCHIC` (403) for a clue from anyone but the psychic, `INVALID_GUESS` (422) for a guess from the psychic, a departed player or a spectator; a command meant for the other game answers `STALE_ROUND`.
- Alternatives rejected: reusing Impostor's `NOT_GUESSER` and `INVALID_VOTE`, whose Spanish messages name Impostor concepts.
- Reason: the UI shows the server message as is.
- Debt created: none
- Revisit when: a client needs to tell these apart differently.
- Source: 0004_wavelength

## 2026-10-18: Skip-psychic does not check presence on the server

- Decision: the host may skip in CLUE whatever the psychic's presence; only the web hides "Saltar turno" while the psychic is online.
- Alternatives rejected: refusing the skip of an online psychic.
- Reason: the server's 45 s window and the phone's 5 s recompute can disagree at the edge, and a refusal there would be confusing; the host can kick anyway.
- Debt created: none
- Revisit when: a host skips an online psychic by mistake.
- Source: 0004_wavelength

## 2026-10-18: A second commit is stale only once the first is counted

- Decision: a guess whose put finds an existing item answers `STALE_ROUND` if the caller is already in `committedPlayerIds`; otherwise it runs the sync and answers 200. The second value is never stored.
- Alternatives rejected: always `STALE_ROUND` on an existing item.
- Reason: a first commit whose sync failed with `CONFLICT` would otherwise stay uncounted until someone else commits.
- Debt created: none
- Revisit when: never, unless commits become editable.
- Source: 0004_wavelength

## 2026-10-18: The public state carries every guesser in the result and the cancelled turn

- Decision: `lastResult.guesses` lists every guesser of the round, `value: null` for those who did not commit; `skipped` holds the cancelled turn (who, why) until the next clue; `totals` per participant.
- Alternatives rejected: listing only committed guesses; a toast-only notice of a cancelled turn.
- Reason: the reveal shows "no respondió" with 0 points, and a reloaded phone still knows why the psychic changed.
- Debt created: none
- Revisit when: the result needs history beyond the last round.
- Source: 0004_wavelength

## 2026-10-18: Spectra restart from empty when exhausted

- Decision: `pickSpectrum` takes unseen ids; when none is left `usedSpectrumIds` restarts empty and the pick is from the whole bank.
- Alternatives rejected: keeping the latest ids out of the restart.
- Reason: about 150 pairs against at most 60 rounds a match; a restart is rare.
- Debt created: right after a restart the spectrum just played can come up again.
- Revisit when: a family plays through the bank in one night.
- Source: 0004_wavelength

## 2026-10-18: The dial is an own component

- Decision: an SVG semicircle with pointer drag (capture), 1-point −/+ buttons of 48 px and `role="slider"` with arrows, PageUp/PageDown by 10, Home and End; read-only it is an image with the scoring bands and name markers; locked, it hides its buttons.
- Alternatives rejected: a native range input.
- Reason: the game's feel is the dial, and 1 point of 100 must be reachable on a phone.
- Debt created: none
- Revisit when: Sebastian finds it imprecise on a phone.
- Source: 0004_wavelength

## 2026-10-18: Controls lock on the first tap and unlock only on refusal

- Decision: the clue form and Confirmar lock when tapped; the command's promise rejecting (the server refused) unlocks them, with the server message as a toast.
- Alternatives rejected: locking until the next snapshot.
- Reason: a double tap must not send twice, and a failed request must not be a dead end.
- Debt created: none
- Revisit when: a retry policy is added to mutations.
- Source: 0004_wavelength

## 2026-10-18: Equal points share a place

- Decision: the scoreboards use competition ranking (4, 2, 2, 0 reads 1, 2, 2, 4) and the final banner names every leader on a tie.
- Alternatives rejected: numbering rows by position.
- Reason: the table must not contradict the banner.
- Debt created: none
- Revisit when: a tie-break rule is wanted.
- Source: 0004_wavelength

## 2026-10-18: Bands 4, 3 and 2, one table for scoring and drawing

- Decision: `DIAL_BANDS` scores 4 within 2, 3 within 7, 2 within 12, otherwise 0, on integer distances, and the dial draws each zone half a point past its last scoring value (2.5, 7.5, 12.5) with its number on the zone; the same table drives both.
- Alternatives rejected: the 5/10/15/25 bands with a 1-point band.
- Reason: Sebastian's call after playing: the old bands were too generous; the board game's bands are the reference.
- Debt created: none
- Revisit when: rounds feel too hard to score.
- Source: 0006_gameplay_and_redesign

## 2026-10-18: The dial ticks through Web Audio, muted per device

- Decision: a 30 ms triangle at 1800 Hz synthesized on every value change of one's own dial (drag, buttons, keys); the audio context resumes on pointer, key and button presses, so on iOS a first drag ticks after the finger lifts; the mute toggle shows to a guesser who has not confirmed and is stored in localStorage.
- Alternatives rejected: audio files.
- Reason: no asset to load, no latency, nothing to cache.
- Debt created: on a fast drag one pointer move ticks once, however many points it jumps.
- Revisit when: the tick feels uneven on a phone.
- Source: 0006_gameplay_and_redesign

## 2026-10-18: The dial is three layers and the zones flip on the reveal

- Decision: the own dial component of 2026-10-18 is redrawn as three SVGs with one viewBox: the face with a lagoon to ember rim, the bands in `moon-bright`, `ember` and `orchid`, and the hand (ticks, name pins, needle, hub) that takes the pointer; on REVEAL the bands turn over from a striped shutter with the platform's `FlipReveal`; the psychic sees the zones without a flip.
- Alternatives rejected: flipping inside one SVG (no 3D on SVG groups).
- Reason: CSS 3D needs HTML boxes; layering keeps the pointer math and the zone geometry unchanged.
- Debt created: none
- Revisit when: the dial needs another animated layer.
- Source: 0006_gameplay_and_redesign

## 2026-10-19: The unscored size is its own constant

- Decision: `WAVELENGTH_UNSCORED_PLAYERS` (2) decides that a match started with that many players gives the night nothing; it is separate from `MIN_WAVELENGTH_PLAYERS`, also 2 today.
- Alternatives rejected: reusing the minimum.
- Reason: the rule is about two players always tying on the podium, not about who may start.
- Debt created: a match that started with 2 and lost one player still finishes with "Con 2 jugadores siempre empatan", though only one was left.
- Revisit when: the minimum or the podium changes.
- Source: 0008_scoring_and_manada
