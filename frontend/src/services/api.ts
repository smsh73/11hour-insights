import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

// Always log API base URL for debugging
console.log('[API Service] Initializing with baseURL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60초 타임아웃 (스크래핑이 오래 걸릴 수 있음)
});

// Request interceptor: Add auth token and log request
api.interceptors.request.use((config) => {
  // Step 1: Add authentication token
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('[API Request] Token added:', token.substring(0, 20) + '...');
  } else {
    console.warn('[API Request] No auth token found in localStorage');
  }
  
  // Step 2: Log request details
  const fullUrl = (config.baseURL || '') + (config.url || '');
  console.log('[API Request] ===== Request Start =====');
  console.log('[API Request] Method:', config.method?.toUpperCase());
  console.log('[API Request] URL:', fullUrl);
  console.log('[API Request] Headers:', {
    ...config.headers,
    Authorization: config.headers.Authorization ? 'Bearer ***' : 'none',
  });
  console.log('[API Request] Data:', config.data);
  console.log('[API Request] ===== Request End =====');
  
  return config;
}, (error) => {
  console.error('[API Request Error] Request interceptor error:', error);
  return Promise.reject(error);
});

// Response interceptor: Log response and handle errors
api.interceptors.response.use(
  (response) => {
    console.log('[API Response] ===== Response Success =====');
    console.log('[API Response] Method:', response.config.method?.toUpperCase());
    console.log('[API Response] URL:', response.config.url);
    console.log('[API Response] Status:', response.status, response.statusText);
    console.log('[API Response] Data:', response.data);
    console.log('[API Response] ===== Response End =====');
    return response;
  },
  (error) => {
    console.error('[API Response] ===== Response Error =====');
    console.error('[API Response] URL:', error.config?.url);
    console.error('[API Response] Method:', error.config?.method);
    console.error('[API Response] Status:', error.response?.status);
    console.error('[API Response] Status Text:', error.response?.statusText);
    console.error('[API Response] Error Data:', error.response?.data);
    console.error('[API Response] Error Message:', error.message);
    console.error('[API Response] Error Code:', error.code);
    console.error('[API Response] Full Error:', error);
    console.error('[API Response] ===== Error End =====');
    
    if (error.response?.status === 401) {
      console.log('[API] Unauthorized (401), removing token and redirecting to login');
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    } else if (error.response?.status === 403) {
      console.error('[API] Forbidden (403), admin access required');
    } else if (error.response?.status === 500) {
      console.error('[API] Server Error (500), check backend logs');
    } else if (!error.response) {
      console.error('[API] Network Error - No response from server');
      console.error('[API] This could mean:');
      console.error('[API]   1. Backend server is down');
      console.error('[API]   2. Network connectivity issue');
      console.error('[API]   3. CORS issue');
      console.error('[API]   4. Request timeout');
    }
    
    return Promise.reject(error);
  }
);

export default api;

