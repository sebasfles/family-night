data "aws_caller_identity" "current" {}

data "aws_route53_zone" "this" {
  name         = var.hosted_zone
  private_zone = false
}

locals {
  name_prefix = "${var.project}-${var.env}"
  account_id  = data.aws_caller_identity.current.account_id

  site_bucket_name = "${local.name_prefix}-site-${local.account_id}"
}
