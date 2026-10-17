module "app" {
  source = "../../stacks/app"

  project     = local.project
  env         = local.env
  aws_region  = local.aws_region
  domain      = local.domain
  hosted_zone = local.hosted_zone

  github_owner      = local.github_owner
  github_repository = local.github_repository
  git_branch        = local.git_branch
  required_checks   = local.required_checks
}
