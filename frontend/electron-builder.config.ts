import { defineConfig } from 'electron-builder';

export default defineConfig({
  appId: 'com.11hour.insights',
  productName: '11Hour Insights',
  directories: {
    output: 'dist',
    buildResources: 'build',
  },
  files: [
    'dist/**/*',
    'dist-electron/**/*',
    'node_modules/**/*',
    'package.json',
  ],
  mac: {
    target: [
      {
        target: 'zip',
        arch: ['x64', 'arm64'],
      },
    ],
    category: 'public.app-category.utilities',
    icon: 'build/icon.icns',
    hardenedRuntime: false,
    gatekeeperAssess: false,
  },
  win: {
    target: [
      {
        target: 'portable',
        arch: ['x64'],
      },
    ],
    icon: 'build/icon.ico',
  },
  linux: {
    target: [
      {
        target: 'AppImage',
        arch: ['x64'],
      },
    ],
    category: 'Utility',
    icon: 'build/icon.png',
  },
  portable: {
    artifactName: '${productName}-${version}-${arch}-portable.${ext}',
  },
});

