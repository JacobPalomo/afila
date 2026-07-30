import type { AfilaAPI } from '../shared/api'

declare global {
  interface Window {
    api: AfilaAPI
  }
}

export {}
