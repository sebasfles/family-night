variable "name" {
  description = "Name of the Events API"
  type        = string
}

variable "namespaces" {
  description = "Channel namespaces; clients subscribe through the authorizer and only IAM principals publish"
  type        = list(string)
}

variable "authorizer_function_name" {
  description = "Lambda that authorizes every connect and subscribe"
  type        = string
}

variable "authorizer_function_arn" {
  description = "ARN of the same Lambda"
  type        = string
}

variable "authorizer_result_ttl_seconds" {
  description = "How long AppSync caches an authorizer answer"
  type        = number
  default     = 300
}
