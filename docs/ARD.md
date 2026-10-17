---
updated: 2026-10-17
source: setup
---

# Architecture and Debt Record

Global decisions, as a dated log, and the index of debt across modules.
Module-level decisions live in `modules/{{module}}/ard.md`.

## Decisions

## 2026-10-17: Serverless on AWS in the project's own account, mirroring cuentas-departamento

- Decision: static React SPA in S3 behind CloudFront, one TypeScript Lambda under `/api`, DynamoDB, AppSync Events for realtime, Terraform, GitHub Actions over OIDC, in AWS account `985610663508` with zone `family-night.fless.dev`.
- Alternatives rejected: the plan's CDK with API Gateway and an origin secret; a managed realtime vendor; a shared account.
- Reason: Sebastian's call: every personal project follows the same shape so modules, workflows and habits carry over, and each project has its own account per his global rules.
- Debt created: none
- Revisit when: a project need breaks the shared shape.
- Source: setup

## 2026-10-17: One repository, one pnpm workspace, shared contract package

- Decision: `shared/`, `api/`, `web/` are one pnpm workspace; `shared` holds the types and pure rules both sides import; `infra/` and `.github/workflows/` sit beside them.
- Alternatives rejected: independent npm folders as in cuentas-departamento; generated clients from an API spec.
- Reason: front and back must agree on every payload and event; importing one package makes an incompatible change a compile error.
- Debt created: a change in `shared/` deploys both web and api.
- Revisit when: the contract needs consumers outside this repository.
- Source: setup

## 2026-10-17: Anonymous permanent identity, no accounts

- Decision: a device is a player: public `playerId` plus secret `playerToken` in localStorage, a random permanent name, no login and no name change.
- Alternatives rejected: accounts with login; names chosen by the user.
- Reason: zero friction for a family joining from a WhatsApp link; the plan excludes accounts and name changes on purpose.
- Debt created: clearing the browser makes a new player.
- Revisit when: players want their name or score across devices.
- Source: setup

## 2026-10-17: Single production environment deployed from main

- Decision: `main` is production at `family-night.fless.dev`; no dev stage.
- Alternatives rejected: a `dev` stage with `dev.family-night.fless.dev` as the plan sketched.
- Reason: Sebastian's call; one family as audience, same as his other projects.
- Debt created: infrastructure changes have only `terraform plan` as preview; end-to-end tests run only against production.
- Revisit when: a bad deploy reaches a game night.
- Source: setup

## Debt index

Open debt only: an entry with `Resolved by` leaves the table.
Rebuilt by `write-ard` on every run, kept current by `document-task` on every task.

| Module | Date | Debt | Revisit when |
|---|---|---|---|
| general | 2026-10-17 | A change in `shared/` deploys both web and api | Contract has consumers outside the repo |
| general | 2026-10-17 | Clearing the browser makes a new player | Players want name or score across devices |
| general | 2026-10-17 | Only `terraform plan` previews infra; e2e only against production | A bad deploy reaches a game night |
| platform | 2026-10-17 | 10,000 name combinations; past that names get a number | The suffix fallback starts to fire |
| platform | 2026-10-17 | A failed publish is only logged; a phone stays stale until the next event or reconnect | Stale phones reported in play |
| platform | 2026-10-17 | Host transfer is lazy; a silent host stays until someone acts | A room stays hostless in practice |
| platform | 2026-10-17 | Own WebSocket client: AppSync Events protocol changes are on us | Handshake changes |
| infra | 2026-10-17 | Requests with a body need `x-amz-content-sha256`; no per-route throttle beyond reserved concurrency | Abuse shows up in logs |
| infra | 2026-10-17 | Authorizer cold start on the first realtime connect after a quiet period | Players notice the delay |
| infra | 2026-10-17 | State bucket settings are not in code | Bucket needs a change or a second environment |
| infra | 2026-10-17 | The abuse cap is the account Lambda limit of 10, not a reservation | Account limit rises above 10 |
| infra | 2026-10-17 | Certificate shares the stack's region | Working region changes |
