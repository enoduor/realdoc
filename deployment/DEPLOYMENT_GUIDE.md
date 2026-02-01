# RealDoc AWS Deployment - Complete Automation Guide

## One-Command Deployment

The `deploy-aws.sh` script automates the entire deployment process:

```bash
./deploy-aws.sh
```

This single script will:
1. ✅ Check prerequisites (AWS CLI, Terraform, Docker)
2. ✅ Verify AWS credentials
3. ✅ Setup Terraform configuration
4. ✅ Create/update AWS infrastructure
5. ✅ Configure secrets in AWS Secrets Manager
6. ✅ Build Docker images
7. ✅ Push images to ECR
8. ✅ Deploy to ECS
9. ✅ Wait for services to stabilize
10. ✅ Display deployment summary

## Prerequisites

Before running the script, ensure you have:

- **AWS Account** with appropriate permissions
- **AWS CLI** installed and configured (`aws configure`)
- **Terraform** >= 1.0 installed
- **Docker** installed and running
- **Domain name** (optional, for Route 53)

## Quick Start

### 1. Configure AWS Credentials

#### Option 1: Use the Setup Script (Recommended)

```bash
./deployment/setup-aws-credentials.sh
```

This interactive script will:
- Guide you through credential setup
- Verify your credentials work
- Check Route 53 permissions
- List required IAM permissions

#### Option 2: Manual Configuration

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter default region (e.g., us-east-1)
# Enter default output format (json)
```

#### Option 3: Environment Variables

```bash
export AWS_ACCESS_KEY_ID=your-access-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-access-key
export AWS_DEFAULT_REGION=us-east-1
```

#### Required AWS Permissions for Route 53

For Route 53 DNS management, your AWS credentials need:

**Route 53:**
- `route53:CreateHostedZone`
- `route53:GetHostedZone`
- `route53:ListHostedZones`
- `route53:ChangeResourceRecordSets`
- `route53:GetChange`

**ACM (For SSL Certificates):**
- `acm:RequestCertificate`
- `acm:DescribeCertificate`
- `acm:ListCertificates`

**Other Required Permissions:**
- EC2/VPC: `ec2:*`
- ECS: `ecs:*`
- ECR: `ecr:*`
- ELB: `elasticloadbalancing:*`
- IAM: `iam:CreateRole`, `iam:AttachRolePolicy`, `iam:PassRole`
- CloudWatch: `logs:*`
- Secrets Manager: `secretsmanager:*`

**Quick Setup**: Attach `PowerUserAccess` + `AmazonRoute53FullAccess` + `AWSCertificateManagerFullAccess` policies to your IAM user.

See `deployment/AWS_CREDENTIALS_SETUP.md` for detailed instructions.

### 2. Configure Terraform Variables

```bash
cd deployment/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your settings:
# - aws_region
# - project_name
# - domain_name
# - etc.
```

### 3. Run Deployment

```bash
./deploy-aws.sh
```

The script will guide you through:
- Infrastructure creation (with confirmation)
- Secret configuration (interactive prompts)
- Image building and pushing
- Service deployment

## Environment Variables

You can customize the deployment with environment variables:

```bash
# Set custom values
export AWS_REGION=us-west-2
export PROJECT_NAME=realdoc-prod
export ENVIRONMENT=production
export IMAGE_TAG=v1.0.0

# Run deployment
./deploy-aws.sh
```

## Skipping Steps

For subsequent deployments, you can skip steps:

```bash
# Skip infrastructure (already exists)
SKIP_INFRA=yes ./deploy-aws.sh

# Skip secrets (already configured)
SKIP_SECRETS=yes ./deploy-aws.sh

# Skip build (only update services)
SKIP_BUILD=yes ./deploy-aws.sh

# Skip deployment (only build images)
SKIP_DEPLOY=yes ./deploy-aws.sh

