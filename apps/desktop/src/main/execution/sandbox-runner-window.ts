import { BrowserWindow } from 'electron'
import { isSandboxRunnerDocumentURL } from './sandbox-runner-document'
import {
  createSandboxRunnerSession,
  type SandboxRunnerSessionHandle
} from './sandbox-runner-session'
import { createSandboxRunnerWindowOptions } from './sandbox-runner-window-options'

export interface SandboxRunnerWindowHandle {
  readonly window: BrowserWindow
  readonly session: SandboxRunnerSessionHandle
  dispose(): Promise<void>
}

async function cleanupSandboxRunnerWindow(
  runnerWindow: BrowserWindow | null,
  sessionHandle: SandboxRunnerSessionHandle
): Promise<unknown[]> {
  const errors: unknown[] = []

  try {
    if (runnerWindow !== null && !runnerWindow.isDestroyed()) {
      runnerWindow.destroy()
    }
  } catch (error) {
    errors.push(error)
  }

  try {
    await sessionHandle.dispose()
  } catch (error) {
    errors.push(error)
  }

  return errors
}

export async function createSandboxRunnerWindow(): Promise<SandboxRunnerWindowHandle> {
  const sessionHandle = createSandboxRunnerSession()

  let runnerWindow: BrowserWindow | null = null

  try {
    runnerWindow = new BrowserWindow(createSandboxRunnerWindowOptions(sessionHandle.session))

    const contents = runnerWindow.webContents

    const destroyRunnerWindow = (): void => {
      if (runnerWindow !== null && !runnerWindow.isDestroyed()) {
        runnerWindow.destroy()
      }
    }

    contents.on('frame-created', (_event, details) => {
      const frame = details.frame

      if (frame === null || frame.parent !== null) {
        destroyRunnerWindow()
      }
    })

    if (contents.session !== sessionHandle.session) {
      throw new Error('The sandbox runner window is using an unexpected session.')
    }

    contents.setWindowOpenHandler(() => ({
      action: 'deny'
    }))

    contents.on('will-frame-navigate', (event) => {
      event.preventDefault()
    })

    contents.on('will-redirect', (event) => {
      event.preventDefault()
    })

    contents.on('will-attach-webview', (event) => {
      event.preventDefault()
    })

    contents.on('content-bounds-updated', (event) => {
      event.preventDefault()
    })

    contents.on('will-prevent-unload', (event) => {
      event.preventDefault()
    })

    contents.on('did-navigate-in-page', () => {
      destroyRunnerWindow()
    })

    await runnerWindow.loadURL(sessionHandle.documentURL)

    if (contents.mainFrame.frames.length !== 0) {
      throw new Error('The sandbox runner created an unexpected child frame.')
    }

    if (runnerWindow.isDestroyed() || contents.isDestroyed()) {
      throw new Error('The sandbox runner was destroyed while loading.')
    }

    if (!isSandboxRunnerDocumentURL(contents.getURL())) {
      throw new Error('The sandbox runner loaded an unexpected document.')
    }

    if (runnerWindow.isVisible()) {
      throw new Error('The sandbox runner window must remain hidden.')
    }
  } catch (error) {
    const cleanupErrors = await cleanupSandboxRunnerWindow(runnerWindow, sessionHandle)

    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        'The sandbox runner window could not be initialized or cleaned.'
      )
    }

    throw error
  }

  let disposePromise: Promise<void> | null = null

  const dispose = (): Promise<void> => {
    if (disposePromise !== null) {
      return disposePromise
    }

    disposePromise = (async () => {
      const cleanupErrors = await cleanupSandboxRunnerWindow(runnerWindow, sessionHandle)

      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          cleanupErrors,
          'The sandbox runner window could not be cleaned completely.'
        )
      }
    })()

    return disposePromise
  }

  return {
    window: runnerWindow,
    session: sessionHandle,
    dispose
  }
}
