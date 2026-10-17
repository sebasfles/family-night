output "name" {
  description = "Function name"
  value       = aws_lambda_function.this.function_name
}

output "arn" {
  description = "Function ARN"
  value       = aws_lambda_function.this.arn
}

output "url_domain" {
  description = "Host of the function URL, which is what a CloudFront origin takes; null without a URL"
  value       = var.function_url ? trimsuffix(trimprefix(aws_lambda_function_url.this[0].function_url, "https://"), "/") : null
}
