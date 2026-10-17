locals {
  ### General ##################################################################
  project        = "family-night"
  env            = "prd"
  aws_region     = "us-east-1"
  aws_account_id = "985610663508"

  tags = {
    Project     = local.project
    Environment = local.env
    ManagedBy   = "terraform"
  }

  ### DNS ######################################################################
  domain      = "family-night.fless.dev"
  hosted_zone = "family-night.fless.dev"

  ### GitHub ###################################################################
  github_owner               = "sebasfles"
  github_repository          = "family-night"
  github_app_id              = "4985607"
  github_app_installation_id = "162648841"
  git_branch                 = "main"
  required_checks            = ["shared", "api", "web", "infra", "workflows"]
}
