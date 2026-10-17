---
id: "0001"
title: scaffold_and_infra
type: feature
crew: devops
clearance: full
branch: feat/0001_scaffold_and_infra
modules: [infra, deploy, platform]
repos: ["."]
phases: 0
depends_on: []
ticket:
created: 2026-10-17
updated: 2026-10-17
---

# 0001 Scaffold and infra

## Goal

A fresh clone of the repository builds, lints and tests three empty workspaces, and `https://family-night.fless.dev` serves a placeholder page over the full production stack (CloudFront, S3, Lambda behind a Function URL, DynamoDB, AppSync Events with its authorizer, GitHub OIDC deploys), so every later task only adds behavior.

## Scope

- Root: `package.json`, `pnpm-workspace.yaml`, `.nvmrc` (24), `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`), ESLint + Prettier shared config, `README.md` pointing to `docs/`.
- `shared/`: package with `src/index.ts` exporting one type (`HealthResponse`) and one passing Vitest test; `lint`, `typecheck`, `test` scripts.
- `api/`: Hono app with `GET /api/health` answering `{ ok: true, version }` typed from `shared`, Lambda entry and Node entry, esbuild bundle script producing `dist/api.zip` and `dist/events-auth.zip`; the events authorizer denies every request for now; Vitest test of the health route; `lint`, `typecheck`, `test`, `build`.
- `web/`: Vite + React 19 + TanStack Router file-based with `__root.tsx` and `index.tsx` showing "Noche de juegos" and the result of `GET /api/health`; Tailwind; OG meta tags and `public/og.png`; one Testing Library test; `lint`, `typecheck`, `test`, `build`.
- `infra/`: `environments/prd` (backend S3 `family-night-terraform-state-985610663508`, providers aws 6 and github 6 via App 4985607 / installation 162648841, locals), `stacks/app`, `modules/aws/*` copied from cuentas-departamento plus new leaf modules `appsync_events` and, if needed, `cloudfront` extended for a Function URL origin with OAC.
  Resources per `docs/modules/infra/trd.md`: CDN with SPA function and security headers policy with CSP, site bucket, Lambda `family-night-prd-api` (nodejs24.x, arm64, 512 MB, 10 s, reserved concurrency 20, Function URL AWS_IAM + OAC, logs 14 d, placeholder code ignored), Lambda `family-night-prd-events-auth`, 7 DynamoDB tables (TTL `ttl` on the 5 game tables, PITR + deletion protection on Players and PlayerNames), AppSync Events API (Lambda authorizer default, IAM) with namespace `rooms`, ACM cert and Route53 alias in the existing zone, GitHub OIDC provider and `family-night-prd-deploy` role, repository Actions variables, `github_branch_protection` on `main` requiring the Checks workflow.
