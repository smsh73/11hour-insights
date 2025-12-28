export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

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

