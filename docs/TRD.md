---
updated: 2026-10-17
source: setup
---

# Technical Requirements Document

Describes the whole application.
The repository holds no code yet; this file states the agreed shape, which the first tasks create.
Where it differs from `implementation-plan.md`, this file wins.

## Components

| Component | Kind | Path | Base branch | Stack |
|---|---|---|---|---|
| shared | app | `shared/` | `main` | TypeScript, pure types and rules, no AWS dependency |
| api | app | `api/` | `main` | TypeScript on AWS Lambda (Node 24, ARM64), Hono router, zod |
| web | app | `web/` | `main` | React 19, Vite, TanStack Router (file-based), TanStack Query, Tailwind |
| infra | app | `infra/` | `main` | Terraform, AWS provider, GitHub provider |
| deploy | app | `.github/workflows/` | `main` | GitHub Actions |

`shared`, `api` and `web` are one pnpm workspace rooted at `package.json` and `pnpm-workspace.yaml`; `shared` is the contract both others import.
Node comes from `.nvmrc` (24).

### shared

- Stack: TypeScript 5 strict (`noUncheckedIndexedAccess`), Vitest.
- Layout: `src/api.ts` request and response types per endpoint, `src/events.ts` realtime event types, `src/domain.ts` room, player and match types, `src/constants.ts` limits, `src/impostor/rules.ts` pure game rules.
- Install: `pnpm install --frozen-lockfile` at the root.
- Workspace files: none.
- API spec: none; the types in `src/api.ts` are the contract and the api handler tests pin the shapes.
- Data: none.
- Delivery: never deployed alone; bundled into `api` and `web`.

### api

- Stack: TypeScript, Hono as internal router, one Lambda handler (`src/index.ts`) and a Node server entry for local runs (`@hono/node-server`), AWS SDK v3 (`lib-dynamodb`) left external to the bundle, SigV4-signed `fetch` to AppSync Events, Vitest.
- Layout: `src/handlers/` routes, `src/services/` players, rooms, presence, matches, impostor, `src/repos/` one class per table, `src/realtime/publish.ts`, `src/lib/` errors, validation, auth, `src/data/` names and word bank.
- Install: `pnpm install --frozen-lockfile` at the root.
- Workspace files: none; table names and `EVENTS_HTTP_DOMAIN` come from the Lambda environment, locally from `.env` (ignored).
- API spec: none; `shared/src/api.ts` is the contract.
- Data: DynamoDB, seven on-demand tables prefixed `family-night-prd-` (see `modules/platform/database.md` and `modules/impostor/database.md`). No ORM, no migrations.
- Delivery: one Lambda `family-night-prd-api` behind a Function URL (`AWS_IAM`) that CloudFront reaches through origin access control under `/api/*`; deployed from `main` by `deploy-api.yml`.

### web

- Stack: React 19, Vite, `@tanstack/react-router` with `@tanstack/router-plugin`, `@tanstack/react-query`, Tailwind CSS, own components, Vitest with Testing Library.
- Layout: `src/routes/` file-based routes, `src/api/` typed client and query hooks, `src/realtime/` AppSync Events WebSocket client, `src/identity/` player in localStorage, `src/components/`, `src/games/impostor/`, `public/og.png`.
- Install: `pnpm install --frozen-lockfile` at the root.
- Workspace files: `.env.production` is not committed; `deploy-web.yml` passes `VITE_EVENTS_HTTP_DOMAIN` and `VITE_EVENTS_REALTIME_DOMAIN` from repository variables. Locally a `.env.local` (ignored) with the same two.
- API spec: none; calls `/api/...` relatively.
- Data: none of its own.
- Delivery: static files in a private S3 bucket behind CloudFront at `family-night.fless.dev`, deployed from `main` by `deploy-web.yml`.

### infra

