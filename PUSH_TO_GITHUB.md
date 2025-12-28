# GitHub에 푸시 및 Azure 클라우드 빌드 설정

## 1단계: GitHub 저장소 생성

1. https://github.com/new 접속
2. Repository name: `11hour-insights`
3. Description: `안양제일교회 열한시 신문 AI 분석 시스템`
4. Public 또는 Private 선택
5. **중요**: README, .gitignore, license는 추가하지 않기 (이미 로컬에 있음)
6. "Create repository" 클릭

## 2단계: 코드 푸시

저장소 생성 후 다음 명령어 실행:

```bash
cd /Users/seungminlee/Downloads/11HOURINSIGHTS

# 원격 저장소 추가 (이미 되어 있으면 생략)
git remote add origin https://github.com/smsh73/11hour-insights.git

# 푸시
git push -u origin main
```

## 3단계: GitHub Secrets 설정

1. https://github.com/smsh73/11hour-insights/settings/secrets/actions 접속
2. "New repository secret" 클릭
3. Name: `AZURE_CREDENTIALS`
4. Value: 아래 명령어 실행 후 생성된 JSON 사용
   ```bash
   ./scripts/setup-github-actions.sh
   ```
   또는 Azure Portal에서 서비스 주체를 생성하여 JSON 생성

5. "Add secret" 클릭

## 4단계: Azure ACR Task 설정 (선택사항)

GitHub에 push할 때마다 자동으로 이미지를 빌드하려면:

1. GitHub Personal Access Token 생성:
   - https://github.com/settings/tokens
   - "Generate new token (classic)"
   - Token name: `ACR Build Token`
   - 권한: `repo` (전체 저장소 접근)
   - "Generate token" 클릭 후 토큰 복사

2. ACR Task 생성:
```bash
cd /Users/seungminlee/Downloads/11HOURINSIGHTS
./scripts/setup-acr-tasks.sh
```

또는 수동으로:
```bash
# GitHub 토큰 입력
read -p "GitHub Token: " GITHUB_TOKEN

# 백엔드 Task
az acr task create \
  --registry 11houracr \
  --name build-backend \
  --context https://github.com/smsh73/11hour-insights.git \
  --file backend/Dockerfile \
  --image backend:{{.Run.ID}} \
  --image backend:latest \
  --git-access-token $GITHUB_TOKEN \
  --set sourceTriggerEvents="commit" \
  --set sourceTriggerBranchFilters="main"

# 프론트엔드 Task
az acr task create \
  --registry 11houracr \
  --name build-frontend \
  --context https://github.com/smsh73/11hour-insights.git \
  --file frontend/Dockerfile \
  --image frontend:{{.Run.ID}} \
  --image frontend:latest \
  --git-access-token $GITHUB_TOKEN \
  --set sourceTriggerEvents="commit" \
  --set sourceTriggerBranchFilters="main"
```

## 5단계: 자동 배포 설정 (선택사항)

빌드 완료 후 자동으로 App Service를 재시작하려면:

GitHub Actions 워크플로우 (`.github/workflows/azure-build.yml`)가 이미 설정되어 있습니다.
이 워크플로우는:
- main 브랜치에 push 시 자동 실행
- 백엔드 및 프론트엔드 이미지 빌드
- ACR에 푸시
- App Service 자동 재시작

## 확인

### GitHub Actions 확인
- https://github.com/smsh73/11hour-insights/actions

### ACR Task 확인
```bash
az acr task list --registry 11houracr --output table
az acr task list-runs --registry 11houracr --output table
```

### 수동 빌드 테스트
```bash
az acr task run --registry 11houracr --name build-backend
az acr task run --registry 11houracr --name build-frontend
```

## 문제 해결

### 저장소를 찾을 수 없음
- GitHub에서 저장소가 생성되었는지 확인
- 저장소 이름이 정확한지 확인 (11hour-insights)

### 푸시 권한 오류
- GitHub 인증 확인: `gh auth login`
- 또는 Personal Access Token 사용

### ACR Task 빌드 실패
- GitHub 토큰 권한 확인 (repo 권한 필요)
- Dockerfile 경로 확인
- 빌드 로그 확인: `az acr task logs -r 11houracr --run-id <RUN_ID>`

