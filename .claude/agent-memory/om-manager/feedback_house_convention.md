---
name: house-convention-mirror-cuentas
description: New personal projects mirror cuentas-departamento (Terraform, OIDC deploys, root folders per app); a pasted plan is a spec to adapt, not to follow verbatim on infra
metadata:
  type: feedback
---

When a plan Sebastian pastes conflicts with how his other personal projects are built, follow the house convention and record the deviation in the ARD.
Reference project: `/home/fless/dev/personal/projects/cuentas-departamento` (and `foundation` for accounts/DNS).
Convention: Terraform (`infra/environments/prd`, `stacks/app`, `modules/aws/*`), state bucket by CLI, apply from his machine only, GitHub Actions over OIDC on push to `main`, Terraform owns config and writes repo variables, workflows own code, root folders per app (`api/`, `web/`, `infra/`), modules `infra` and `deploy` separate, single `prd` environment.

**Why:** on 2026-10-17 his plan said CDK + API Gateway; he redirected to "mirá cuentas-departamento y factored-ai, usamos terraform" and accepted Function URL + OAC, Node 24, 4 modules.
**How to apply:** before `setup` or `plan-task` on infra/deploy work, read the sibling project's `docs/modules/infra` and `deploy` and propose the mirrored shape with a one-line recommendation per change.
