import type { Session } from 'electron'
import { describe, expect, it } from 'vitest'
import { createSandboxRunnerWindowOptions } from './sandbox-runner-window-options'

describe('sandbox runner window options', () => {
  it('uses the exact dedicated session', () => {
    const runnerSession = {} as Session
    const options = createSandboxRunnerWindowOptions(runnerSession)

    const webPreferences = options.webPreferences

    expect(webPreferences).toBeDefined()

    if (webPreferences === undefined) {
      throw new Error('Sandbox runner web preferences are required.')
    }

    expect(webPreferences.session).toBe(runnerSession)
    expect(webPreferences).not.toHaveProperty('partition')
    expect(webPreferences).not.toHaveProperty('preload')
  })

  it('disables privileged renderer capabilities', () => {
    const options = createSandboxRunnerWindowOptions({} as Session)

    expect(options).toMatchObject({
      show: false,
      focusable: false,
      fullscreenable: false,
      skipTaskbar: true,
      webPreferences: {
        sandbox: true,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        nodeIntegrationInSubFrames: false,
        contextIsolation: true,
        webviewTag: false,
        devTools: false,
        javascript: true,
        navigateOnDragDrop: false,
        disableDialogs: true
      }
    })
  })
})
