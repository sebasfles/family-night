---
phase: 1
branch: feat/0006_gameplay_and_redesign
updated: 2026-10-18
---

# Phase 1: Gameplay fixes

## Scope

- Optimistic updates for the player's own commands (lobby actions, Impostor vote and confirm, Wavelength clue and dial confirm, Just One clue, cancel, guess): the UI reflects the action at once and rolls back with the server message as toast when refused.
- Name change: `PATCH /api/players/me` with a 2 to 20 character name unique among players; editable from the lobby; the new name reaches every phone through the snapshot.
- Impostor: remove the last-chance guess (config flag, LAST_CHANCE phase, host skip, five-word pick, docs); civilians win when the last impostor is voted out.
- Impostor: vote selection is provisional, "Confirmar" locks it; a confirmed vote cannot change; unconfirmed selections count when the host closes early; voting closes by itself when every living player has confirmed.
- Wavelength: bands 4 within 2.5, 3 within 7.5, 2 within 12.5, else 0; the dial's numbers and band regions aligned.
- Wavelength: a synthesized tick on each dial step through the Web Audio API, unlocked on the first touch, with a mute control remembered on the device.

## Acceptance

1. Tapping a vote, confirm, clue or guess changes the screen within one frame, and a refused command restores the previous state with the server message.
2. A player renames themselves from the lobby; the name is validated (2 to 20 characters, unique) and appears on every phone; the ARD records the overridden decision.
3. Impostor has no last-chance setting or phase; when the last impostor is voted out, the result screen declares the civilians winners.
4. A confirmed vote cannot be changed; voting closes when all living players have confirmed; an early close counts unconfirmed selections.
5. Wavelength scores by the new bands (shared tests) and the dial labels sit on the regions they name at the three widths.
6. The dial ticks while turning and the mute control silences it across reloads.
7. Every verification target passes; screenshots of the changed screens at 390, 768 and 1280 px.

## om-developer notes

### Round 1

Done:

- Shared: `DIAL_BANDS` are 4 within 2, 3 within 7, 2 within 12 (integer distances, so 2.5, 7.5 and 12.5 on the dial); `normalizePlayerName` and `playerNameKey` in `shared/src/players.ts`; `VoteRequest.confirmed`; `RenamePlayerRequest`/`RenamePlayerResponse`; errors `VOTE_CONFIRMED`, `NAME_TAKEN`, `INVALID_NAME`; the last chance gone from config, phases, `ImpostorGuess`, `NOT_GUESSER`, rules and constants.
- Api: `PATCH /api/players/me` through one `updateRoom` write (player rename conditional on the old name, claim of the new name unless the caller already owns it, release of the old name conditional on `playerId`, the member's name); a rejoin refreshes a stale member name; `POST guess` and `POST skip-guess` removed; a ballot is a put conditional on not being confirmed, and a refused put of the same target with `confirmed: true` is an idempotent success.
- Web: optimistic overlay (`web/src/api/optimistic.ts`, `useRoomView`, `useRoomMutation(code, command, optimistic)`), every room command of a phone runs in one mutation scope so they reach the server in tap order; lobby rename dialog; Impostor select and "Confirmar voto"; Wavelength band drawing and labels on half-point edges, tick and mute; drafts of clues and guesses kept per round so a rollback restores the text; `LastChance.tsx` deleted.
- Screenshots: `screenshots/phase_1/` in the workspace, every screen at 390, 768 and 1280, plus the dial at targets 0, 3, 50, 97 and 100, the voting selection and confirmation, and the rename dialog.

Decisions the plan did not record:

- `votedPlayerIds` lists confirmed voters while voting and, once the round closes, every voter whose ballot counted (confirmed or not), so the existing late-vote rule ("200 if your ballot was counted") keeps working for early closes.
- One endpoint for selection and confirmation: `PUT votes { round, targetId, confirmed }`. Confirming carries the target, so a lost provisional request cannot confirm a different player.
- The old stored Impostor config keeps `impostorLastGuess` in Dynamo and in the snapshot until it is saved again; the zod schema drops the key on every parse (start, config, rematch). Snapshots are not rewritten.
- Phase vibration follows the served snapshot, not the overlay, so an own optimistic step or its rollback never vibrates.
- Name length counts graphemes (`Intl.Segmenter`), so an emoji counts as one character.
- In-room clash is also checked in the dialog before sending; the server stays the authority.
- The dial's mute control shows only to a guesser who has not confirmed, above the dial; the tick is a 30 ms triangle at 1800 Hz; the context is resumed on pointerdown, pointerup, key and button presses, so on iOS the first drag ticks once the finger lifts.
- Lobby busy states removed for config, game pick, host and kick (optimistic now); start, rematch, lobby and leave keep their busy button.
- `terraform validate` ran after a local `terraform init -backend=false` (no AWS access); the diff does not touch infra.

Deferred:

- A match left in `IMPOSTOR_GUESS` shows only the header and card until the host aborts it; no explanatory copy.

Pending: none.

### Round 2

Applied the four findings, none disputed:

1. `normalizePlayerName` refuses control characters, format characters other than U+200D, the blank fillers U+115F, U+1160, U+2800, U+3164 and U+FFA0, and any grapheme made only of marks or joiners; length counts the remaining graphemes. `INVALID_NAME` and the dialog hint now say "caracteres visibles".
2. An Impostor selection whose target is no longer in `order` counts as none: Confirmar is disabled and the hint reads "Quien elegiste ya no está en juego. Elige de nuevo."
3. `mutateAsync` removed from `useRoomMutation`.
4. `ConfirmDialog` and `RenameDialog` focus once on mount and keep Escape bound to the latest `onCancel` through a ref.

Screenshots refreshed in `screenshots/phase_1/`.

## Result

Approved by Sebastian on 2026-10-18 at c29ccc2, after 2 rounds.

- Delivered as scoped: optimistic own commands through a pending overlay, rename from the lobby, last chance removed, provisional and confirmed votes, Wavelength bands 4/3/2 with labels on their zones, dial tick with mute.
- Deviations: `votedPlayerIds` lists confirmed voters while voting and every counted voter after the close; one `PUT votes { round, targetId, confirmed }` serves selection and confirmation; name length counts graphemes and names must be visible; one tick per pointer move on fast drags.
- Debt: a match left in `IMPOSTOR_GUESS` at deploy shows only the header and card until the host aborts it.
- For phase 3 docs: the decisions under om-developer notes of rounds 1 and 2 feed `document-task`.

