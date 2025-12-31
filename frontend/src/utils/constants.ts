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
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (isProduction || isElectron
    ? 'https://11hour-backend.azurewebsites.net/api'
    : 'http://localhost:3001/api');

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

