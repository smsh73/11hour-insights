#!/bin/bash

set -e

echo "=== GitHub Actions 설정 스크립트 ==="
echo ""
echo "이 스크립트는 Azure 서비스 주체를 생성하고 GitHub Secrets에 추가하는 방법을 안내합니다."
echo ""

# Azure 서비스 주체 생성
echo "1. Azure 서비스 주체 생성 중..."
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
RESOURCE_GROUP="rg-11hour-insights"
ACR_NAME="11houracr"

SP_NAME="github-actions-11hour"
SP_PASSWORD=$(az ad sp create-for-rbac \
  --name $SP_NAME \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP \
  --query password -o tsv)

SP_APP_ID=$(az ad sp list --display-name $SP_NAME --query "[0].appId" -o tsv)

# ACR에 대한 권한 추가
echo "2. ACR 권한 추가 중..."
ACR_ID=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query id -o tsv)
az role assignment create \
  --assignee $SP_APP_ID \
  --scope $ACR_ID \
  --role AcrPush \
  --output none

echo ""
echo "=== Azure 서비스 주체 생성 완료 ==="
echo ""
echo "다음 JSON을 GitHub Secrets에 'AZURE_CREDENTIALS'로 추가하세요:"
echo ""
cat <<EOF
{
  "clientId": "$SP_APP_ID",
  "clientSecret": "$SP_PASSWORD",
  "subscriptionId": "$SUBSCRIPTION_ID",
  "tenantId": "$(az account show --query tenantId -o tsv)"
}
EOF
echo ""
echo "GitHub 저장소 설정 방법:"
echo "1. https://github.com/smsh73/11hour-insights/settings/secrets/actions 로 이동"
echo "2. 'New repository secret' 클릭"
echo "3. Name: AZURE_CREDENTIALS"
echo "4. Value: 위의 JSON 전체를 복사하여 붙여넣기"
echo "5. 'Add secret' 클릭"
echo ""

