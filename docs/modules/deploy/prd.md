---
updated: 2026-10-17
source: setup
---

# Deploy: product

## Purpose

Merging to `main` is releasing.
A change reaches `family-night.fless.dev` without anyone running a command, and a pull request cannot be merged blind because its checks run first.
Nobody sees this module in the product, but it decides how quickly a fix reaches a family mid-night.

## User flows

1. A pull request to `main` runs the checks and shows pass or fail.
2. After the merge, the site updates if the change touched the front or the shared contract.
3. After the merge, the game server updates if the change touched the API or the shared contract.
4. Sebastian can rerun either deploy by hand without a new commit.
5. If a check or a deploy step fails, the live site keeps running the previous version.

## Rules

- Only `main` reaches production, and there is one environment.
- A change to the shared contract updates both sides.
- A deploy never goes out with failing lint, typecheck or unit tests.

## Out of scope

- Infrastructure changes: Sebastian applies them from his machine (`infra`).
- Automated end-to-end tests in phase 1: the pass is manual before the phase is called done.
- Preview or staging environments.

## Open questions

- None.
