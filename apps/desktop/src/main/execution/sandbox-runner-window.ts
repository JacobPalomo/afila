import { BrowserWindow } from 'electron'
import { isSandboxRunnerDocumentURL } from './sandbox-runner-document'
import {
  createSandboxRunnerSession,
  type SandboxRunnerSessionHandle
} from './sandbox-runner-session'
import { createSandboxRunnerWindowOptions } from './sandbox-runner-window-options'
import { assertSandboxRunnerIdentity } from './sandbox-runner-identity'
import type { SandboxRunnerIdentity } from './sandbox-runner-identity-policy'
import { runSandboxRunnerIsolatedWorldProbe } from './sandbox-runner-isolated-world-probe'
import { runSandboxRunnerBrowserCapabilityProbe } from './sandbox-runner-browser-capability-probe'
import { getSandboxRunnerRequestAuditViolation } from './sandbox-runner-request-audit'
import { runSandboxRunnerWebRTCLockdown } from './sandbox-runner-webrtc-lockdown'
import { assertSandboxRunnerSessionStorageEmpty } from './sandbox-runner-session-storage'
import { runSandboxRunnerStorageCapabilityProbe } from './sandbox-runner-storage-capability-probe'

export interface SandboxRunnerWindowHandle {
  readonly window: BrowserWindow
  readonly session: SandboxRunnerSessionHandle
  readonly identity: SandboxRunnerIdentity
  assertReadyForExecution(): SandboxRunnerIdentity
  dispose(): Promise<void>
}

type SandboxRunnerSessionCleanupMode = 'reuse' | 'invalidate'

async function cleanupSandboxRunnerWindow(
  runnerWindow: BrowserWindow | null,
  sessionHandle: SandboxRunnerSessionHandle,
  sessionCleanupMode: SandboxRunnerSessionCleanupMode
): Promise<unknown[]> {
  const errors: unknown[] = []

  let mustInvalidate = sessionCleanupMode === 'invalidate'

  try {
    if (runnerWindow !== null && !runnerWindow.isDestroyed()) {
      runnerWindow.destroy()
    }

    if (runnerWindow !== null && !runnerWindow.isDestroyed()) {
      mustInvalidate = true

      errors.push(new Error('The sandbox runner window remained alive after destruction.'))
    }
  } catch (error) {
    mustInvalidate = true
    errors.push(error)
  }

  try {
    if (mustInvalidate) {
      await sessionHandle.invalidate()
    } else {
      await sessionHandle.dispose()
    }
  } catch (error) {
    errors.push(error)
  }

  return errors
}

function assertSandboxRunnerRequestAudit(sessionHandle: SandboxRunnerSessionHandle): void {
  const violation = getSandboxRunnerRequestAuditViolation(sessionHandle.getRequestAuditSnapshot())

  if (violation !== null) {
    throw new Error(violation)
  }
}

export async function createSandboxRunnerWindow(): Promise<SandboxRunnerWindowHandle> {
  const sessionHandle = createSandboxRunnerSession()

  let runnerWindow: BrowserWindow | null = null
  let initialIdentity: SandboxRunnerIdentity | null = null

  try {
    await assertSandboxRunnerSessionStorageEmpty(sessionHandle.session)

    runnerWindow = new BrowserWindow(createSandboxRunnerWindowOptions(sessionHandle.session))

    const contents = runnerWindow.webContents

    const destroyRunnerWindow = (): void => {
      if (runnerWindow !== null && !runnerWindow.isDestroyed()) {
        runnerWindow.destroy()
      }
    }

    contents.on('render-process-gone', () => {
      destroyRunnerWindow()
    })

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

    initialIdentity = assertSandboxRunnerIdentity(runnerWindow, sessionHandle.session)

    await runSandboxRunnerIsolatedWorldProbe(contents)

    assertSandboxRunnerIdentity(runnerWindow, sessionHandle.session, initialIdentity)

    await runSandboxRunnerBrowserCapabilityProbe(contents)

    assertSandboxRunnerRequestAudit(sessionHandle)

    assertSandboxRunnerIdentity(runnerWindow, sessionHandle.session, initialIdentity)

    await runSandboxRunnerStorageCapabilityProbe(contents)

    await assertSandboxRunnerSessionStorageEmpty(sessionHandle.session)

    assertSandboxRunnerRequestAudit(sessionHandle)

    assertSandboxRunnerIdentity(runnerWindow, sessionHandle.session, initialIdentity)

    await runSandboxRunnerWebRTCLockdown(contents)

    assertSandboxRunnerRequestAudit(sessionHandle)

    assertSandboxRunnerIdentity(runnerWindow, sessionHandle.session, initialIdentity)
  } catch (error) {
    const cleanupErrors = await cleanupSandboxRunnerWindow(
      runnerWindow,
      sessionHandle,
      'invalidate'
    )

    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        'The sandbox runner window could not be initialized or cleaned.'
      )
    }

    throw error
  }

  if (runnerWindow === null || initialIdentity === null) {
    throw new Error('The sandbox runner identity was not established.')
  }

  const establishedWindow = runnerWindow
  const establishedIdentity = initialIdentity

  const assertReadyForExecution = (): SandboxRunnerIdentity => {
    const identity = assertSandboxRunnerIdentity(
      establishedWindow,
      sessionHandle.session,
      establishedIdentity
    )

    assertSandboxRunnerRequestAudit(sessionHandle)

    return identity
  }

  let disposePromise: Promise<void> | null = null

  const dispose = (): Promise<void> => {
    if (disposePromise !== null) {
      return disposePromise
    }

    disposePromise = (async () => {
      const cleanupErrors = await cleanupSandboxRunnerWindow(
        establishedWindow,
        sessionHandle,
        'reuse'
      )

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
    window: establishedWindow,
    session: sessionHandle,
    identity: establishedIdentity,
    assertReadyForExecution,
    dispose
  }
}
