import {
  BrowserWindow,
  webContents as electronWebContents,
  type Session,
  type WebContents
} from 'electron'
import {
  getSandboxRunnerIdentityViolation,
  type SandboxRunnerIdentity,
  type SandboxRunnerIdentitySnapshot
} from './sandbox-runner-identity-policy'

interface ProcessInspection {
  readonly collidingWebContentsIds: number[]
  readonly uninspectableWebContentsIds: number[]
}

function inspectOtherWebContents(
  runnerContents: WebContents,
  runnerOSProcessId: number
): ProcessInspection {
  const collidingWebContentsIds: number[] = []
  const uninspectableWebContentsIds: number[] = []

  for (const candidate of electronWebContents.getAllWebContents()) {
    if (
      candidate === runnerContents ||
      candidate.id === runnerContents.id ||
      candidate.isDestroyed()
    ) {
      continue
    }

    try {
      const candidateOSProcessId = candidate.getOSProcessId()

      if (!Number.isInteger(candidateOSProcessId) || candidateOSProcessId <= 0) {
        if (!candidate.isDestroyed()) {
          uninspectableWebContentsIds.push(candidate.id)
        }

        continue
      }

      if (candidateOSProcessId === runnerOSProcessId) {
        collidingWebContentsIds.push(candidate.id)
      }
    } catch {
      if (!candidate.isDestroyed()) {
        uninspectableWebContentsIds.push(candidate.id)
      }
    }
  }

  return {
    collidingWebContentsIds,
    uninspectableWebContentsIds
  }
}

export function assertSandboxRunnerIdentity(
  runnerWindow: BrowserWindow,
  runnerSession: Session,
  expectedIdentity: SandboxRunnerIdentity | null = null
): SandboxRunnerIdentity {
  if (runnerWindow.isDestroyed()) {
    throw new Error('The sandbox runner window is destroyed.')
  }

  const contents = runnerWindow.webContents

  if (contents.isDestroyed()) {
    throw new Error('The sandbox runner WebContents is destroyed.')
  }

  if (contents.isCrashed()) {
    throw new Error('The sandbox runner renderer process has crashed.')
  }

  const mainFrame = contents.mainFrame

  if (mainFrame.isDestroyed()) {
    throw new Error('The sandbox runner main frame is destroyed.')
  }

  const currentIdentity = Object.freeze({
    webContentsId: contents.id,
    frameTreeNodeId: mainFrame.frameTreeNodeId,
    frameToken: mainFrame.frameToken,
    chromiumProcessId: contents.getProcessId(),
    osProcessId: contents.getOSProcessId()
  }) satisfies SandboxRunnerIdentity

  const processInspection = inspectOtherWebContents(contents, currentIdentity.osProcessId)

  const snapshot = {
    windowDestroyed: runnerWindow.isDestroyed(),
    windowVisible: runnerWindow.isVisible(),
    contentsDestroyed: contents.isDestroyed(),
    contentsType: contents.getType(),
    sessionMatches: contents.session === runnerSession,
    registeredWebContentsMatches: electronWebContents.fromId(contents.id) === contents,
    owningWindowMatches: BrowserWindow.fromWebContents(contents) === runnerWindow,
    hasOpener: contents.opener !== null,
    hasHostWebContents: contents.hostWebContents !== null,
    hasDevToolsWebContents: contents.devToolsWebContents !== null,
    documentURL: contents.getURL(),
    mainFrameURL: mainFrame.url,
    mainFrameDetached: mainFrame.detached,
    mainFrameHasParent: mainFrame.parent !== null,
    mainFrameIsTop: mainFrame.top === mainFrame,
    frameCountInSubtree: mainFrame.framesInSubtree.length,
    mainFrameChromiumProcessId: mainFrame.processId,
    mainFrameOSProcessId: mainFrame.osProcessId,
    currentIdentity,
    expectedIdentity,
    ...processInspection
  } satisfies SandboxRunnerIdentitySnapshot

  const violation = getSandboxRunnerIdentityViolation(snapshot)

  if (violation !== null) {
    throw new Error(violation)
  }

  return currentIdentity
}