- `.github/workflows/`: `checks.yml` (PR: pnpm install, lint, typecheck, test, build per workspace; terraform fmt and validate; actionlint), `deploy-web.yml`, `deploy-api.yml` (updates both functions), per `docs/modules/deploy/trd.md`.
- Operations by the om-devops (Sebastian's call, 2026-10-17): create the state bucket with the AWS CLI (versioning, AES256, public access blocked), `terraform init/plan/apply` after reading the plan (any destroy or unexpected change is a blocker), verify the placeholder over HTTPS. The first code deploys run on Sebastian's merge.
- Update `docs/modules/infra/trd.md`, `docs/modules/deploy/trd.md` and `docs/TRD.md` where reality differs from the setup text.

## Out of scope

- Any game or room logic (0002, 0003); the authorizer only denies.
- Dev environment, e2e workflow, QR code.
- Deferred: Renovate or Dependabot config.

## Acceptance

1. `pnpm install --frozen-lockfile && pnpm -r lint && pnpm -r typecheck && pnpm -r test && pnpm -r build` pass on a fresh clone; every verification target of `docs/TRD.md` passes.
2. `terraform fmt -check` and `terraform validate` pass; `terraform plan` is empty after the apply.
3. `https://family-night.fless.dev` answers 200 over HTTPS with the placeholder, `/anything` returns `index.html`, `/api/health` returns 200 JSON from the Lambda through CloudFront, and the Function URL called directly returns 403.
4. A POST with a body to `/api/health` through CloudFront is rejected without `x-amz-content-sha256` and accepted with it (proves the OAC path for later tasks).
5. The Events API rejects a connect with no token and with a bogus token (authorizer denies).
6. `checks.yml` runs green on the task's PR; `main` requires it.
7. After merge, `deploy-web` and `deploy-api` run green and the site shows the React page with the health result.
8. Account cost stays inside the free tier; the 5 USD budget is untouched.

## Approach

- Module and layers touched: infra (every resource), deploy (three workflows), platform (workspace scaffold and the health slice only).
- Entities, endpoints, tables: `GET /api/health`; seven tables created, none written.
- Mirror `cuentas-departamento` for layout, modules, workflows and the deploy role; differences are the pnpm workspace, the two-function API bundle, AppSync Events and the OAC-to-Function-URL behavior.
- Decisions (confirmed by Sebastian 2026-10-17):
  - Branch protection on `main` requiring Checks, managed by Terraform: chosen over setting it by hand in GitHub because everything about the repo that Terraform can own, it owns.
  - `deploy-api` ships both Lambdas from one workflow: chosen over one workflow per function because they share source tree and checks.
  - Health endpoint as the first vertical slice through CloudFront, OAC and Lambda: chosen over an empty Lambda because it proves the request path and the body-hash requirement before game code exists.
  - The om-devops applies Terraform: chosen over Sebastian applying by hand, under the plan guard (read the plan, any destroy or unexpected change is a blocker).

## Database

Seven tables created, none written. See `docs/modules/platform/database.md` and `docs/modules/impostor/database.md`.

## Infra

Everything in Scope, in `prd` only.
Secrets: GitHub App PEM in gitignored `terraform.tfvars`, copied by the om-devops from `cuentas-departamento/infra/environments/prd/terraform.tfvars` (same App); no other secret.
IAM: deploy role least privilege (sync bucket, update two functions, invalidate), API Lambda role (7 tables, publish on `rooms`), authorizer role (read Players, RoomMembers).
CI/CD: three workflows, OIDC, repository variables written by Terraform.
Cost: free tier; CloudFront PriceClass_All as cuentas (family in Peru).

## Design

None.

## Risks

- First apply creates ~40 resources in prod; the om-devops reads the plan before applying and reports any destroy or unexpected change as a blocker.
- `aws_appsync_api` with `event_config` and a Lambda authorizer is newer than the cuentas modules; if the provider lacks an attribute, that is a blocker, not a workaround.
- OAC to Function URL requires `lambda:InvokeFunctionUrl` permission for the distribution and the body-hash header; acceptance 4 catches a misconfiguration.
- ACM DNS validation takes minutes; the apply waits.
- GitHub branch protection on a public repo under a personal account is supported on the free plan.

## Depends on

None.

## Context & decisions

Consolidated 2026-10-17 by the om-devops; decisions 1 to 5 accepted by Sebastian through the om-manager.
Pre-checks (read-only): SSO works on 985610663508; zone `family-night.fless.dev` exists; no state bucket and no OIDC provider yet; the GitHub App reaches the repo with administration and actions_variables write; the repo already uses the immutable OIDC subject; aws provider 6.69.1 has `aws_appsync_api` `event_config` with `lambda_authorizer_config` and `aws_appsync_channel_namespace`.

Decisions:

1. Adjustment to Scope (Sebastian): no reserved concurrency on `family-night-prd-api`.
   The account Lambda limit is 10 and AWS keeps 10 unreserved, so any reservation is rejected; the account limit already caps abuse below the planned 20, shared by both functions.
   Recorded as debt in `docs/modules/infra/ard.md`, revisit when the quota rises.
2. Adjustment to Acceptance 3 and 4 (Sebastian): before the PR the API Lambda runs the Terraform bootstrap (503 "not deployed yet", per `docs/modules/infra/prd.md`).
   Pre-PR evidence: `/api/health` through CloudFront reaches the bootstrap; the Function URL directly answers 403; a POST without `x-amz-content-sha256` answers 403 and with it reaches the bootstrap.
   The 200 `{ ok, version }` is checked after merge under Acceptance 7; no POST route is added.
3. Adjustment to the state machine (Sebastian): on `merged` the om-devops watches `deploy-web` and `deploy-api`, checks the site, `/api/health` 200 and the Acceptance 4 POST again, and reports `deploys green` or `blocker` before stopping; a failed deploy is fixed in a new task.
   Acceptance 8 evidence: every resource is request-priced or free tier, and Sebastian checks the budget in the foundation account (the member account has none).
4. Branch protection (Sebastian): `github_branch_protection` on `main` with `enforce_admins = false` (the om-manager's `planned` push to `main` keeps working as an owner bypass), required checks = the `checks.yml` job names, `strict = false`, no required reviews.
5. Sort keys (Sebastian): `MatchSecrets` SK `playerId` (a playerId or `#MATCH`), `Votes` SK `roundVoter` (`03#voterId`); recorded in the database docs.
6. om-devops: repository variable `EVENTS_AUTH_FUNCTION_NAME` beside `FUNCTION_NAME`, since `deploy-api` updates two functions; both trds updated.
7. om-devops: `.npmrc` `workspace-concurrency=1` so `pnpm -r` runs serially; `routeTree.gen.ts` committed and excluded from lint and format; screenshots of the page at 390, 768 and 1280 px in the workspace.
8. om-devops: leaf modules copied from cuentas and adapted: `cloudfront` drops the files origin, allows all methods on `/api/*` and takes a custom response headers policy with CSP; `lambda_function` and `dynamodb_table` gain the inputs this stack needs (TTL attribute, PITR and deletion protection only on Players and PlayerNames).

Constraints:

- Terraform applies only with `AWS_PROFILE=fless-family-night`, `prd` only (`CLAUDE.md`, `docs/modules/infra/trd.md`); read the plan first; any destroy or unexpected change is a blocker.
- Terraform owns configuration, workflows own code: bootstrap code and placeholder `index.html` are ignored after creation (`docs/modules/deploy/ard.md`).
- The deploy role trusts only the immutable subject of `refs/heads/main` (`docs/modules/infra/ard.md`); no stored AWS keys.
- Verification follows the targets table in `docs/TRD.md`, serially, with Node 24 from `.nvmrc`.

clearance: full, AWS account 985610663508 (`fless-family-night`, us-east-1, prd only: state bucket via CLI, terraform init/plan/apply), GitHub repo `sebasfles/family-night` via App 4985607 (variables, branch protection), PEM copied from cuentas-departamento tfvars.

## om-developer notes

### Round 1 (2026-10-17)

Done: pnpm workspace (`shared`, `api`, `web`) with the health slice, Terraform (`environments/prd`, `stacks/app`, leaf modules plus `appsync_events`), the three workflows; every target of `docs/TRD.md` green (see `verify.log`).
Screenshots at 390, 768 and 1280 px in `.workspaces/0001_scaffold_and_infra/screenshots/`, with the health online and down.

External actions, all on account 985610663508 with `AWS_PROFILE=fless-family-night`, us-east-1:

- `aws s3api create-bucket` `family-night-terraform-state-985610663508`, then versioning Enabled, AES256 default encryption, public access block all true; verified with the matching get calls.
- `terraform init` (S3 backend), `terraform plan -out`: 52 to add, 0 to change, 0 to destroy, all named in Scope; read before applying.
- `terraform apply tfplan`: 52 added; a second `terraform plan -detailed-exitcode` exits 0 with no changes.
- Checked over HTTPS: `/` and `/anything` 200 with the placeholder; `/api/health` through CloudFront 503 JSON from the bootstrap; the Function URL directly 403; POST with a body 403 without `x-amz-content-sha256` or with a wrong one, 503 from the bootstrap with the right one; security headers and CSP present.
- Events API: connect with no token rejected (400 required headers), with a bogus token rejected (401), the authorizer invoked once and denied.
- GitHub (through the App): nine Actions variables and `main` protection (checks `shared`, `api`, `web`, `infra`, `workflows`, not strict, no reviews, admins exempt) confirmed through the API.
- The production web build loads under the live CSP with no violations.

Decisions not recorded in the task:

- TypeScript `~6.0.3` (as cuentas; typescript-eslint does not support 7), so `docs/TRD.md` loses "TypeScript 5".
- The Lambda adapter is `@hono/aws-lambda`, since `hono/aws-lambda` is deprecated.
- `version` in the health response is the short commit SHA, injected by esbuild from `GITHUB_SHA`; `dev` locally.
- Bundles are zipped in Node with `fflate` and fixed timestamps, so the same source gives the same zip.
- `deploy-web` uploads `assets/` immutable and every other file `no-cache`, and invalidates `/*`, because `og.png` and `favicon.svg` are not hashed.
- The deploys also filter on the root workspace files (lockfile, `package.json`, base configs), which change both builds.
- The site placeholder has no inline styles because the CSP forbids them.

Pending: the 200 on `/api/health` and the web page live wait for the deploys on merge (Acceptance 7).
