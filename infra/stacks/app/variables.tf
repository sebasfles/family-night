variable "project" {
  description = "Project slug, the first segment of every resource name"
  type        = string
}

variable "env" {
  description = "Environment slug, the second segment of every resource name"
  type        = string
}

variable "aws_region" {
  description = "Region every regional resource lives in"
  type        = string
}

variable "domain" {
  description = "Public domain of the app"
  type        = string
}

variable "hosted_zone" {
  description = "Existing Route 53 zone that answers for the domain"
  type        = string
}

variable "github_owner" {
  description = "Owner of the repository whose workflows deploy the app"
  type        = string
}

variable "github_repository" {
  description = "Repository whose workflows deploy the app, the name alone"
  type        = string
}

variable "git_branch" {
  description = "The only branch whose workflows may assume the deploy role, and the protected one"
  type        = string
}

variable "required_checks" {
  description = "Status checks a pull request must pass before it merges into the branch"
  type        = list(string)
}
