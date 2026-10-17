module "certificate" {
  source = "../../modules/aws/acm"

  domain_name = var.domain
  zone_id     = data.aws_route53_zone.this.zone_id
}

locals {
  content_security_policy = join("; ", [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https://${module.events.http_domain} wss://${module.events.realtime_domain}",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ])
}

module "cdn" {
  source = "../../modules/aws/cloudfront"

  name                    = "${local.name_prefix}-cdn"
  domain                  = var.domain
  zone_id                 = data.aws_route53_zone.this.zone_id
  certificate_arn         = module.certificate.certificate_arn
  content_security_policy = local.content_security_policy

  site_origin_domain_name = "${local.site_bucket_name}.s3.${var.aws_region}.amazonaws.com"
  api_origin_domain_name  = module.api.url_domain
}

resource "aws_lambda_permission" "cdn_url" {
  statement_id           = "AllowCloudFrontInvokeFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = module.api.name
  principal              = "cloudfront.amazonaws.com"
  source_arn             = module.cdn.distribution_arn
  function_url_auth_type = "AWS_IAM"
}

resource "aws_lambda_permission" "cdn_invoke" {
  statement_id  = "AllowCloudFrontInvokeFunction"
  action        = "lambda:InvokeFunction"
  function_name = module.api.name
  principal     = "cloudfront.amazonaws.com"
  source_arn    = module.cdn.distribution_arn
}
