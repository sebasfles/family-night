---
updated: 2026-10-17
source: setup
---

# Infra: technical

Plan sections: [Arquitectura AWS](../../implementation-plan.md#arquitectura-aws), [Infraestructura](../../implementation-plan.md#infraestructura-cdk-y-despliegue).
The Terraform in this module replaces the plan's CDK and API Gateway (see [ard.md](ard.md)).

## Structure

| Path | What |
|---|---|
| `infra/environments/prd` | Backend, providers, locals and variables of the one environment |
| `infra/stacks/app` | The app: CDN, storage, database, function, realtime, GitHub OIDC and variables |
| `infra/modules/aws/*` | Leaf modules copied from `cuentas-departamento`: `acm`, `cloudfront`, `dynamodb_table`, `lambda_function`, `s3` |

## Resources

- CloudFront `family-night-prd-cdn` at `family-night.fless.dev`: ACM certificate in us-east-1, Route53 alias at the apex of the existing zone `family-night.fless.dev` (looked up, never created, never `fless.dev`).
  - Default behavior: the private site bucket through origin access control, with a CloudFront function that serves `index.html` for any path without an extension.
  - `/api/*`: the Lambda's `AWS_IAM` Function URL through origin access control, caching disabled, all methods allowed, viewer headers forwarded except `Host`.
  - A response headers policy with the security headers and a CSP that allows only `self` and the AppSync Events HTTP and realtime domains.
- S3 site bucket: private, readable by the distribution only.
- Lambda `family-night-prd-api`: `nodejs24.x`, arm64, 512 MB, 10 s, reserved concurrency 20, log retention 14 days.
  - Role: read and write on the seven tables, publish on the `rooms` namespace of the Events API.
  - Permissions for CloudFront to invoke the function URL and the function.
  - Code starts as a bootstrap placeholder and is ignored after creation.
- DynamoDB: seven on-demand tables, see [database.md](database.md).
- AppSync Events: `aws_appsync_api` with `event_config` (Lambda authorizer as default provider, IAM as second), `aws_appsync_channel_namespace` `rooms` (subscribe through the authorizer, publish by IAM); no API key.
  - Authorizer Lambda `family-night-prd-events-auth`: `nodejs24.x`, arm64, read on `Players` and `RoomMembers`, invocable by the Events API, result TTL 300 s, log retention 14 days.
  - Both resources exist in AWS provider 6.69.0.
- IAM role `family-night-prd-deploy`, trusted by the account's GitHub OIDC provider (owned by this stack) for `refs/heads/main` only, matching the repository's immutable OIDC subject (owner and repository with their numeric ids, read from the GitHub provider).
  - It syncs the site bucket, updates the function's code and invalidates the distribution, nothing else.
- Repository Actions variables: `AWS_REGION`, `AWS_ROLE_ARN`, `SITE_BUCKET`, `DISTRIBUTION_ID`, `SITE_URL`, `FUNCTION_NAME`, `VITE_EVENTS_HTTP_DOMAIN`, `VITE_EVENTS_REALTIME_DOMAIN`.

Terraform owns configuration and the workflows own code: Lambda code and the site's `index.html` start as placeholders and are ignored after creation.

## Apply

From `infra/environments/prd`, with `AWS_PROFILE=fless-family-night` and a gitignored `terraform.tfvars` holding `github_app_pem`:

```
terraform init
terraform plan
terraform apply
```

Applied from Sebastian's machine, never from CI; `terraform plan` must be empty after every apply.
The GitHub provider uses App `4985607`, installation `162648841`.
State is in `family-night-terraform-state-985610663508` (S3 lockfile), a bucket created once with the AWS CLI outside Terraform.

## Depends on

- `foundation` project: the hosted zone `family-night.fless.dev`, delegated and already present, and the account budget.
- GitHub: the repository and its Actions variables, through the GitHub App.

## Depended on by

- `deploy`: the workflows read the Actions variables and assume the deploy role.
- `platform`: reads table names and `EVENTS_HTTP_DOMAIN` from the function environment, and signs its publishes with the function role.
- `impostor`: reads `MatchSecrets` and `Votes` table names from the function environment.
- `web`: the build injects the two `VITE_EVENTS_*` variables, and the client sends `x-amz-content-sha256` on every request with a body because origin access control signs requests to the Function URL.

## Configuration

- `EVENTS_HTTP_DOMAIN` and the table names: set by Terraform on the Lambda.
- `VITE_EVENTS_HTTP_DOMAIN`, `VITE_EVENTS_REALTIME_DOMAIN`: written by Terraform as repository variables, read by `deploy-web`.

## Testing

- No automated tests; verification is `terraform fmt -check`, `terraform validate` and an empty `terraform plan` after apply.
