#!/bin/bash

set -e

# Configuration
RESOURCE_GROUP="rg-11hour-insights"
LOCATION="koreacentral"
POSTGRES_SERVER="11hour-postgres"
POSTGRES_ADMIN_USER="postgresadmin"
POSTGRES_ADMIN_PASSWORD=$(az postgres flexible-server show --name $POSTGRES_SERVER --resource-group $RESOURCE_GROUP --query administratorLogin -o tsv 2>/dev/null || echo "")
ACR_NAME="11houracr"
APP_SERVICE_PLAN="11hour-plan"
BACKEND_APP_NAME="11hour-backend"
FRONTEND_APP_NAME="11hour-frontend"
SKU="B1"

echo "=== Azure 리소스 생성 계속 진행 ==="

# Get existing PostgreSQL password or generate new one
if [ -z "$POSTGRES_ADMIN_PASSWORD" ]; then
  echo "PostgreSQL 비밀번호를 입력하세요:"
  read -s POSTGRES_ADMIN_PASSWORD
fi

# Check if database exists, create if not
DB_EXISTS=$(az postgres flexible-server db show --resource-group $RESOURCE_GROUP --server-name $POSTGRES_SERVER --database-name db11hourinsights -o tsv 2>&1 || echo "not found")
if [[ "$DB_EXISTS" == *"not found"* ]]; then
  echo "데이터베이스 생성 중..."
  az postgres flexible-server db create \
    --resource-group $RESOURCE_GROUP \
    --server-name $POSTGRES_SERVER \
    --database-name db11hourinsights \
    --output none
else
  echo "데이터베이스가 이미 존재합니다."
fi

# Get PostgreSQL connection info
POSTGRES_HOST="$POSTGRES_SERVER.postgres.database.azure.com"

# Create Azure Container Registry if not exists
ACR_EXISTS=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP -o tsv 2>&1 || echo "not found")
if [[ "$ACR_EXISTS" == *"not found"* ]]; then
  echo "Container Registry 생성 중: $ACR_NAME"
  az acr create \
    --resource-group $RESOURCE_GROUP \
    --name $ACR_NAME \
    --sku Basic \
    --admin-enabled true \
    --output none
else
  echo "Container Registry가 이미 존재합니다."
fi

# Get ACR login server
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)

# Create App Service Plan if not exists
PLAN_EXISTS=$(az appservice plan show --name $APP_SERVICE_PLAN --resource-group $RESOURCE_GROUP -o tsv 2>&1 || echo "not found")
if [[ "$PLAN_EXISTS" == *"not found"* ]]; then
  echo "App Service Plan 생성 중: $APP_SERVICE_PLAN"
  az appservice plan create \
    --name $APP_SERVICE_PLAN \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --is-linux \
    --sku $SKU \
    --output none
else
  echo "App Service Plan이 이미 존재합니다."
fi

# Create Backend App Service if not exists
BACKEND_EXISTS=$(az webapp show --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP -o tsv 2>&1 || echo "not found")
if [[ "$BACKEND_EXISTS" == *"not found"* ]]; then
  echo "백엔드 App Service 생성 중: $BACKEND_APP_NAME"
  az webapp create \
    --name $BACKEND_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --plan $APP_SERVICE_PLAN \
    --deployment-container-image-name "$ACR_LOGIN_SERVER/backend:latest" \
    --output none
else
  echo "백엔드 App Service가 이미 존재합니다."
fi

# Configure Backend App Service
echo "백엔드 App Service 설정 중..."
az webapp config appsettings set \
  --name $BACKEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    NODE_ENV=production \
    PORT=3001 \
    DB_HOST=$POSTGRES_HOST \
    DB_PORT=5432 \
    DB_NAME=db11hourinsights \
    DB_USER=$POSTGRES_ADMIN_USER \
    DB_PASSWORD=$POSTGRES_ADMIN_PASSWORD \
    JWT_SECRET=$(openssl rand -base64 32) \
    JWT_EXPIRES_IN=7d \
    UPLOAD_DIR=/home/site/wwwroot/uploads \
    IMAGES_DIR=/home/site/wwwroot/images \
  --output none

az webapp config set \
  --name $BACKEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --linux-fx-version "DOCKER|$ACR_LOGIN_SERVER/backend:latest" \
  --always-on true \
  --output none

# Enable managed identity for ACR access
az webapp identity assign \
  --name $BACKEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --output none 2>/dev/null || echo "Managed identity already assigned"

PRINCIPAL_ID=$(az webapp identity show --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP --query principalId -o tsv)
ACR_ID=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query id -o tsv)

az role assignment create \
  --assignee $PRINCIPAL_ID \
  --scope $ACR_ID \
  --role AcrPull \
  --output none 2>/dev/null || echo "Role assignment already exists"

# Create Frontend App Service if not exists
FRONTEND_EXISTS=$(az webapp show --name $FRONTEND_APP_NAME --resource-group $RESOURCE_GROUP -o tsv 2>&1 || echo "not found")
if [[ "$FRONTEND_EXISTS" == *"not found"* ]]; then
  echo "프론트엔드 App Service 생성 중: $FRONTEND_APP_NAME"
  az webapp create \
    --name $FRONTEND_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --plan $APP_SERVICE_PLAN \
    --deployment-container-image-name "$ACR_LOGIN_SERVER/frontend:latest" \
    --output none
else
  echo "프론트엔드 App Service가 이미 존재합니다."
fi

# Configure Frontend App Service
echo "프론트엔드 App Service 설정 중..."
BACKEND_URL="https://$BACKEND_APP_NAME.azurewebsites.net"
az webapp config appsettings set \
  --name $FRONTEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    VITE_API_BASE_URL=$BACKEND_URL/api \
  --output none

az webapp config set \
  --name $FRONTEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --linux-fx-version "DOCKER|$ACR_LOGIN_SERVER/frontend:latest" \
  --always-on true \
  --output none

# Enable managed identity for ACR access
az webapp identity assign \
  --name $FRONTEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --output none 2>/dev/null || echo "Managed identity already assigned"

PRINCIPAL_ID=$(az webapp identity show --name $FRONTEND_APP_NAME --resource-group $RESOURCE_GROUP --query principalId -o tsv)

az role assignment create \
  --assignee $PRINCIPAL_ID \
  --scope $ACR_ID \
  --role AcrPull \
  --output none 2>/dev/null || echo "Role assignment already exists"

echo ""
echo "=== Azure 리소스 생성 완료 ==="
echo ""
echo "리소스 그룹: $RESOURCE_GROUP"
echo "PostgreSQL 서버: $POSTGRES_HOST"
echo "PostgreSQL 관리자: $POSTGRES_ADMIN_USER"
echo "ACR 로그인 서버: $ACR_LOGIN_SERVER"
echo "백엔드 URL: https://$BACKEND_APP_NAME.azurewebsites.net"
echo "프론트엔드 URL: https://$FRONTEND_APP_NAME.azurewebsites.net"
echo ""
echo "다음 단계:"
echo "1. Docker 이미지 빌드 및 푸시: ./scripts/build-and-push.sh"
echo "2. 배포: ./scripts/deploy-backend.sh 및 ./scripts/deploy-frontend.sh"
echo ""

