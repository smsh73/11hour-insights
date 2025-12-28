# Azure 배포 가이드

## 현재 상태

### 생성된 Azure 리소스
- ✅ 리소스 그룹: `rg-11hour-insights`
- ✅ PostgreSQL 서버: `11hour-postgres.postgres.database.azure.com`
- ✅ 데이터베이스: `db11hourinsights`
- ✅ Azure Container Registry: `11houracr.azurecr.io`
- ✅ App Service Plan: `11hour-plan`
- ✅ 백엔드 App Service: `11hour-backend.azurewebsites.net`
- ✅ 프론트엔드 App Service: `11hour-frontend.azurewebsites.net`

### 환경 변수 설정 완료
- ✅ 백엔드 환경 변수 설정 완료
- ✅ 프론트엔드 환경 변수 설정 완료

## 다음 단계

### 1. PostgreSQL 비밀번호 설정

PostgreSQL 비밀번호가 필요합니다. 다음 명령어로 비밀번호를 설정하세요:

```bash
az postgres flexible-server update \
  --name 11hour-postgres \
  --resource-group rg-11hour-insights \
  --admin-password <새_비밀번호>
```

그 다음 백엔드 App Service의 환경 변수에 비밀번호를 업데이트하세요:

```bash
az webapp config appsettings set \
  --name 11hour-backend \
  --resource-group rg-11hour-insights \
  --settings DB_PASSWORD=<새_비밀번호>
```

### 2. Docker 이미지 빌드 및 푸시

Docker가 설치되어 있고 실행 중이어야 합니다.

```bash
# ACR 로그인
az acr login --name 11houracr

# 백엔드 이미지 빌드 및 푸시
cd backend
docker build -t 11houracr.azurecr.io/backend:latest .
docker push 11houracr.azurecr.io/backend:latest
cd ..

# 프론트엔드 이미지 빌드 및 푸시
cd frontend
docker build -t 11houracr.azurecr.io/frontend:latest .
docker push 11houracr.azurecr.io/frontend:latest
cd ..
```

또는 스크립트 사용:

```bash
./scripts/build-and-push.sh
```

### 3. App Service 배포

```bash
# 백엔드 배포
az webapp restart --name 11hour-backend --resource-group rg-11hour-insights

# 프론트엔드 배포
az webapp restart --name 11hour-frontend --resource-group rg-11hour-insights
```

또는 스크립트 사용:

```bash
./scripts/deploy-backend.sh
./scripts/deploy-frontend.sh
```

### 4. 데이터베이스 초기화

배포 후 백엔드가 시작되면 자동으로 데이터베이스가 초기화됩니다. 

초기 관리자 계정을 생성하려면:

```bash
curl -X POST https://11hour-backend.azurewebsites.net/api/auth/init-admin \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-secure-password"}'
```

### 5. 2025년 호수 초기화

관리자로 로그인한 후:

```bash
curl -X POST https://11hour-backend.azurewebsites.net/api/admin/init-2025 \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

## 서비스 URL

- 백엔드: https://11hour-backend.azurewebsites.net
- 프론트엔드: https://11hour-frontend.azurewebsites.net
- Health Check: https://11hour-backend.azurewebsites.net/health

## 로그 확인

```bash
# 백엔드 로그
az webapp log tail --name 11hour-backend --resource-group rg-11hour-insights

# 프론트엔드 로그
az webapp log tail --name 11hour-frontend --resource-group rg-11hour-insights
```

## 문제 해결

### Docker가 설치되지 않은 경우

macOS:
```bash
brew install --cask docker
```

또는 Docker Desktop을 다운로드하여 설치하세요.

### 이미지 빌드 실패

로컬에서 먼저 테스트:
```bash
cd backend
docker build -t backend-test .
docker run -p 3001:3001 backend-test
```

### 데이터베이스 연결 실패

1. PostgreSQL 방화벽 규칙 확인
2. 연결 문자열 확인
3. 비밀번호 확인

### App Service가 시작되지 않는 경우

1. 로그 확인
2. 환경 변수 확인
3. 이미지가 ACR에 푸시되었는지 확인

