---
name: environment-accounts
description: AWS account/profile, GitHub remote alias and DNS setup for family-night; check before any deploy or push instruction
metadata:
  type: reference
---

- AWS: account 985610663508, CLI profile `fless-family-night` (SSO, AdministratorAccess), region us-east-1. Created by Sebastian's `foundation` project.
- DNS: the account owns hosted zone `family-night.fless.dev` (delegated from fless.dev). CDK looks up that zone, not `fless.dev`.
- GitHub: `sebasfles/family-night` (public). Remote uses the ssh alias `personal-github`; `gh auth switch -u sebasfles` before `gh` calls (default active account is a work one).
- Git author in this repo: Sebastian Flores <sefles5683243@gmail.com> (local config, the global one is the work email).
- Only prod stage in phase 1, no `dev` stage.
