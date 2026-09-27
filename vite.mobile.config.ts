import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The Android build: the desktop renderer plus the main-process modules that
 * make sense on a phone, run in one WebView. Node and Electron APIs those
 * modules touch are swapped for small stand-ins in src/mobile/shims, so
 * YouTube, lyrics, translation, motion artwork, settings and Replay are the
 * same code as on the desktop.
 */
const shim = (name: string) => resolve('src/mobile/shims', name)

export default defineConfig({
  root: 'src/mobile',
  base: './',
  publicDir: false,
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@renderer', replacement: resolve('src/renderer/src') },
      { find: '@shared', replacement: resolve('src/shared') },
      { find: /^youtubei\.js$/, replacement: 'youtubei.js/web' },
      { find: /^electron$/, replacement: shim('electron.ts') },
      { find: /^node:fs$/, replacement: shim('fs.ts') },
      { find: /^node:path$/, replacement: shim('path.ts') },
      { find: /^node:vm$/, replacement: shim('vm.ts') },
      // Desktop-only neighbours of the shared main modules.
      { find: /^\.\.\/potoken$/, replacement: resolve('src/mobile/potoken.ts') },
      { find: /^\.\.\/downloads$/, replacement: shim('downloads.ts') },
    ],
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.1.0'),
  },
  build: {
    outDir: resolve('out/mobile'),
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
  },
})
