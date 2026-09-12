import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
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
