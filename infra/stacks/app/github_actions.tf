data "github_user" "owner" {
  username = var.github_owner
}

data "github_repository" "this" {
  full_name = "${var.github_owner}/${var.github_repository}"
}

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  tags = { Name = "github-actions" }
}

locals {
  github_subject = "repo:${var.github_owner}@${data.github_user.owner.id}/${var.github_repository}@${data.github_repository.this.repo_id}:ref:refs/heads/${var.git_branch}"
}

data "aws_iam_policy_document" "assume_github" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [local.github_subject]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${local.name_prefix}-deploy"
  assume_role_policy = data.aws_iam_policy_document.assume_github.json

  tags = { Name = "${local.name_prefix}-deploy" }
}

resource "aws_iam_role_policy" "deploy" {
  name = "deploy"
  role = aws_iam_role.deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ListSite"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = module.site_bucket.arn
      },
      {
        Sid      = "SyncSite"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${module.site_bucket.arn}/*"
      },
      {
        Sid      = "UpdateFunctions"
        Effect   = "Allow"
        Action   = ["lambda:UpdateFunctionCode", "lambda:GetFunction", "lambda:GetFunctionConfiguration"]
        Resource = [module.api.arn, module.events_auth.arn]
      },
      {
        Sid      = "Invalidate"
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
        Resource = module.cdn.distribution_arn
      },
    ]
  })
}

locals {
  actions_variables = {
    AWS_REGION                  = var.aws_region
    AWS_ROLE_ARN                = aws_iam_role.deploy.arn
    SITE_BUCKET                 = module.site_bucket.id
    DISTRIBUTION_ID             = module.cdn.distribution_id
    SITE_URL                    = module.cdn.url
    FUNCTION_NAME               = module.api.name
    EVENTS_AUTH_FUNCTION_NAME   = module.events_auth.name
    VITE_EVENTS_HTTP_DOMAIN     = module.events.http_domain
    VITE_EVENTS_REALTIME_DOMAIN = module.events.realtime_domain
  }
}

resource "github_actions_variable" "this" {
  for_each = local.actions_variables

  repository    = var.github_repository
  variable_name = each.key
  value         = each.value
}

resource "github_branch_protection" "main" {
  repository_id  = data.github_repository.this.node_id
  pattern        = var.git_branch
  enforce_admins = false

  required_status_checks {
    strict   = false
    contexts = var.required_checks
  }
}