# Quick update (only deploy, skip everything else)
SKIP_INFRA=yes SKIP_SECRETS=yes SKIP_BUILD=yes ./deploy-aws.sh
```

## What Gets Created

### Infrastructure (First Run)
- VPC with public/private subnets
- Internet Gateway and NAT Gateway
- Security Groups
- ECR Repositories (3)
- ECS Cluster
- Application Load Balancer
- Route 53 Hosted Zone (if enabled)
- IAM Roles and Policies
- CloudWatch Log Groups
- Secrets Manager Secrets

### Deployment (Every Run)
- Docker images built
- Images pushed to ECR
- ECS services updated with new images
- Services scaled to desired count

## Deployment Flow

```
┌─────────────────────────────────────────┐
│  1. Check Prerequisites                 │
│     - AWS CLI, Terraform, Docker        │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  2. Verify AWS Credentials              │
│     - Check AWS account access          │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  3. Setup Terraform                     │
│     - Initialize if needed              │
│     - Create terraform.tfvars           │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  4. Deploy Infrastructure               │
│     - Run terraform plan                │
│     - Confirm and apply                 │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  5. Configure Secrets                   │
│     - MongoDB URI                       │
│     - Clerk Secret Key                  │
│     - Stripe Secret Key                 │
│     - OpenAI API Key                    │
│     - SimilarWeb API Key (optional)       │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  6. Build Docker Images                 │
│     - Frontend                          │
│     - Node.js Backend                   │
│     - Python Backend                    │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  7. Push to ECR                         │
│     - Login to ECR                      │
│     - Push all images                   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  8. Update ECS Services                 │
│     - Force new deployment              │
│     - Wait for stabilization            │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  9. Display Summary                     │
│     - ALB DNS name                      │
│     - Route 53 info                    │
│     - Access URLs                       │
└─────────────────────────────────────────┘
```

## Troubleshooting

### Script Fails at Prerequisites
- Install missing tools (AWS CLI, Terraform, Docker)
- Verify Docker daemon is running

### AWS Credentials Error
```bash
aws configure
# Re-enter credentials
aws sts get-caller-identity  # Verify
```

### Terraform Errors
```bash
cd deployment/terraform
terraform init
terraform validate
```

### Docker Build Fails
- Check Dockerfile syntax
- Verify all dependencies are available
- Check disk space

### ECS Services Won't Start
```bash
# Check logs
aws logs tail /ecs/realdoc-frontend --follow

# Check service status
aws ecs describe-services \
  --cluster realdoc-cluster \
  --services realdoc-frontend
```

### Images Not Pushing
- Verify ECR repositories exist
- Check IAM permissions for ECR push
- Verify ECR login succeeded

## Common Use Cases

### Initial Deployment
```bash
# Full deployment from scratch
./deploy-aws.sh
```

### Update After Code Changes
```bash
# Rebuild and redeploy
./deploy-aws.sh
# Or skip infrastructure/secrets
SKIP_INFRA=yes SKIP_SECRETS=yes ./deploy-aws.sh
```

### Update Secrets Only
```bash
SKIP_INFRA=yes SKIP_BUILD=yes SKIP_DEPLOY=yes ./deploy-aws.sh
# Then manually update secrets in AWS Console or CLI
```

### Rollback to Previous Version
```bash
# Update ECS service to use previous image tag
aws ecs update-service \
  --cluster realdoc-cluster \
  --service realdoc-frontend \
  --task-definition realdoc-frontend:<previous-revision> \
  --force-new-deployment
```

## Monitoring Deployment

### Watch Service Status
```bash
watch -n 5 'aws ecs describe-services \
  --cluster realdoc-cluster \
  --services realdoc-frontend realdoc-node-backend realdoc-python-backend \
  --query "services[*].{Service:serviceName,Status:status,Running:runningCount,Desired:desiredCount}" \
  --output table'
```

### View Logs in Real-Time
```bash
# Terminal 1: Frontend logs
aws logs tail /ecs/realdoc-frontend --follow

# Terminal 2: Node.js backend logs
aws logs tail /ecs/realdoc-node-backend --follow

# Terminal 3: Python backend logs
aws logs tail /ecs/realdoc-python-backend --follow
```

## Cost Management

### Estimated Monthly Costs
- **ECS Fargate**: ~$30-50 (1 task per service)
- **ALB**: ~$16
- **NAT Gateway**: ~$32
- **Route 53**: ~$0.50
- **CloudWatch Logs**: ~$5-10
- **ECR Storage**: ~$1-2
- **Total**: ~$85-110/month

### Cost Optimization Tips
1. Use Fargate Spot for non-production
2. Set up auto-scaling to scale down during low traffic
3. Use CloudWatch alarms for cost monitoring
4. Consider Reserved Capacity for production
5. Clean up old ECR images regularly

## Security Notes

1. **Never commit secrets** - All secrets stored in AWS Secrets Manager
2. **Use HTTPS** - Enable SSL/TLS in terraform.tfvars
3. **Restrict security groups** - Only allow necessary traffic
4. **Enable CloudWatch logging** - Monitor for suspicious activity
5. **Regular updates** - Keep images and dependencies updated
6. **IAM least privilege** - Grant minimum required permissions

## Next Steps After Deployment

1. **Configure Route 53 DNS** - Update nameservers at your registrar
2. **Set up SSL Certificate** - Enable HTTPS with ACM
3. **Configure Auto-Scaling** - Set up scaling policies
4. **Set up Monitoring** - CloudWatch alarms and dashboards
5. **Configure CI/CD** - Automate deployments from Git
6. **Set up Backups** - Database and configuration backups

## Support

For issues:
1. Check CloudWatch logs
2. Review Terraform state
3. Verify ECS service events
4. Check security group rules
5. Review IAM permissions

## Cleanup

To completely remove all resources:

```bash
cd deployment/terraform
terraform destroy
```

**Warning:** This will delete ALL resources including:
- ECR images
- CloudWatch logs
- Secrets (if not protected)
- All infrastructure
