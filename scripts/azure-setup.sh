#!/bin/bash

set -e

# Configuration
RESOURCE_GROUP="rg-11hour-insights"
LOCATION="koreacentral"
POSTGRES_SERVER="11hour-postgres"
POSTGRES_ADMIN_USER="postgresadmin"
POSTGRES_ADMIN_PASSWORD=$(openssl rand -base64 32)
ACR_NAME="11houracr"
APP_SERVICE_PLAN="11hour-plan"
BACKEND_APP_NAME="11hour-backend"
FRONTEND_APP_NAME="11hour-frontend"
SKU="B1"

echo "=== Azure 리소스 생성 시작 ==="

# Login check
echo "Azure 로그인 확인 중..."
az account show > /dev/null 2>&1 || az login

# Set subscription
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "사용 중인 구독: $SUBSCRIPTION_ID"

# Create resource group
echo "리소스 그룹 생성 중: $RESOURCE_GROUP"
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION \
  --output none

# Create PostgreSQL server
echo "PostgreSQL 서버 생성 중: $POSTGRES_SERVER"
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $POSTGRES_SERVER \
  --location $LOCATION \
  --admin-user $POSTGRES_ADMIN_USER \
  --admin-password $POSTGRES_ADMIN_PASSWORD \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 14 \
  --storage-size 32 \
  --public-access 0.0.0.0 \
  --output none

# Configure PostgreSQL firewall (allow Azure services)
echo "PostgreSQL 방화벽 규칙 설정 중..."
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name $POSTGRES_SERVER \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0 \
  --output none

# Create database
echo "데이터베이스 생성 중..."
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $POSTGRES_SERVER \
  --database-name db11hourinsights \
  --output none

# Get PostgreSQL connection string
POSTGRES_HOST="$POSTGRES_SERVER.postgres.database.azure.com"
POSTGRES_CONNECTION_STRING="postgresql://$POSTGRES_ADMIN_USER:$POSTGRES_ADMIN_PASSWORD@$POSTGRES_HOST:5432/db11hourinsights?sslmode=require"

# Create Azure Container Registry
echo "Container Registry 생성 중: $ACR_NAME"
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true \
  --output none

# Get ACR login server
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)

# Create App Service Plan
echo "App Service Plan 생성 중: $APP_SERVICE_PLAN"
az appservice plan create \
  --name $APP_SERVICE_PLAN \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --is-linux \
  --sku $SKU \
  --output none

# Create Backend App Service
echo "백엔드 App Service 생성 중: $BACKEND_APP_NAME"
az webapp create \
  --name $BACKEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --deployment-container-image-name "$ACR_LOGIN_SERVER/backend:latest" \
  --output none

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
  --output none

PRINCIPAL_ID=$(az webapp identity show --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP --query principalId -o tsv)
ACR_ID=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query id -o tsv)

az role assignment create \
  --assignee $PRINCIPAL_ID \
  --scope $ACR_ID \
  --role AcrPull \
  --output none

# Create Frontend App Service
echo "프론트엔드 App Service 생성 중: $FRONTEND_APP_NAME"
az webapp create \
  --name $FRONTEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --deployment-container-image-name "$ACR_LOGIN_SERVER/frontend:latest" \
  --output none

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
  --output none

PRINCIPAL_ID=$(az webapp identity show --name $FRONTEND_APP_NAME --resource-group $RESOURCE_GROUP --query principalId -o tsv)

az role assignment create \
  --assignee $PRINCIPAL_ID \
  --scope $ACR_ID \
  --role AcrPull \
  --output none

echo ""
echo "=== Azure 리소스 생성 완료 ==="
echo ""
echo "리소스 그룹: $RESOURCE_GROUP"
echo "PostgreSQL 서버: $POSTGRES_HOST"
echo "PostgreSQL 관리자: $POSTGRES_ADMIN_USER"
echo "PostgreSQL 비밀번호: $POSTGRES_ADMIN_PASSWORD"
echo "ACR 로그인 서버: $ACR_LOGIN_SERVER"
echo "백엔드 URL: https://$BACKEND_APP_NAME.azurewebsites.net"
echo "프론트엔드 URL: https://$FRONTEND_APP_NAME.azurewebsites.net"
echo ""
echo "다음 단계:"
echo "1. Docker 이미지 빌드 및 푸시: ./scripts/build-and-push.sh"
echo "2. 배포: ./scripts/deploy-backend.sh 및 ./scripts/deploy-frontend.sh"
echo ""

