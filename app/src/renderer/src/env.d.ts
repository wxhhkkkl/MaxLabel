/// <reference types="vite/client" />

// preload 暴露的全局 API 声明
import type { MaxLabelAPI } from '../../preload/index.d'

declare global {
  interface Window {
    maxlabel: MaxLabelAPI
  }
}

export {}