- Stack: Terraform >= 1.10, state in S3 (`family-night-terraform-state-985610663508`, created once with the AWS CLI), AWS provider 6, GitHub provider 6 through the shared GitHub App.
- Layout: `environments/prd/` backend, providers and locals, `stacks/app/` the application, `modules/aws/*` leaf modules mirrored from cuentas-departamento.
- Install: `terraform init` in `environments/prd/`.
- Workspace files: `environments/prd/terraform.tfvars` (ignored) holding `github_app_pem`, shape in `terraform.tfvars.example`.
- Delivery: `terraform apply` from Sebastian's machine with `AWS_PROFILE=fless-family-night`, never from CI; see `modules/infra/trd.md`.

### deploy

- Stack: GitHub Actions, AWS credentials over OIDC assuming `family-night-prd-deploy`.
- Delivery: push to `main` deploys production, path-filtered per component; nothing deploys from a machine or another branch.

## Verification targets

`verify-task` reads this table literally.
One row per component.
Commands run one at a time, serial flags included.

| Target | Path | lint | typecheck | unit | e2e |
|---|---|---|---|---|---|
| shared | `shared/` | `pnpm lint` | `pnpm typecheck` | `pnpm vitest run --no-file-parallelism` | n/a |
| api | `api/` | `pnpm lint` | `pnpm typecheck` | `pnpm vitest run --no-file-parallelism` | n/a |
| web | `web/` | `pnpm lint` | `pnpm typecheck` | `pnpm vitest run --no-file-parallelism` | n/a |
| infra | `infra/environments/prd/` | `terraform fmt -check -recursive ../..` | `terraform validate` | n/a | n/a |
| deploy | `./` | `npx --yes github-actionlint@1.7.12` | n/a | n/a | n/a |

`pnpm lint` is `eslint . && prettier --check .` in every workspace.
`terraform validate` needs `terraform init` first.
End-to-end testing in phase 1 is manual, on real phones, per `PRD.md`.

## Modules

Modules belong to the application and may span components.

| Module | Purpose | Components | Docs |
|---|---|---|---|
| platform | Permanent anonymous identity, rooms, lobby, presence, invitation, realtime snapshot and the match lifecycle every game shares | shared, api, web | [README](modules/platform/README.md) |
| impostor | The Impostor game: rules, endpoints, screens and word bank | shared, api, web | [README](modules/impostor/README.md) |
| infra | Every AWS resource the app runs on, the deploy role and the repository variables | infra | [README](modules/infra/README.md) |
| deploy | CI on pull requests and deploy of `main` to production | deploy | [README](modules/deploy/README.md) |

## Environments and delivery

- Base branch `main`, which is production; every change arrives by pull request.
- One environment: `https://family-night.fless.dev`. There is no dev environment.
- AWS account `family-night` (`985610663508`, SSO profile `fless-family-night`), region `us-east-1`, Route53 zone `family-night.fless.dev` delegated from `fless.dev` by the `foundation` project.
- GitHub repository `sebasfles/family-night`, public.
- Fixed cost target: inside the AWS free tier; the account budget is 5 USD per month.

## Conventions

- Contract first: any payload change starts in `shared/`; an incompatible change breaks the build, not the game.
- Every command is a REST call; every realtime message is published by the Lambda, never by a client, and carries the full public room snapshot with a monotonic `version`.
- Every request with a body carries `x-amz-content-sha256`, computed in the web client, because CloudFront origin access control signs requests to the Function URL.
- Realtime subscribers authenticate with `playerId:playerToken` through the Events API's Lambda authorizer; no API key.
- Secrets (word, role, clue) live only in `MatchSecrets` and reach a player only through `GET /api/matches/{id}/me`; they never enter a snapshot, an event or a log.
- Writes that change the snapshot are conditional on `version` (optimistic locking, three retries); round numbers in bodies make game commands idempotent.
- Errors are `{ error: { code, message } }` with the message in Spanish, shown as is by the UI.
- Game rules are pure functions in `shared/src/impostor/rules.ts`, tested without AWS.
- UI is mobile-first (360 px), 48 px touch targets, 18 px base text, Spanish copy; code and docs in English.
- Markdown docs put each sentence on its own line and never use the em dash.
