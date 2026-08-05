import { app, BrowserWindow, webContents } from 'electron'
import type { SandboxRunnerIdentity } from './sandbox-runner-identity-policy'
import {
  waitForSandboxRunnerProcessRelease,
  type SandboxRunnerProcessReleaseSnapshot,
  type SandboxRunnerProcessReleaseTarget
} from './sandbox-runner-process-release-policy'

export function captureSandboxRunnerProcessReleaseTarget(
  runnerWindow: BrowserWindow,
  identity: SandboxRunnerIdentity
): SandboxRunnerProcessReleaseTarget {
  if (runnerWindow.isDestroyed()) {
    throw new Error('The sandbox runner window is already destroyed.')
  }

  if (runnerWindow.webContents.id !== identity.webContentsId) {
    throw new Error('The sandbox runner WebContents identity does not match.')
  }

  const matchingMetrics = app
    .getAppMetrics()
    .filter((metric) => metric.pid === identity.osProcessId)

  if (matchingMetrics.length !== 1) {
    throw new Error('Electron did not return exactly one metric for the sandbox runner process.')
  }

  const processMetric = matchingMetrics[0]

  if (
    processMetric === undefined ||
    !Number.isFinite(processMetric.creationTime) ||
    processMetric.creationTime <= 0
  ) {
    throw new Error('The sandbox runner process has an invalid creation time.')
  }

  return Object.freeze({
    windowId: runnerWindow.id,
    webContentsId: identity.webContentsId,
    osProcessId: identity.osProcessId,
    processCreationTime: processMetric.creationTime
  })
}

export function readSandboxRunnerProcessReleaseSnapshot(
  target: SandboxRunnerProcessReleaseTarget
): SandboxRunnerProcessReleaseSnapshot {
  const processRegistered = app
    .getAppMetrics()
    .some(
      (metric) =>
        metric.pid === target.osProcessId && metric.creationTime === target.processCreationTime
    )

  return {
    windowRegistered: BrowserWindow.fromId(target.windowId) !== null,

    webContentsRegistered: webContents.fromId(target.webContentsId) !== undefined,

    processRegistered
  }
}

export function waitForCapturedSandboxRunnerProcessRelease(
  target: SandboxRunnerProcessReleaseTarget
): Promise<void> {
  return waitForSandboxRunnerProcessRelease({
    readSnapshot: () => readSandboxRunnerProcessReleaseSnapshot(target)
  })
}
