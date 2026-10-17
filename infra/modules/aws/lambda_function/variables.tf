variable "name" {
  description = "Function name, also the log group suffix and the IAM role name"
  type        = string
}

variable "memory_size" {
  description = "Memory in MB"
  type        = number
  default     = 512
}

variable "timeout" {
  description = "Timeout in seconds"
  type        = number
  default     = 10
}

variable "bootstrap_zip" {
  description = "Local zip the function is created with. The deploy workflow replaces the code and Terraform never looks at it again."
  type        = string
}

variable "environment" {
  description = "Plain environment variables. Never a secret: the value is readable in the function configuration."
  type        = map(string)
  default     = {}
}

variable "policy_statements" {
  description = "Statements of the function's role beyond its logs, keyed by capability name"
  type = map(object({
    actions   = list(string)
    resources = list(string)
  }))
  default = {}
}

variable "function_url" {
  description = "Give the function a URL that only signed requests (AWS_IAM) can call"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention"
  type        = number
  default     = 14
}
