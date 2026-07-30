type AfilaAPI = Record<string, never>

declare global {
  interface Window {
    api: AfilaAPI
  }
}

export {}
