#!/bin/bash

set -e

# Configuration
RESOURCE_GROUP="rg-11hour-insights"
ACR_NAME="11houracr"
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)

echo "=== Docker 이미지 빌드 및 푸시 시작 ==="

# Login to ACR
echo "ACR 로그인 중..."
az acr login --name $ACR_NAME

# Build and push backend
echo "백엔드 이미지 빌드 중..."
cd backend
docker build -t $ACR_LOGIN_SERVER/backend:latest .
docker tag $ACR_LOGIN_SERVER/backend:latest $ACR_LOGIN_SERVER/backend:$(date +%Y%m%d-%H%M%S)
echo "백엔드 이미지 푸시 중..."
docker push $ACR_LOGIN_SERVER/backend:latest
cd ..

# Build and push frontend
echo "프론트엔드 이미지 빌드 중..."
cd frontend
docker build -t $ACR_LOGIN_SERVER/frontend:latest .
docker tag $ACR_LOGIN_SERVER/frontend:latest $ACR_LOGIN_SERVER/frontend:$(date +%Y%m%d-%H%M%S)
echo "프론트엔드 이미지 푸시 중..."
docker push $ACR_LOGIN_SERVER/frontend:latest
cd ..

echo ""
echo "=== Docker 이미지 빌드 및 푸시 완료 ==="
echo "백엔드 이미지: $ACR_LOGIN_SERVER/backend:latest"
echo "프론트엔드 이미지: $ACR_LOGIN_SERVER/frontend:latest"

