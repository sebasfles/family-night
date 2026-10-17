output "api_id" {
  description = "ID of the Events API"
  value       = aws_appsync_api.this.api_id
}

output "http_domain" {
  description = "Domain of the HTTP endpoint, where the server publishes"
  value       = aws_appsync_api.this.dns["HTTP"]
}

output "realtime_domain" {
  description = "Domain of the WebSocket endpoint, where clients subscribe"
  value       = aws_appsync_api.this.dns["REALTIME"]
}

output "namespace_arns" {
  description = "ARN of each channel namespace, which IAM publish permissions point at"
  value       = { for name, namespace in aws_appsync_channel_namespace.this : name => namespace.channel_namespace_arn }
}
