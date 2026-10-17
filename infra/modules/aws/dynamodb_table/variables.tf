variable "name" {
  description = "Table name"
  type        = string
}

variable "hash_key" {
  description = "Partition key attribute name"
  type        = string
}

variable "range_key" {
  description = "Sort key attribute name. Null makes a table keyed by the partition key alone."
  type        = string
  default     = null
}

variable "attributes" {
  description = "Every key attribute of the table, keyed by name, with its DynamoDB type (S, N or B)"
  type        = map(string)
}

variable "point_in_time_recovery" {
  description = "Keep continuous backups for the last 35 days"
  type        = bool
  default     = true
}

variable "deletion_protection" {
  description = "Refuse to delete the table until this is turned off"
  type        = bool
  default     = true
}

variable "ttl_attribute" {
  description = "Number attribute holding the epoch second an item expires at. Null keeps items forever."
  type        = string
  default     = null
}
