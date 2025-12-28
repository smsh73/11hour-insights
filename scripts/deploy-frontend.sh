#!/bin/bash

set -e

RESOURCE_GROUP="rg-11hour-insights"
FRONTEND_APP_NAME="11hour-frontend"
ACR_NAME="11houracr"
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)

echo "=== 프론트엔드 배포 시작 ==="

# Restart app service to pull new image
echo "프론트엔드 App Service 재시작 중..."
az webapp restart \
  --name $FRONTEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --output none

echo "배포 완료. 잠시 후 서비스가 시작됩니다."
echo "프론트엔드 URL: https://$FRONTEND_APP_NAME.azurewebsites.net"
echo ""
echo "로그 확인:"
echo "az webapp log tail --name $FRONTEND_APP_NAME --resource-group $RESOURCE_GROUP"

