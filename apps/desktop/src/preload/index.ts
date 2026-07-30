import { contextBridge, ipcRenderer } from 'electron'
import type { AfilaAPI } from '../shared/api'
import { RUN_SOLUTION_CHANNEL } from '../shared/execution'

if (!process.contextIsolated) {
  throw new Error('Context isolation must be enabled')
}

const api: AfilaAPI = {
  execution: {
    run: (request) => ipcRenderer.invoke(RUN_SOLUTION_CHANNEL, request)
  }
}

contextBridge.exposeInMainWorld('api', api)
