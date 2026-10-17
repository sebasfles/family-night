output "url" {
  description = "Public URL of the app"
  value       = module.app.url
}

output "distribution_id" {
  description = "CloudFront distribution in front of the site and the API"
  value       = module.app.distribution_id
}

output "site_bucket" {
  description = "Bucket the web build is synced to"
  value       = module.app.site_bucket
}

output "functions" {
  description = "Lambda function name per function"
  value       = module.app.functions
}

output "api_function_url_domain" {
  description = "Host of the API's function URL, which answers 403 to anything but CloudFront"
  value       = module.app.api_function_url_domain
}

output "tables" {
  description = "DynamoDB table name per table"
  value       = module.app.tables
}

output "events" {
  description = "Domains of the AppSync Events API"
  value       = module.app.events
}

output "deploy_role_arn" {
  description = "Role the deploy workflows assume from the main branch"
  value       = module.app.deploy_role_arn
}
