variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-west-2"  # Oregon
}

variable "project_name" {
  description = "Project name (used for resource naming)"
  type        = string
  default     = "realdoc"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "realdoc.com"
}

variable "additional_domains" {
  description = "Additional domain names for SSL certificate"
  type        = list(string)
  default     = []
}

variable "enable_https" {
  description = "Enable HTTPS with ACM certificate"
  type        = bool
  default     = true
}

variable "create_route53_zone" {
  description = "Create Route 53 hosted zone"
  type        = bool
  default     = true
}

variable "frontend_cpu" {
  description = "CPU units for frontend task (1024 = 1 vCPU)"
  type        = number
  default     = 256
}

variable "frontend_memory" {
  description = "Memory for frontend task (MB)"
  type        = number
  default     = 512
}

variable "node_backend_cpu" {
  description = "CPU units for Node.js backend task"
  type        = number
  default     = 512
}

variable "node_backend_memory" {
  description = "Memory for Node.js backend task (MB)"
  type        = number
  default     = 1024
}

variable "python_backend_cpu" {
  description = "CPU units for Python backend task"
  type        = number
  default     = 512
}

variable "python_backend_memory" {
  description = "Memory for Python backend task (MB)"
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Desired number of tasks for each service"
  type        = number
  default     = 1
}

variable "min_capacity" {
  description = "Minimum number of tasks (for autoscaling)"
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum number of tasks (for autoscaling)"
  type        = number
  default     = 10
}
