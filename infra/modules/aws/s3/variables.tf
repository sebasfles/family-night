variable "name" {
  description = "Bucket name, globally unique, so callers append the account id"
  type        = string
}

variable "force_destroy" {
  description = "Allow Terraform to delete the bucket while it still holds objects"
  type        = bool
  default     = false
}

variable "versioned" {
  description = "Keep every version of every object"
  type        = bool
  default     = false
}

variable "cloudfront_distribution_arn" {
  description = "The only distribution allowed to read the bucket, through its origin access control"
  type        = string
}

variable "cloudfront_read_prefix" {
  description = "Key prefix the distribution may read; empty for the whole bucket"
  type        = string
  default     = ""
}
