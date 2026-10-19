---
updated: 2026-10-19
source: 0008_scoring_and_manada
---

# Just One: decisions

## 2026-10-18: Plural matching compares candidate singular forms

- Decision: two words match when any of their forms coincide: the normalized word, and it without a final `s`, without a final `es`, or with `ces` turned to `z`; normalization lowercases, drops accents and anything that is not a letter or digit, and keeps `ñ`.
- Alternatives rejected: one canonical singular per word.
- Reason: a single stripping rule cannot get both `mes`/`meses` and `luz`/`luces` right; comparing forms of both sides does.
- Debt created: rare short words can over-match (`me`/`mes`); the manual review restores them.
- Revisit when: the family reports a clue cancelled that was not a repeat.
- Source: 0005_just_one

## 2026-10-18: One error code of its own

- Decision: `NOT_CLUE_GIVER` (403, "En esta ronda no te toca dar pista") for a clue, cancel or show from someone who is not a clue-giver, the host excepted on show; a cancel naming an author without a clue is `TARGET_NOT_MEMBER`; `accept-guess` on a pass, a correct guess or a second tap is `STALE_ROUND`; a guess from anyone but the adivinador is `INVALID_GUESS`.
- Alternatives rejected: reusing `NOT_PSYCHIC` or `INVALID_VOTE`, whose messages name other games.
- Reason: the UI shows the server message as is.
- Debt created: none
- Revisit when: a client needs to tell these apart differently.
- Source: 0005_just_one

## 2026-10-18: A pass is a null guess

- Decision: `PUT guess` carries `{ round, guess }` with `guess: null` for Pasar; a guess is 1 to 30 characters and may hold spaces, and is checked with the same normalization as clues.
- Alternatives rejected: a separate pass endpoint; a one-word guess like clues.
- Reason: one command for the adivinador's single move, and a typed "la palta" is the host's to accept.
- Debt created: none
- Revisit when: articles in guesses are reported as wrong often.
- Source: 0005_just_one

## 2026-10-18: What `/me` gives a clue-giver per phase

- Decision: in CLUE the word and the caller's own stored clue; in REVIEW and GUESS the word and every reviewed clue, the caller's own taken from those; nothing from the reveal on.
- Alternatives rejected: own clue from the stored items in every phase; the clue list only in REVIEW.
- Reason: a clue stored just after the host closed the clues must not read as given; a clue-giver who reloads in GUESS keeps what they saw in the review.
- Debt created: none
- Revisit when: the guess screen needs more than the public clues.
- Source: 0005_just_one

## 2026-10-18: Cancellations made in review stay when an author leaves

- Decision: a clue-giver leaving in REVIEW removes only their own clue and its cancel mark; a clue cancelled as their duplicate stays cancelled until someone restores it.
- Alternatives rejected: recomputing automatic cancellations after a departure.
- Reason: manual and automatic marks are indistinguishable once in review, and a recompute would undo a hand-made cancel.
- Debt created: none
- Revisit when: families miss a clue that was left crossed out.
- Source: 0005_just_one

## 2026-10-18: The cancelled turn shows until the review opens

- Decision: `skipped` stays in the public state through CLUE and clears when REVIEW opens.
- Alternatives rejected: clearing it on the first clue, as Wavelength clears it on its clue.
- Reason: CLUE is many people writing, not one; the notice is useful until the phase ends.
- Debt created: none
- Revisit when: the notice feels stale on screen.
- Source: 0005_just_one

## 2026-10-18: The reveal shows the round's points from the outcome

- Decision: "Esta ronda" reads +1, 0 or −1 from the outcome, with "el puntaje no baja de 0" when the floor hid the −1; the adivinador reads the verdict in the second person.
- Alternatives rejected: the score difference, which reads 0 for a wrong guess at 0.
- Reason: a wrong guess must say it cost something even when the floor absorbed it.
- Debt created: none
- Revisit when: the floor or the points change.
- Source: 0005_just_one

## 2026-10-18: Clue entry details on the web

- Decision: the clue input drops whitespace as it is typed; after a commit the CLUE secret is refetched so the clue-giver sees their own clue, while whether the form shows comes from the public `committedPlayerIds`.
- Alternatives rejected: refusing a clue with a space on submit; keeping the sent clue only in component state.
- Reason: the rule is visible while typing, and a reload shows the same thing.
- Debt created: none
- Revisit when: clues need to be editable.
- Source: 0005_just_one

## 2026-10-18: Words restart from empty when exhausted

- Decision: `pickJustOneWord` takes unseen ids; when none is left `usedJustOneWordIds` restarts empty and the pick is from the whole bank.
- Alternatives rejected: keeping the latest ids out of the restart.
- Reason: about 200 words against at most 60 rounds a match; a restart is rare.
- Debt created: right after a restart the word just played can come up again.
- Revisit when: a family plays through the bank in one night.
- Source: 0005_just_one

## 2026-10-19: No night-points function for Just One

- Decision: Just One finishes without `scores`, and its final screen says the team score does not reach the night.
- Alternatives rejected: a `justOneNightPoints` that always returns nothing.
- Reason: a function that only returns an empty map is ceremony; the absence is the rule.
- Debt created: none
- Revisit when: the cooperative game should weigh on the night.
- Source: 0008_scoring_and_manada
