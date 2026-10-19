---
updated: 2026-10-19
source: 0008_scoring_and_manada
---

# La manada: decisions

## 2026-10-19: Config is a goal plus a kept round count

- Decision: `{ goal: 'ROUNDS' | 'POINTS', rounds }` with rounds 5 to 15 (10 by default); `rounds` stays stored while the goal is points.
- Alternatives rejected: a union where points mode has no rounds; a rounds value of 0 meaning "until 8".
- Reason: switching the goal back keeps the host's choice, and the schema stays one strict object.
- Debt created: none
- Revisit when: a third goal is added.
- Source: 0008_scoring_and_manada

## 2026-10-19: "8 puntos" also ends at round 99

- Decision: with the points goal the match also ends after round 99 (`MANADA_ROUND_LIMIT`), as if its rounds ran out.
- Alternatives rejected: no limit.
- Reason: 99 is the highest round any request body accepts; past it every command would fail and the match could only be aborted.
- Debt created: none
- Revisit when: the round limit of the bodies changes.
- Source: 0008_scoring_and_manada

## 2026-10-19: Answers group per word on Just One's matching

- Decision: two answers match when they have the same number of words, after dropping one leading article, and each word pair matches with `sameWord`; groups are the transitive closure, ordered by size and then by who answered first, and each automatic group is labelled with its first spelling.
- Alternatives rejected: one normalized string per answer; similarity scores.
- Reason: plural per word ("perros calientes" with "perro caliente") needs words compared one by one, and reusing `sameWord` keeps one notion of "the same word" across games.
- Debt created: answers that differ in word count do not group ("hot dog", "hotdog"), nor synonyms; the host merges them.
- Revisit when: the family asks the host to merge the same kind of pair often.
- Source: 0008_scoring_and_manada

## 2026-10-19: Merges name groups by a member and split all at once

- Decision: `merge-groups` takes `groupIds: [a, b]`, where a group's id is its first member and any member names it; the merge stores the union of both groups' players, so a chain is several merges; `split-group` removes every merge touching that group, back to its automatic groups. The host sees "Separar" on any merged group, even when it is the only one.
- Alternatives rejected: an undo stack of the last merge; merges keyed by normalized text.
- Reason: player ids survive regrouping and departures, and "Separar" on the group is the undo the host can see.
- Debt created: splitting a chain undoes all of it, not just its last step.
- Revisit when: a host wants to undo only part of a chain.
- Source: 0008_scoring_and_manada

## 2026-10-19: Two error codes of its own

- Decision: `ANSWER_CONFIRMED` (409, "Ya confirmaste tu respuesta") for a second answer and `NOT_IN_MATCH` (403, "No juegas esta partida, juegas en la siguiente") for a spectator's answer; a merge or split naming a player without an answer is `TARGET_NOT_MEMBER`.
- Alternatives rejected: reusing `VOTE_CONFIRMED` or `STALE_ROUND`, whose messages say something else.
- Reason: the UI shows the server message as is.
- Debt created: none
- Revisit when: another game needs the same refusals.
- Source: 0008_scoring_and_manada

## 2026-10-19: `/me` gives the own answer only while answering

- Decision: in ANSWER, `/me` returns the caller's stored answer or null; nothing in other phases; there is no round secret item, because the question is public.
- Alternatives rejected: keeping the question secret until everyone is in.
- Reason: a reload must show the confirmed answer, and after the reveal every answer is public.
- Debt created: none
- Revisit when: a question needs to be hidden.
- Source: 0008_scoring_and_manada

## 2026-10-19: Winners are the top scorers without the cow, even at 0

- Decision: the winners are the players still in, without the cow, with the highest score, whatever it is; when it is 0 the banner says "Nadie sumó puntos" and the podium still ranks them first.
- Alternatives rejected: no winners when nobody scored, which would put a cow holder with points first on the podium.
- Reason: the cow holder can never win, and the podium must agree with that.
- Debt created: none
- Revisit when: a family finishes a match without points and the result reads wrong.
- Source: 0008_scoring_and_manada

## 2026-10-19: Questions restart from empty when exhausted

- Decision: `pickManadaQuestion` takes unseen ids; when none is left `usedManadaQuestionIds` restarts empty and the pick is from the whole bank.
- Alternatives rejected: keeping the latest ids out of the restart.
- Reason: about 200 questions against at most 15 rounds a match, as Just One's words.
- Debt created: right after a restart the question just played can come up again.
- Revisit when: a family plays through the bank in one night.
- Source: 0008_scoring_and_manada

## 2026-10-19: Group cards list names without avatars

- Decision: a group card is a paper card with the answer and plain name chips.
- Alternatives rejected: the coloured avatars of the scoreboard.
- Reason: the avatar tones are made for the dark surfaces and do not read on paper.
- Debt created: none
- Revisit when: avatars get a paper variant.
- Source: 0008_scoring_and_manada
