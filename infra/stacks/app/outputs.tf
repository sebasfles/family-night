output "url" {
  description = "Public URL of the app"
  value       = module.cdn.url
}

output "distribution_id" {
  description = "CloudFront distribution in front of the site and the API"
  value       = module.cdn.distribution_id
}

output "site_bucket" {
  description = "Bucket the web build is synced to"
  value       = module.site_bucket.id
}

output "functions" {
  description = "Lambda function name per function"
  value       = { api = module.api.name, events_auth = module.events_auth.name }
}

output "api_function_url_domain" {
  description = "Host of the API's function URL, which answers 403 to anything but CloudFront"
  value       = module.api.url_domain
}

output "tables" {
  description = "DynamoDB table name per table"
  value       = { for key, table in module.tables : key => table.name }
}

output "events" {
  description = "Domains of the AppSync Events API"
  value       = { http = module.events.http_domain, realtime = module.events.realtime_domain }
}

output "deploy_role_arn" {
  description = "Role the deploy workflows assume from the main branch"
  value       = aws_iam_role.deploy.arn
}
