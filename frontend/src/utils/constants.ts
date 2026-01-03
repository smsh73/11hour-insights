// Azure App Service 환경으로 고정
// 모든 환경에서 Azure 백엔드 사용
export const API_BASE_URL = (() => {
  // 환경 변수가 있으면 우선 사용 (빌드 시 설정 가능)
  if (import.meta.env.VITE_API_BASE_URL) {
    console.log('[API] Using VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // 기본값: Azure 백엔드 App Service
  const url = 'https://11hour-backend.azurewebsites.net/api';
  console.log('[API] Using Azure backend:', url);
  return url;
})();

// 런타임에 API Base URL 로깅 (프로덕션에서도)
if (typeof window !== 'undefined') {
  console.log('[API] Final API_BASE_URL:', API_BASE_URL);
  console.log('[API] Environment:', {
    PROD: import.meta.env.PROD,
    DEV: import.meta.env.DEV,
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    hostname: window.location.hostname,
    isElectron,
    isProduction,
  });
}

export const ARTICLE_TYPES = [
  '행사',
  '간증',
  '선교',
  '말씀',
  '컬럼',
  '샘물',
  '절기',
  '수련회',
  '양육프로그램',
  '성찬식',
  '세례식',
  '장례식',
  '찬양',
  '교회학교',
  '청년부',
  '부흥회',
  '특별새벽기도회',
  '큐티',
] as const;

export type ArticleType = typeof ARTICLE_TYPES[number];

