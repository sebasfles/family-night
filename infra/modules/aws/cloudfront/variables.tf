variable "name" {
  description = "Name of the distribution, its origin access controls, its headers policy and its function"
  type        = string
}

variable "domain" {
  description = "Public domain the distribution answers on"
  type        = string
}

variable "zone_id" {
  description = "Route 53 zone the alias records are written into"
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate covering the domain, issued in us-east-1"
  type        = string
}

variable "site_origin_domain_name" {
  description = "Regional domain of the site bucket, the default behavior. Built from the bucket name by the caller, because the bucket policy needs this distribution's ARN."
  type        = string
}

variable "api_origin_domain_name" {
  description = "Host of the API's function URL, served under /api/* with every method"
  type        = string
}

variable "content_security_policy" {
  description = "Content-Security-Policy sent with every response, next to the other security headers"
  type        = string
}
