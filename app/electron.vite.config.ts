import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    build: { target: 'node16' },
    // mysql2 是纯 JS 驱动，直接打进主进程产物：省得在 build.files 里逐个列它的传递依赖
    plugins: [externalizeDepsPlugin({ exclude: ['mysql2'] })]
  },
  preload: {
    build: { target: 'node16' },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    build: {
      target: 'chrome108',
      rollupOptions: {
        output: {
          // Keep the editor shell responsive on first launch; heavy rendering
          // libraries are shared chunks and can be cached independently.
          manualChunks: {
            fabric: ['fabric'],
            barcode: ['bwip-js']
          }
        }
      }
    }
  }
})
