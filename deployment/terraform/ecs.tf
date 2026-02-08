# ECS Task Definitions
resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.project_name}-frontend"
  network_mode             = "awsvpc"
  requires_compatibilities  = ["FARGATE"]
  cpu                      = var.frontend_cpu
  memory                   = var.frontend_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "frontend"
      image = "${aws_ecr_repository.frontend.repository_url}:latest"
      
      portMappings = [
        {
          containerPort = 80
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "REACT_APP_AI_API"
          value = "https://app.reelpostly.com/ai"
        },
        {
          name  = "REACT_APP_API_URL"
          value = "https://app.reelpostly.com/api"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.frontend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-frontend-task"
  }
}

resource "aws_ecs_task_definition" "node_backend" {
  family                   = "${var.project_name}-node-backend"
  network_mode             = "awsvpc"
  requires_compatibilities  = ["FARGATE"]
  cpu                      = var.node_backend_cpu
  memory                   = var.node_backend_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "node-backend"
      image = "${aws_ecr_repository.node_backend.repository_url}:latest"
      
      portMappings = [
        {
          containerPort = 4001
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "PORT"
          value = "4001"
        }
      ]

      secrets = [
        {
          name      = "MONGODB_URI"
          valueFrom = aws_secretsmanager_secret.mongodb_uri.arn
        },
        {
          name      = "CLERK_SECRET_KEY"
          valueFrom = aws_secretsmanager_secret.clerk_secret_key.arn
        },
        {
          name      = "CLERK_PUBLISHABLE_KEY"
          valueFrom = aws_secretsmanager_secret.clerk_publishable_key.arn
        },
        {
          name      = "STRIPE_SECRET_KEY"
          valueFrom = aws_secretsmanager_secret.stripe_secret_key.arn
        },
        {
          name      = "STRIPE_CREATOR_MONTHLY_PRICE_ID"
          valueFrom = aws_secretsmanager_secret.stripe_creator_monthly_price_id.arn
        },
        {
          name      = "STRIPE_CREATOR_YEARLY_PRICE_ID"
          valueFrom = aws_secretsmanager_secret.stripe_creator_yearly_price_id.arn
        },
        {
          name      = "STRIPE_SEO_REPORT_PRICE_ID"
          valueFrom = aws_secretsmanager_secret.stripe_seo_report_price_id.arn
        },
        {
          name      = "STRIPE_WEBHOOK_SECRET"
          valueFrom = "arn:aws:secretsmanager:us-west-2:657053005765:secret:realdoc/stripe-webhook-secret-thbKFS"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.node_backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:4001/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-node-backend-task"
  }
}

resource "aws_ecs_task_definition" "python_backend" {
  family                   = "${var.project_name}-python-backend"
  network_mode             = "awsvpc"
  requires_compatibilities  = ["FARGATE"]
  cpu                      = var.python_backend_cpu
  memory                   = var.python_backend_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "python-backend"
      image = "${aws_ecr_repository.python_backend.repository_url}:latest"
      
      portMappings = [
        {
          containerPort = 5001
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "PORT"
          value = "5001"
        },
        {
          name  = "AI_ROOT_PATH"
          value = "/ai"
        },
        {
          name  = "ENVIRONMENT"
          value = "production"
        },
        {
          name  = "FRONTEND_ORIGIN"
          value = "https://${var.domain_name}"
        }
      ]

      secrets = [
        {
          name      = "OPENAI_API_KEY"
          valueFrom = aws_secretsmanager_secret.openai_api_key.arn
        },
        {
          name      = "SIMILARWEB_API_KEY"
          valueFrom = aws_secretsmanager_secret.similarweb_api_key.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.python_backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:5001/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-python-backend-task"
  }
}

# ECS Services
resource "aws_ecs_service" "frontend" {
  name            = "${var.project_name}-frontend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 80
  }

  depends_on = [
    aws_iam_role_policy_attachment.ecs_task_execution
  ]

  tags = {
    Name = "${var.project_name}-frontend-service"
  }
}

resource "aws_ecs_service" "node_backend" {
  name            = "${var.project_name}-node-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.node_backend.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.node_backend.arn
    container_name   = "node-backend"
    container_port   = 4001
  }

  depends_on = [
    aws_iam_role_policy_attachment.ecs_task_execution
  ]

  tags = {
    Name = "${var.project_name}-node-backend-service"
  }
}

