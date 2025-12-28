# GitHub 및 Azure 클라우드 빌드 설정 가이드

## 1. GitHub 저장소 확인

저장소: https://github.com/smsh73/11hour-insights

## 2. Azure 서비스 주체 생성 및 GitHub Secrets 설정

### 방법 1: 스크립트 사용

```bash
./scripts/setup-github-actions.sh
```

스크립트가 생성한 JSON을 GitHub Secrets에 추가하세요.
**주의**: 생성된 JSON에는 민감한 정보가 포함되어 있으므로 공유하지 마세요.

### 방법 2: 수동 설정

1. Azure 서비스 주체 생성:
```bash
az ad sp create-for-rbac \
  --name github-actions-11hour \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/rg-11hour-insights
```

2. ACR 권한 추가:
```bash
ACR_ID=$(az acr show --name 11houracr --resource-group rg-11hour-insights --query id -o tsv)
SP_APP_ID=$(az ad sp list --display-name github-actions-11hour --query "[0].appId" -o tsv)
az role assignment create \
  --assignee $SP_APP_ID \
  --scope $ACR_ID \
  --role AcrPush
```

3. GitHub Secrets 추가:
   - https://github.com/smsh73/11hour-insights/settings/secrets/actions
   - New repository secret
   - Name: `AZURE_CREDENTIALS`
   - Value: 서비스 주체 JSON (clientId, clientSecret, subscriptionId, tenantId 포함)

## 3. Azure Container Registry Task 설정

### GitHub 연동 (Personal Access Token 필요)

1. GitHub Personal Access Token 생성:
   - https://github.com/settings/tokens
   - `repo` 권한 필요

2. ACR Task 생성:
```bash
# 백엔드
az acr task create \
  --registry 11houracr \
  --name build-backend \
  --context https://github.com/smsh73/11hour-insights.git \
  --file backend/Dockerfile \
  --image backend:{{.Run.ID}} \
  --image backend:latest \
  --git-access-token <GITHUB_TOKEN>

# 프론트엔드
az acr task create \
  --registry 11houracr \
  --name build-frontend \
  --context https://github.com/smsh73/11hour-insights.git \
  --file frontend/Dockerfile \
  --image frontend:{{.Run.ID}} \
  --image frontend:latest \
  --git-access-token <GITHUB_TOKEN>
```

3. 자동 빌드 트리거 설정:
```bash
# main 브랜치에 push 시 자동 빌드
az acr task update \
  --registry 11houracr \
  --name build-backend \
  --set sourceTriggerEvents="commit"

az acr task update \
  --registry 11houracr \
  --name build-frontend \
  --set sourceTriggerEvents="commit"
```

## 4. GitHub Actions 워크플로우

`.github/workflows/azure-build.yml` 파일이 이미 생성되어 있습니다.

이 워크플로우는:
- main 브랜치에 push 시 자동 실행
- 백엔드 및 프론트엔드 이미지 빌드
- ACR에 푸시
- App Service 자동 재시작

## 5. 수동 빌드 트리거

### ACR Task로 빌드:
```bash
az acr task run --registry 11houracr --name build-backend
az acr task run --registry 11houracr --name build-frontend
```

### GitHub Actions로 빌드:
- GitHub 저장소의 Actions 탭에서 수동 실행 가능

## 6. 배포 확인

빌드 완료 후:
```bash
az webapp restart --name 11hour-backend --resource-group rg-11hour-insights
az webapp restart --name 11hour-frontend --resource-group rg-11hour-insights
```

## 문제 해결

### GitHub 토큰 오류
- Personal Access Token이 올바른 권한을 가지고 있는지 확인
- 토큰이 만료되지 않았는지 확인

### ACR Task 빌드 실패
- Dockerfile 경로 확인
- 컨텍스트 경로 확인
- 빌드 로그 확인: `az acr task logs -r 11houracr --run-id <RUN_ID>`

### GitHub Actions 실패
- AZURE_CREDENTIALS Secret이 올바르게 설정되었는지 확인
- 서비스 주체 권한 확인

