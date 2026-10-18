# Family Night

Mobile web app of party games for one family, each player on their own phone in a shared room, at `family-night.fless.dev`.

## Where things are

- Product, technical and architecture docs live in `docs/`. Start with `docs/TRD.md` for stack and commands, `docs/PRD.md` for what the product does, `docs/ARD.md` for decisions and debt.
- Each module has its own folder in `docs/modules/{{module}}/` with `README.md`, `prd.md`, `trd.md`, `ard.md`, `database.md` and optionally `flows.md`.
- `docs/implementation-plan.md` is Sebastian's original spec (Spanish); the docs above are the current truth where they differ.
- Tasks live in `docs/tasks/`; drafts in `docs/tasks/_drafts/` are not tracked.

## Read before working

1. This file.
2. `docs/TRD.md` and `docs/PRD.md`.
3. Only the module you are about to touch.

## Rules

- Base branch: `main`, which is production; every change arrives by pull request.
- Run tests one at a time, serially; see the Verification section of `docs/TRD.md`.
- User-facing text is in Spanish; code and docs are in English.
- Any payload change starts in `shared/`; `api` and `web` import the contract from there.
- No secret (word, role, clue, Wavelength target or an unrevealed guess) ever enters a room snapshot, an event or a log; `playerToken` is never logged.
- Terraform applies only from Sebastian's machine with `AWS_PROFILE=fless-family-night`, never from CI.
