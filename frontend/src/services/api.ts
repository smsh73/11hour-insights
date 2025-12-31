import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

// Always log API base URL for debugging
console.log('[API Service] Initializing with baseURL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor with logging (always log in production for debugging)
api.interceptors.request.use((config) => {
  const fullUrl = config.baseURL + config.url;
  console.log('[API Request]', config.method?.toUpperCase(), fullUrl, {
    headers: config.headers,
    data: config.data,
  });
  return config;
}, (error) => {
  console.error('[API Request Error]', error);
  return Promise.reject(error);
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    console.log('[API Response]', response.config.method?.toUpperCase(), response.config.url, {
      status: response.status,
      data: response.data,
    });
    return response;
  },
  (error) => {
    console.error('[API Response Error]', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      code: error.code,
    });
    
    if (error.response?.status === 401) {
      console.log('[API] Unauthorized, redirecting to login');
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

