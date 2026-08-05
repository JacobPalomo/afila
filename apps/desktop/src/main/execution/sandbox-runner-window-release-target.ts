import type { BrowserWindow } from 'electron'
import type { SandboxRunnerIdentity } from './sandbox-runner-identity-policy'
import { captureSandboxRunnerProcessReleaseTarget } from './sandbox-runner-process-release'
import type { SandboxRunnerProcessReleaseTarget } from './sandbox-runner-process-release-policy'
import {
  cleanupSandboxRunnerWindow,
  type SandboxRunnerSessionCleanupHandle
} from './sandbox-runner-window-cleanup'

export type SandboxRunnerProcessReleaseTargetCapture = (
  runnerWindow: BrowserWindow,
  identity: SandboxRunnerIdentity
) => SandboxRunnerProcessReleaseTarget

export async function captureSandboxRunnerWindowReleaseTarget(
  runnerWindow: BrowserWindow,
  identity: SandboxRunnerIdentity,
  sessionHandle: SandboxRunnerSessionCleanupHandle,
  captureTarget: SandboxRunnerProcessReleaseTargetCapture = captureSandboxRunnerProcessReleaseTarget
): Promise<SandboxRunnerProcessReleaseTarget> {
  try {
    return captureTarget(runnerWindow, identity)
  } catch (error) {
    const cleanupErrors = await cleanupSandboxRunnerWindow(
      runnerWindow,
      sessionHandle,
      'invalidate'
    )

    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        'The sandbox runner process release target could not be captured or cleaned safely.'
      )
    }

    throw error
  }
}
