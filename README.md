# 11Hour Insights

안양제일교회 열한시 신문 AI 분석 시스템

## 기능

- 신문 이미지 자동 수집 및 다운로드
- AI 기반 OCR 및 기사 추출 (OpenAI, Gemini, Claude)
- 디지털 신문 리더
- 기사 검색 및 필터링
- 통계 및 인사이트 시각화
- 이벤트 타임라인
- 관리자 대시보드

## 기술 스택

### 프론트엔드
- React 18
- TypeScript
- Vite
- React Router
- TanStack Query
- Recharts

### 백엔드
- Node.js
- Express
- TypeScript
- PostgreSQL
- OpenAI API
- Google Gemini API
- Anthropic Claude API

### 배포
- Azure App Service
- Azure Container Registry
- Azure PostgreSQL

## 로컬 개발

### 사전 요구사항

- Node.js 20+
- PostgreSQL 14+
- Docker (선택사항)

### 설치

```bash
# 루트 디렉토리
npm install

# 백엔드
cd backend
npm install

# 프론트엔드
cd frontend
npm install
```

### 환경 변수 설정

백엔드 `.env` 파일:

```env
PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=11hour_insights
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
OPENAI_API_KEY=
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
```

프론트엔드 `.env` 파일:

```env
VITE_API_BASE_URL=http://localhost:3001/api
```

### 데이터베이스 초기화

```bash
cd backend
npm run dev
```

서버 시작 시 자동으로 데이터베이스가 초기화됩니다.

### 실행

```bash
# 루트에서 (백엔드 + 프론트엔드 동시 실행)
npm run dev

# 또는 개별 실행
npm run dev:backend
npm run dev:frontend
```

### 초기 관리자 계정 생성

```bash
curl -X POST http://localhost:3001/api/auth/init-admin \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

## 배포

Azure 배포 가이드는 [DEPLOYMENT.md](DEPLOYMENT.md)를 참조하세요.

## 프로젝트 구조

```
11HOURINSIGHTS/
├── backend/          # 백엔드 서버
│   ├── src/
│   │   ├── config/   # 데이터베이스 설정
│   │   ├── routes/   # API 라우트
│   │   ├── services/ # 비즈니스 로직
│   │   └── middleware/
│   └── Dockerfile
├── frontend/         # 프론트엔드 앱
│   ├── src/
│   │   ├── pages/    # 페이지 컴포넌트
│   │   ├── components/
│   │   └── services/ # API 클라이언트
│   └── Dockerfile
└── scripts/          # 배포 스크립트
```

## 라이선스

MIT

