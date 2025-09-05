#!/bin/bash
set -e

REGION=us-west-2
ALB_NAME=videograb-alb

CERT_COMBINED=$(aws acm request-certificate \
  --region "$REGION" \
  --domain-name reelpostly.com \
  --subject-alternative-names www.reelpostly.com bigvideograb.com www.bigvideograb.com \
  --validation-method DNS \
  --query CertificateArn --output text)
echo "CERT_COMBINED=$CERT_COMBINED"

sleep 10

aws acm describe-certificate \
  --region "$REGION" \
  --certificate-arn "$CERT_COMBINED" \
  --query 'Certificate.DomainValidationOptions[].{Domain:DomainName,Name:ResourceRecord.Name,Value:ResourceRecord.Value}' \
  --output text > /tmp/acm_dns.txt

HZ_BIG=$(aws route53 list-hosted-zones-by-name --dns-name bigvideograb.com --query 'HostedZones[0].Id' --output text)
HZ_REEL=$(aws route53 list-hosted-zones-by-name --dns-name reelpostly.com   --query 'HostedZones[0].Id' --output text)

if [ "$HZ_BIG" = "None" ] || [ -z "$HZ_BIG" ]; then echo "No hosted zone for bigvideograb.com"; exit 1; fi
if [ "$HZ_REEL" = "None" ] || [ -z "$HZ_REEL" ]; then echo "No hosted zone for reelpostly.com"; exit 1; fi

while read -r DOMAIN RR_NAME RR_VALUE; do
  if [[ "$DOMAIN" == *bigvideograb.com ]]; then
    ZID="$HZ_BIG"
  elif [[ "$DOMAIN" == *reelpostly.com ]]; then
    ZID="$HZ_REEL"
  else
    echo "Skip $DOMAIN (no matching hosted zone)"; continue
  fi

  cat > /tmp/r53-change.json <<JSON
{
  "Comment": "ACM DNS validation for $DOMAIN",
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "$RR_NAME",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "$RR_VALUE"}]
    }
  }]
}
JSON

  aws route53 change-resource-record-sets \
    --hosted-zone-id "$ZID" \
    --change-batch file:///tmp/r53-change.json \
    --region "$REGION" >/dev/null
  echo "UPSERT $DOMAIN : $RR_NAME -> $RR_VALUE"
done < /tmp/acm_dns.txt

echo "Waiting for ACM validation..."
aws acm wait certificate-validated --region "$REGION" --certificate-arn "$CERT_COMBINED"
echo "ACM cert ISSUED: $CERT_COMBINED"

ALB_ARN=$(aws elbv2 describe-load-balancers --names "$ALB_NAME" --region "$REGION" --query 'LoadBalancers[0].LoadBalancerArn' --output text)
L443=$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --region "$REGION" --query 'Listeners[?Port==`443`].ListenerArn' --output text)

aws elbv2 add-listener-certificates --listener-arn "$L443" --region "$REGION" --certificates CertificateArn="$CERT_COMBINED"

aws elbv2 describe-listener-certificates --listener-arn "$L443" --region "$REGION" --query 'Certificates[].CertificateArn' --output table