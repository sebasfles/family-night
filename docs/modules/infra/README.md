---
updated: 2026-10-17
source: setup
---

# Infra

Every AWS resource Family Night runs on (CloudFront, S3, Lambda, DynamoDB, AppSync Events, DNS and certificate for `family-night.fless.dev`), the role the deploy uses and the repository's Actions variables, as Terraform.
It is for Sebastian and the agents that change the cloud setup.
There is one environment, `prd`, in account `985610663508`, region `us-east-1`.

## Boundaries

- Owns: resources and their configuration, the seven table definitions, the AppSync Events API and its authorization, the deploy role, the repository Actions variables.
- Does not own: the code shipped into the Lambda and the bucket (`deploy`), the shape of the data in the tables (`platform`, `impostor`), the hosted zone, the 5 USD budget and the state bucket (outside this stack).
- Code: `infra/`: `environments/prd` (backend, providers, the one environment), `stacks/app` (the app), `modules/aws/*` (leaf modules).

## Documents

- [prd.md](prd.md): product behavior
- [trd.md](trd.md): resources, apply and state
- [ard.md](ard.md): decisions and debt
- [database.md](database.md): tables provisioned and owners
