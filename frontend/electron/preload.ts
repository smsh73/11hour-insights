import { contextBridge } from 'electron';

// 보안을 위한 프리로드 스크립트
// Renderer 프로세스에서 안전하게 Node.js API에 접근할 수 있도록 합니다

contextBridge.exposeInMainWorld('electron', {
  // 필요한 경우 여기에 Electron API를 노출할 수 있습니다
  // 예: 파일 시스템 접근, 네이티브 다이얼로그 등
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
});

