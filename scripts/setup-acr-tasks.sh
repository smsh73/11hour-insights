#!/bin/bash

set -e

echo "=== Azure ACR Task 설정 (GitHub 연동) ==="
echo ""

# GitHub Personal Access Token 입력 요청
echo "GitHub Personal Access Token이 필요합니다."
echo "토큰 생성: https://github.com/settings/tokens"
echo "필요한 권한: repo (전체 저장소 접근)"
echo ""
read -p "GitHub Personal Access Token을 입력하세요: " GITHUB_TOKEN

if [ -z "$GITHUB_TOKEN" ]; then
  echo "토큰이 입력되지 않았습니다."
  exit 1
fi

ACR_NAME="11houracr"
RESOURCE_GROUP="rg-11hour-insights"
REPO_URL="https://github.com/smsh73/11hour-insights.git"

echo ""
echo "백엔드 ACR Task 생성 중..."
az acr task create \
  --registry $ACR_NAME \
  --name build-backend \
  --context $REPO_URL \
  --file backend/Dockerfile \
  --image backend:{{.Run.ID}} \
  --image backend:latest \
  --git-access-token $GITHUB_TOKEN \
  --set sourceTriggerEvents="commit" \
  --set sourceTriggerBranchFilters="main" \
  --output none

echo "✅ 백엔드 ACR Task 생성 완료"

echo ""
echo "프론트엔드 ACR Task 생성 중..."
az acr task create \
  --registry $ACR_NAME \
  --name build-frontend \
  --context $REPO_URL \
  --file frontend/Dockerfile \
  --image frontend:{{.Run.ID}} \
  --image frontend:latest \
  --git-access-token $GITHUB_TOKEN \
  --set sourceTriggerEvents="commit" \
  --set sourceTriggerBranchFilters="main" \
  --output none

echo "✅ 프론트엔드 ACR Task 생성 완료"

echo ""
echo "=== ACR Task 설정 완료 ==="
echo ""
echo "이제 main 브랜치에 push하면 자동으로 이미지가 빌드됩니다."
echo ""
echo "ACR Task 목록:"
az acr task list --registry $ACR_NAME --output table

echo ""
echo "수동 빌드 테스트:"
echo "  az acr task run --registry $ACR_NAME --name build-backend"
echo "  az acr task run --registry $ACR_NAME --name build-frontend"

