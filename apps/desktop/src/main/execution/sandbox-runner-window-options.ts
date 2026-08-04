import type { BrowserWindowConstructorOptions, Session } from 'electron'

export function createSandboxRunnerWindowOptions(
  runnerSession: Session
): BrowserWindowConstructorOptions {
  return {
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
      disableDialogs: true,
      session: runnerSession
    }
  }
}
