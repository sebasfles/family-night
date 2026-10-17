---
updated: 2026-10-17
source: setup
---

# Infra: decisions

## 2026-10-17: Terraform over the plan's CDK

- Decision: infrastructure is Terraform in `environments/prd`, `stacks/app` and `modules/aws/*`, with leaf modules copied from `cuentas-departamento`; the plan's CDK stacks are not built.
- Alternatives rejected: AWS CDK in TypeScript, as the plan wrote.
- Reason: house convention set by Sebastian, and the cuentas modules are reused as they are.
- Debt created: none
- Revisit when: the leaf modules drift from `cuentas-departamento` enough to need a shared source.
- Source: setup

## 2026-10-17: Function URL with origin access control over API Gateway

- Decision: the Lambda has a Function URL with `AWS_IAM` auth, reached by CloudFront origin access control under `/api/*`.
- Alternatives rejected: API Gateway HTTP API with an `x-origin-secret` header checked by the Lambda and stored in SSM.
- Reason: one service less and no shared secret to generate, store and rotate; abuse is bounded by reserved concurrency and the 20-member room cap.
- Debt created: requests with a body need the `x-amz-content-sha256` header, computed in the web client; the plan's 50 rps throttle has no replacement beyond reserved concurrency.
- Revisit when: abuse shows up in the logs, or per-route throttling is needed.
- Source: setup

## 2026-10-17: AppSync Events over API Gateway WebSocket

- Decision: realtime goes through AppSync Events, namespace `rooms`; clients subscribe through a Lambda authorizer and only the API Lambda role can publish.
- Alternatives rejected: API Gateway WebSocket API.
- Reason: Sebastian does not want to manage connection timeouts.
- Debt created: none
- Revisit when: none foreseen.
- Source: setup

## 2026-10-17: Single environment

- Decision: only `prd`; no dev stage and no `dev.family-night.fless.dev`; `main` is production.
- Alternatives rejected: the plan's `-c stage=dev` context.
- Reason: same as Sebastian's other projects, where `main` is production.
- Debt created: no place to try infrastructure changes before production; `terraform plan` is the only preview.
- Revisit when: a change needs testing that a plan cannot show.
- Source: setup

## 2026-10-17: State bucket outside Terraform

- Decision: `family-night-terraform-state-985610663508` is created once with the AWS CLI.
- Alternatives rejected: a bootstrap Terraform root for the bucket.
- Reason: same as `cuentas-departamento`: one bucket, and a second root adds a second state to keep.
- Debt created: the bucket's settings are not in code.
- Revisit when: the bucket needs a change, or a second environment appears.
- Source: setup

## 2026-10-17: GitHub OIDC provider owned by the stack

- Decision: the account's GitHub OIDC provider is a resource of `stacks/app`, and the deploy role trusts the immutable subject of `refs/heads/main`.
- Alternatives rejected: reading a hand-made provider with a data source.
- Reason: the account belongs to this project alone, as in `cuentas-departamento`.
- Debt created: none
- Revisit when: a second stack in the account needs GitHub OIDC.
- Source: setup

## 2026-10-17: Certificate in the same region as the stack

- Decision: the ACM certificate is created in us-east-1 next to everything else, with no second stack.
- Alternatives rejected: the plan's separate `CertStack` with cross-region references.
- Reason: the working region is us-east-1, which CloudFront requires for certificates, so nothing crosses regions.
- Debt created: moving the stack to another region would force the certificate into its own stack.
- Revisit when: the working region changes.
- Source: setup

## 2026-10-17: Subscribers authenticate with a Lambda authorizer, not an API key

- Decision: the Events API's auth providers are `AWS_LAMBDA` (default, for connect and subscribe) and `AWS_IAM` (publish); the authorizer `family-night-prd-events-auth` validates `playerId:playerToken` against `Players` and allows a channel only when the player is a member of that room, with results cached for 300 s.
- Alternatives rejected: the plan's API key, which expires within 365 days, lives in the web bundle and authenticates nobody; IAM through a Cognito identity pool for anonymous users.
- Reason: no expiring secret to rotate and redeploy, and a stranger holding a room code cannot watch its member list in real time.
- Debt created: a cold start of the authorizer on the first connect after a quiet period.
- Revisit when: a channel needs authorization finer than room membership.
- Source: setup
