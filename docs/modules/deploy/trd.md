---
updated: 2026-10-17
source: setup
---

# Deploy: technical

## Structure

All code lives in `.github/workflows/`.

| Workflow | Runs on | Does |
|---|---|---|
| `checks.yml` | pull request to `main` | pnpm install, lint, typecheck and unit tests per workspace (`shared`, `api`, `web`) with serial flags, web build, `terraform fmt -check` and `validate`, actionlint. |
| `deploy-web.yml` | push to `main` touching `web/` or `shared/` | Re-runs the checks, builds with Vite, syncs `dist` to the site bucket (`index.html` with no-cache, assets immutable), invalidates `/index.html`. |
| `deploy-api.yml` | push to `main` touching `api/` or `shared/` | Re-runs the checks, bundles with esbuild for arm64 with `@aws-sdk/*` external, uploads with `update-function-code`. |

Both deploys also run on `workflow_dispatch`.
Their path filters also include the lockfile, `.nvmrc` and their own workflow file.
There is no e2e workflow in phase 1: the end-to-end pass is manual, per [the plan](../../implementation-plan.md#testing).

## Endpoints owned

None.
The workflows are the only jobs.

## Depends on

- `infra`: the deploy role, the site bucket, the distribution and the Lambda function, plus the repository variables below.
- `shared`, `api` and `web` workspaces for the scripts the workflows call.

## Depended on by

Nothing in code.
Production updates only through these workflows.

## Configuration

- Runtime: Node from `.nvmrc` (24), pnpm through corepack or `pnpm/action-setup`.
- Credentials: OIDC assuming the deploy role (`id-token: write`, `contents: read`); no stored AWS keys.
- Repository variables written by Terraform: `AWS_REGION`, `AWS_ROLE_ARN`, `SITE_BUCKET`, `DISTRIBUTION_ID`, `SITE_URL`, `FUNCTION_NAME`, `VITE_EVENTS_HTTP_DOMAIN`, `VITE_EVENTS_REALTIME_DOMAIN`.
- `deploy-web` passes the two `VITE_EVENTS_*` variables to the Vite build as environment; no `.env.production` is written and no script reads stack outputs.
- Each deploy serializes its own runs and never cancels one in flight.

## Testing

The workflows are linted by actionlint in `checks.yml`.
Their other behavior is only exercised by running them.
