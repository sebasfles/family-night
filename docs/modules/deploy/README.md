---
updated: 2026-10-17
source: setup
---

# Deploy

CI on pull requests and the deploy of `main` to production, as GitHub Actions.
It checks every change and releases the site and the API when `main` moves, using OIDC and the repository variables Terraform writes.

## Boundaries

- Owns: the workflows.
- Does not own: the resources they deploy into, the deploy role and the repository variables (`infra`).
- Code: `.github/workflows/`.

## Documents

- [prd.md](prd.md): product behavior
- [trd.md](trd.md): workflows and configuration
- [ard.md](ard.md): decisions and debt
- [database.md](database.md): tables and invariants
