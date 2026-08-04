import type { BrowserWindow } from 'electron'

export type SandboxRunnerSessionCleanupMode = 'reuse' | 'invalidate'

export interface SandboxRunnerSessionCleanupHandle {
  dispose(): Promise<void>
  invalidate(): Promise<void>
}

export async function cleanupSandboxRunnerWindow(
  runnerWindow: BrowserWindow | null,
  sessionHandle: SandboxRunnerSessionCleanupHandle,
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
