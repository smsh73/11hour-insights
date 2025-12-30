/// <reference types="vite/client" />

// Electron 타입 정의
interface Window {
  electron?: {
    platform: string;
    versions: {
      node: string;
      chrome: string;
      electron: string;
    };
  };
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
