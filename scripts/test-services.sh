#!/bin/bash

set -e

BACKEND_APP_NAME="11hour-backend"
FRONTEND_APP_NAME="11hour-frontend"
RESOURCE_GROUP="rg-11hour-insights"

echo "=== 서비스 테스트 시작 ==="

# Get URLs
BACKEND_URL="https://$BACKEND_APP_NAME.azurewebsites.net"
FRONTEND_URL="https://$FRONTEND_APP_NAME.azurewebsites.net"

echo "백엔드 Health Check..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $BACKEND_URL/health || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ 백엔드 서비스 정상"
else
  echo "✗ 백엔드 서비스 오류 (HTTP $HTTP_CODE)"
fi

echo "프론트엔드 Health Check..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $FRONTEND_URL || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ 프론트엔드 서비스 정상"
else
  echo "✗ 프론트엔드 서비스 오류 (HTTP $HTTP_CODE)"
fi

echo ""
echo "백엔드 로그 확인:"
echo "az webapp log tail --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP"
echo ""
echo "프론트엔드 로그 확인:"
echo "az webapp log tail --name $FRONTEND_APP_NAME --resource-group $RESOURCE_GROUP"

