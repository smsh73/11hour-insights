// Electron 환경 감지
const isElectron = typeof window !== 'undefined' && window.electron !== undefined;

// 프로덕션 환경 감지
const isProduction = import.meta.env.PROD || 
  (typeof window !== 'undefined' && 
   (window.location.hostname.includes('azurewebsites.net') || 
    window.location.hostname.includes('11hour-frontend')));

// API Base URL 설정
// 1. 환경 변수에서 우선 사용 (빌드 시 설정됨)
// 2. 프로덕션 웹 환경: Azure 백엔드 사용
// 3. Electron 환경: Azure 백엔드 사용
// 4. 개발 환경: localhost 사용
export const API_BASE_URL = (() => {
  // 환경 변수가 있으면 우선 사용
  if (import.meta.env.VITE_API_BASE_URL) {
    console.log('[API] Using VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // 프로덕션 또는 Electron 환경
  if (isProduction || isElectron) {
    const url = 'https://11hour-backend.azurewebsites.net/api';
    console.log('[API] Using production backend:', url, { isProduction, isElectron });
    return url;
  }
  
  // 개발 환경
  const url = 'http://localhost:3001/api';
  console.log('[API] Using development backend:', url);
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

