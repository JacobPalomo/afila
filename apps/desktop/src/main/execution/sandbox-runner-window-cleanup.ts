import type { BrowserWindow } from 'electron'

export type SandboxRunnerSessionCleanupMode = 'reuse' | 'invalidate'

export interface SandboxRunnerSessionCleanupHandle {
  dispose(): Promise<void>
  invalidate(): Promise<void>
}

export type SandboxRunnerProcessReleaseWaiter = () => Promise<void>

export type SandboxRunnerSessionCleanupModeSource =
  SandboxRunnerSessionCleanupMode | (() => SandboxRunnerSessionCleanupMode)

function readSessionCleanupMode(
  source: SandboxRunnerSessionCleanupModeSource
): SandboxRunnerSessionCleanupMode {
  return typeof source === 'function' ? source() : source
}

export async function cleanupSandboxRunnerWindow(
  runnerWindow: BrowserWindow | null,
  sessionHandle: SandboxRunnerSessionCleanupHandle,
  sessionCleanupMode: SandboxRunnerSessionCleanupModeSource,
  waitForProcessRelease: SandboxRunnerProcessReleaseWaiter | null = null
): Promise<unknown[]> {
  const errors: unknown[] = []

  let mustInvalidate = readSessionCleanupMode(sessionCleanupMode) === 'invalidate'

  /*
   * First destroy the BrowserWindow.
   */
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

  /*
   * Then confirm that the BrowserWindow, WebContents
   * and renderer process have disappeared.
   *
   * This must happen before the session lease can
   * ever be released.
   */
  if (waitForProcessRelease !== null) {
    try {
      await waitForProcessRelease()
    } catch (error) {
      mustInvalidate = true
      errors.push(error)
    }
  }

  if (readSessionCleanupMode(sessionCleanupMode) === 'invalidate') {
    mustInvalidate = true
  }

  /*
   * Release the reusable session only when every
   * previous cleanup step succeeded.
   */
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
