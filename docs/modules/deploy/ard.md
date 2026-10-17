---
updated: 2026-10-17
source: setup
---

# Deploy: decisions

## 2026-10-17: Workflows own code, Terraform owns configuration

- Decision: Terraform creates a placeholder `index.html` and a bootstrap Lambda and ignores them afterwards.
  The workflows replace the site files and the function code.
  Terraform also writes the repository Actions variables the workflows read (`AWS_ROLE_ARN`, `SITE_BUCKET`, `FUNCTION_NAME` and the rest), including the `VITE_EVENTS_*` ones injected at build.
- Alternatives rejected: shipping the front and the bundle through the infrastructure apply, as the plan's CDK `BucketDeployment` did; a script that writes `.env.production` from stack outputs.
- Reason: the apply never runs from CI, so a code release must not depend on it, and no name is hardcoded in a workflow.
- Debt created: none
- Revisit when: a resource name or variable must exist before Terraform has run.
- Source: setup

## 2026-10-17: Changes to shared/ trigger both deploys

- Decision: `deploy-web.yml` and `deploy-api.yml` both filter on `shared/`, besides their own folder.
- Alternatives rejected: filtering each deploy on its own folder only.
- Reason: `shared/` is the typed contract that `api` and `web` both import, so a change there can alter both builds.
- Debt created: none
- Revisit when: `shared/` splits into parts consumed by only one side, or a deploy needs ordering between web and api.
- Source: setup

## 2026-10-17: One production environment, deployed from main

- Decision: every push to `main` that matches a filter deploys to production.
  The deploy role trusts the immutable OIDC subject of `refs/heads/main`.
  There is no dev stage and no preview.
- Alternatives rejected: the plan's `dev` stage on `dev.family-night.fless.dev`.
- Reason: Sebastian runs a single environment with `main` as production in his other projects, and the same role trust is used in `cuentas-departamento`.
- Debt created: none
- Revisit when: a second environment is needed.
- Source: setup
