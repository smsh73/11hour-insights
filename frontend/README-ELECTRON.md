# Electron 데스크톱 애플리케이션

이 프로젝트는 React 웹 애플리케이션을 Electron을 사용하여 macOS와 Windows 포터블 데스크톱 애플리케이션으로 변환합니다.

## 개발 환경 설정

### 사전 요구사항

- Node.js 20+
- npm 또는 yarn

### 설치

```bash
cd frontend
npm install
```

## 개발 모드 실행

```bash
npm run electron:dev
```

이 명령은 다음을 실행합니다:
1. Vite 개발 서버 시작 (포트 5173)
2. Electron 앱 실행

## 빌드

### 모든 플랫폼 빌드

```bash
npm run electron:build:all
```

### macOS만 빌드

```bash
npm run electron:build:mac
```

출력: `dist/11hour-insights-1.0.0-mac.zip`
- 압축 해제 후 `11hour-insights.app` 더블클릭하여 실행

### Windows만 빌드

```bash
npm run electron:build:win
```

출력: `dist/11hour-insights-1.0.0-x64-portable.exe`
- 더블클릭하여 실행 (설치 불필요)

## 포터블 앱 사용 방법

### macOS

1. `11hour-insights-1.0.0-mac.zip` 다운로드
2. 압축 해제
3. `11hour-insights.app` 더블클릭하여 실행
4. 필요시 Applications 폴더로 이동 (선택적)

### Windows

1. `11hour-insights-1.0.0-x64-portable.exe` 다운로드
2. 원하는 위치에 저장
3. 더블클릭하여 실행
4. 설치 과정 없음

## 작동 방식

이 Electron 앱은 **Azure Frontend App Service의 웹 버전을 내장 브라우저로 로드**합니다.

- **프로덕션 모드**: `https://11hour-frontend.azurewebsites.net` 로드
- **개발 모드**: `http://localhost:5173` 로드 (로컬 개발 서버)

### 장점

1. **웹 버전과 동일**: Azure Frontend App Service의 웹 버전과 완전히 동일한 기능
2. **자동 업데이트**: 웹 버전이 업데이트되면 Electron 앱도 자동으로 최신 버전 사용
3. **재빌드 불필요**: 웹 버전 업데이트 시 Electron 앱 재빌드 불필요
4. **일관성**: 웹과 데스크톱 앱이 항상 동일한 버전

### 백엔드 연결

웹 버전이 Azure 백엔드 (`https://11hour-backend.azurewebsites.net/api`)에 연결되므로, Electron 앱도 동일한 백엔드를 사용합니다.

## 아이콘 설정

`build/` 폴더에 다음 아이콘 파일을 추가하세요:

- `icon.icns` - macOS (1024x1024)
- `icon.ico` - Windows (256x256)
- `icon.png` - Linux (512x512)

아이콘 없이도 빌드는 가능하지만, 프로덕션 배포 시 권장됩니다.

## 문제 해결

### 빌드 오류

1. `node_modules` 삭제 후 재설치:
   ```bash
   rm -rf node_modules
   npm install
   ```

2. TypeScript 컴파일 오류 확인:
   ```bash
   npm run electron:build:electron
   ```

### 실행 오류

1. 개발 모드에서 DevTools 열기 (자동으로 열림)
2. 콘솔에서 오류 메시지 확인
3. 백엔드 연결 확인

## 파일 구조

```
frontend/
├── electron/
│   ├── main.ts          # Electron 메인 프로세스
│   ├── preload.ts       # 프리로드 스크립트
│   └── tsconfig.json    # Electron TypeScript 설정
├── src/                 # React 애플리케이션
├── dist/                # 빌드 출력 (Vite)
├── dist-electron/       # Electron 빌드 출력
├── build/               # 아이콘 및 빌드 리소스
└── package.json         # 의존성 및 빌드 설정
```