resource "aws_ecs_service" "python_backend" {
  name            = "${var.project_name}-python-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.python_backend.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.python_backend.arn
    container_name   = "python-backend"
    container_port   = 5001
  }

  depends_on = [
    aws_iam_role_policy_attachment.ecs_task_execution
  ]

  tags = {
    Name = "${var.project_name}-python-backend-service"
  }
}

# Secrets Manager Secrets
resource "aws_secretsmanager_secret" "mongodb_uri" {
  name = "${var.project_name}/mongodb-uri"
  
  tags = {
    Name = "${var.project_name}-mongodb-uri-secret"
  }
}

resource "aws_secretsmanager_secret" "clerk_secret_key" {
  name = "${var.project_name}/clerk-secret-key"
  
  tags = {
    Name = "${var.project_name}-clerk-secret-key-secret"
  }
}

resource "aws_secretsmanager_secret" "clerk_publishable_key" {
  name = "${var.project_name}/clerk-publishable-key"
  
  tags = {
    Name = "${var.project_name}-clerk-publishable-key-secret"
  }
}

resource "aws_secretsmanager_secret" "stripe_secret_key" {
  name = "${var.project_name}/stripe-secret-key"
  
  tags = {
    Name = "${var.project_name}-stripe-secret-key-secret"
  }
}

resource "aws_secretsmanager_secret" "openai_api_key" {
  name = "${var.project_name}/openai-api-key"
  
  tags = {
    Name = "${var.project_name}-openai-api-key-secret"
  }
}

resource "aws_secretsmanager_secret" "similarweb_api_key" {
  name = "${var.project_name}/similarweb-api-key"
  
  tags = {
    Name = "${var.project_name}-similarweb-api-key-secret"
  }
}

resource "aws_secretsmanager_secret" "stripe_creator_monthly_price_id" {
  name = "${var.project_name}/stripe-creator-monthly-price-id"
  
  tags = {
    Name = "${var.project_name}-stripe-creator-monthly-price-id-secret"
  }
}

resource "aws_secretsmanager_secret" "stripe_creator_yearly_price_id" {
  name = "${var.project_name}/stripe-creator-yearly-price-id"
  
  tags = {
    Name = "${var.project_name}-stripe-creator-yearly-price-id-secret"
  }
}

resource "aws_secretsmanager_secret" "stripe_seo_report_price_id" {
  name = "${var.project_name}/stripe-seo-report-price-id"
  
  tags = {
    Name = "${var.project_name}-stripe-seo-report-price-id-secret"
  }
}


# IAM Policy for Secrets Manager access
resource "aws_iam_role_policy" "ecs_task_secrets" {
  name = "${var.project_name}-ecs-task-secrets-policy"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.mongodb_uri.arn,
          aws_secretsmanager_secret.clerk_secret_key.arn,
          aws_secretsmanager_secret.clerk_publishable_key.arn,
          aws_secretsmanager_secret.stripe_secret_key.arn,
          aws_secretsmanager_secret.openai_api_key.arn,
          aws_secretsmanager_secret.similarweb_api_key.arn,
          aws_secretsmanager_secret.stripe_creator_monthly_price_id.arn,
          aws_secretsmanager_secret.stripe_creator_yearly_price_id.arn,
          aws_secretsmanager_secret.stripe_seo_report_price_id.arn,
          "arn:aws:secretsmanager:us-west-2:657053005765:secret:realdoc/stripe-webhook-secret-thbKFS"
        ]
      }
    ]
  })
}
