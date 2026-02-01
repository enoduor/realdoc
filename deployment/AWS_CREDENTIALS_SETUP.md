# AWS Credentials Setup Guide for RealDoc

This guide explains how to set up AWS credentials for deploying RealDoc with Route 53 DNS management.

## Quick Setup

Run the automated setup script:

```bash
./deployment/setup-aws-credentials.sh
```

This will guide you through the entire process.

## Manual Setup

### Step 1: Install AWS CLI

**macOS:**
```bash
brew install awscli
```

**Linux:**
```bash
pip install awscli
# or
sudo apt-get install awscli  # Ubuntu/Debian
```

**Windows:**
Download from: https://aws.amazon.com/cli/

### Step 2: Get AWS Credentials

1. **Log in to AWS Console**: https://console.aws.amazon.com
2. **Navigate to IAM**: Services → IAM → Users
3. **Create a new user** (or select existing):
   - Click "Add users"
   - Username: `realdoc-deploy` (or your choice)
   - Access type: "Programmatic access"
4. **Attach policies** (see Required Permissions below)
5. **Create access key**:
   - After user creation, go to "Security credentials" tab
   - Click "Create access key"
   - Choose "Application running outside AWS"
   - **Save the Access Key ID and Secret Access Key** (you won't see it again!)

### Step 3: Configure AWS CLI

```bash
aws configure
```

Enter:
- **AWS Access Key ID**: Your access key ID
- **AWS Secret Access Key**: Your secret access key
- **Default region**: `us-east-1` (or your preferred region)
- **Default output format**: `json`

### Step 4: Verify Credentials

```bash
aws sts get-caller-identity
```

You should see your account ID and user ARN.

### Step 5: Test Route 53 Access

```bash
aws route53 list-hosted-zones --max-items 1
```

If this works, you have Route 53 permissions.

## Required IAM Permissions

### Minimum Required Policy

Create an IAM policy with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "ecs:*",
        "ecr:*",
        "elasticloadbalancing:*",
        "iam:CreateRole",
        "iam:AttachRolePolicy",
        "iam:PassRole",
        "iam:CreatePolicy",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "secretsmanager:CreateSecret",
        "secretsmanager:GetSecretValue",
        "secretsmanager:PutSecretValue",
        "route53:CreateHostedZone",
        "route53:GetHostedZone",
        "route53:ListHostedZones",
        "route53:ChangeResourceRecordSets",
        "route53:GetChange",
        "acm:RequestCertificate",
        "acm:DescribeCertificate",
        "acm:ListCertificates"
      ],
      "Resource": "*"
    }
  ]
}
```

### Using AWS Managed Policies (Easier)

Attach these managed policies to your IAM user:

1. **PowerUserAccess** (or **AdministratorAccess** for full access)
2. **AmazonRoute53FullAccess** (for Route 53)
3. **AWSCertificateManagerFullAccess** (for SSL certificates)

**Note**: PowerUserAccess doesn't include IAM permissions. For full deployment, you may need AdministratorAccess or create a custom policy.

## Route 53 Specific Setup

### For Route 53 DNS Management

1. **Verify domain ownership**: You must own the domain you want to use
2. **Check Route 53 access**: 
   ```bash
   aws route53 list-hosted-zones
   ```
3. **Create hosted zone** (if using new domain):
   - The Terraform script will create this automatically
   - Or create manually in AWS Console: Route 53 → Hosted zones → Create hosted zone

### Route 53 Name Servers

After deployment, Terraform will output Route 53 name servers. You need to:

1. **Get name servers**:
   ```bash
   cd deployment/terraform
   terraform output route53_name_servers
   ```

2. **Update at your domain registrar**:
   - Log in to your domain registrar (GoDaddy, Namecheap, etc.)
   - Find DNS/Nameserver settings
   - Replace existing nameservers with Route 53 nameservers
   - Wait for DNS propagation (usually 5-60 minutes, can take up to 48 hours)

## Environment Variables Alternative

Instead of `aws configure`, you can use environment variables:

```bash
export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
export AWS_DEFAULT_REGION=us-east-1
```

**Note**: These are temporary for the current shell session. For permanent setup, use `aws configure` or add to `~/.bashrc` / `~/.zshrc`.

## Troubleshooting

### "Unable to locate credentials"

**Solution**: Run `aws configure` or set environment variables.

### "Access Denied" for Route 53

**Solution**: 
1. Check IAM user has Route 53 permissions
2. Verify policy is attached to user
3. Check if you're using the correct AWS account

### "Invalid credentials"

**Solution**:
1. Verify Access Key ID and Secret Access Key are correct
2. Check if credentials are expired (rotate if needed)
3. Ensure credentials are for the correct AWS account

### "Route 53 access check failed"

**Solution**:
1. Attach `AmazonRoute53FullAccess` policy to your IAM user
2. Or add Route 53 permissions to your custom policy
3. Verify with: `aws route53 list-hosted-zones`

## Security Best Practices

1. **Never commit credentials** to git
2. **Use IAM roles** when possible (for EC2/ECS)
3. **Rotate access keys** regularly (every 90 days)
4. **Use least privilege** - only grant necessary permissions
5. **Enable MFA** for AWS Console access
6. **Use separate IAM users** for different projects
7. **Monitor access** with CloudTrail

## Next Steps

After setting up credentials:

1. **Verify setup**:
   ```bash
   ./deployment/setup-aws-credentials.sh
   ```

2. **Deploy infrastructure**:
   ```bash
   ./deploy-aws.sh
   ```

3. **Check Route 53**:
   ```bash
   aws route53 list-hosted-zones
   ```

## Support

If you encounter issues:

1. Check AWS credentials: `aws sts get-caller-identity`
2. Verify Route 53 access: `aws route53 list-hosted-zones`
3. Check IAM permissions in AWS Console
4. Review CloudTrail logs for denied actions
