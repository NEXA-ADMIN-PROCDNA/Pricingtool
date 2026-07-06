#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Path A smoke test — launch ONE nexa-dev task on the auxo-frontend-dev cluster,
# with NO load balancer. Purpose: prove the container boots, pulls its 14 SSM
# secrets, connects to the DB, and stays alive. Not the real deployment (that's
# create-service behind the ALB) — just a fast config sanity check.
#
# USAGE:
#   1. Fill in SUBNET_ID and SG_ID below (from IT).
#   2. Set ASSIGN_PUBLIC_IP:
#        DISABLED  -> subnet is PRIVATE with a NAT gateway  (default, preferred)
#        ENABLED   -> subnet is PUBLIC (task reaches ECR/SSM via internet gateway)
#      Wrong choice => task fails with CannotPullContainerError.
#   3. Run:  bash aws/run-task-smoketest.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
export MSYS_NO_PATHCONV=1

# ── FILL THESE IN ────────────────────────────────────────────────────────────
SUBNET_ID="subnet-REPLACE_ME"
SG_ID="sg-REPLACE_ME"
ASSIGN_PUBLIC_IP="DISABLED"     # DISABLED (private+NAT) | ENABLED (public subnet)
# ─────────────────────────────────────────────────────────────────────────────

CLUSTER="auxo-frontend-dev"
TASK_DEF="nexa-dev:3"
REGION="us-east-1"

echo "Launching $TASK_DEF on $CLUSTER (subnet=$SUBNET_ID, sg=$SG_ID, publicIp=$ASSIGN_PUBLIC_IP)..."

TASK_ARN=$(aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$TASK_DEF" \
  --launch-type FARGATE \
  --count 1 \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_ID],securityGroups=[$SG_ID],assignPublicIp=$ASSIGN_PUBLIC_IP}" \
  --region "$REGION" \
  --query "tasks[0].taskArn" --output text)

if [[ -z "$TASK_ARN" || "$TASK_ARN" == "None" ]]; then
  echo "run-task returned no task ARN — check the failures output above."
  exit 1
fi

echo "Task launched: $TASK_ARN"
echo "Waiting for it to reach RUNNING (or STOPPED)..."

# Poll status every 10s, up to ~3 min
for i in $(seq 1 18); do
  sleep 10
  STATUS=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" \
    --region "$REGION" --query "tasks[0].lastStatus" --output text)
  echo "  [$((i*10))s] status: $STATUS"
  if [[ "$STATUS" == "RUNNING" || "$STATUS" == "STOPPED" ]]; then
    break
  fi
done

echo ""
echo "── Final task detail ────────────────────────────────────────────────────"
aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" --region "$REGION" \
  --query "tasks[0].{Status:lastStatus,Health:healthStatus,StoppedReason:stoppedReason,Containers:containers[].{Name:name,Status:lastStatus,Reason:reason,Exit:exitCode}}" \
  --output json

echo ""
echo "Logs (if the container started): CloudWatch group /ecs/nexa-dev"
echo "Tail them with:"
echo "  MSYS_NO_PATHCONV=1 aws logs tail /ecs/nexa-dev --follow --region $REGION"
