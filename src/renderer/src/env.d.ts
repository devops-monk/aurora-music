/// <reference types="vite/client" />
import type { AuroraApi } from '@shared/api'

declare global {
  interface Window {
    aurora: AuroraApi
  }
  const __APP_VERSION__: string
}
