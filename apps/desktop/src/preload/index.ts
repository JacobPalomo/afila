import { contextBridge } from 'electron'

if (!process.contextIsolated) {
  throw new Error('Context isolation must be enabled')
}

const api: Record<string, never> = {}

contextBridge.exposeInMainWorld('api', api)
