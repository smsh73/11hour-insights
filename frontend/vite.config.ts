import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 프로덕션 웹: 절대 경로 사용 (/)
  // Electron: 상대 경로 사용 (./)
  // 개발: 절대 경로 사용 (/)
  base: process.env.ELECTRON_BUILD === 'true' ? './' : '/',
  server: {
    port: 5173,
    strictPort: true,
    // Azure 환경에서는 프록시 불필요 (직접 Azure 백엔드 호출)
    // 개발 시에만 필요하면 환경 변수로 제어
    ...(process.env.VITE_USE_PROXY === 'true' ? {
      proxy: {
        '/api': {
          target: process.env.VITE_PROXY_TARGET || 'https://11hour-backend.azurewebsites.net',
          changeOrigin: true,
          secure: true,
        },
      },
    } : {}),
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

