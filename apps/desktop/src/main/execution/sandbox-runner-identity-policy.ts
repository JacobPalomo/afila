import { isSandboxRunnerDocumentURL } from './sandbox-runner-document'

export interface SandboxRunnerIdentity {
  readonly webContentsId: number
  readonly frameTreeNodeId: number
  readonly frameToken: string
  readonly chromiumProcessId: number
  readonly osProcessId: number
}

export interface SandboxRunnerIdentitySnapshot {
  readonly windowDestroyed: boolean
  readonly windowVisible: boolean
  readonly contentsDestroyed: boolean
  readonly contentsType: string
  readonly sessionMatches: boolean
  readonly registeredWebContentsMatches: boolean
  readonly owningWindowMatches: boolean
  readonly hasOpener: boolean
  readonly hasHostWebContents: boolean
  readonly hasDevToolsWebContents: boolean
  readonly documentURL: string
  readonly mainFrameURL: string
  readonly mainFrameDetached: boolean
  readonly mainFrameHasParent: boolean
  readonly mainFrameIsTop: boolean
  readonly frameCountInSubtree: number
  readonly mainFrameChromiumProcessId: number
  readonly mainFrameOSProcessId: number
  readonly currentIdentity: SandboxRunnerIdentity
  readonly expectedIdentity: SandboxRunnerIdentity | null
  readonly collidingWebContentsIds: readonly number[]
  readonly uninspectableWebContentsIds: readonly number[]
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

function identitiesMatch(current: SandboxRunnerIdentity, expected: SandboxRunnerIdentity): boolean {
  return (
    current.webContentsId === expected.webContentsId &&
    current.frameTreeNodeId === expected.frameTreeNodeId &&
    current.frameToken === expected.frameToken &&
    current.chromiumProcessId === expected.chromiumProcessId &&
    current.osProcessId === expected.osProcessId
  )
}

export function getSandboxRunnerIdentityViolation(
  snapshot: SandboxRunnerIdentitySnapshot
): string | null {
  if (snapshot.windowDestroyed) {
    return 'The sandbox runner window is destroyed.'
  }

  if (snapshot.contentsDestroyed) {
    return 'The sandbox runner WebContents is destroyed.'
  }

  if (snapshot.windowVisible) {
    return 'The sandbox runner window is visible.'
  }

  if (snapshot.contentsType !== 'window') {
    return 'The sandbox runner has an unexpected WebContents type.'
  }

  if (!snapshot.sessionMatches) {
    return 'The sandbox runner is using an unexpected session.'
  }

  if (!snapshot.registeredWebContentsMatches) {
    return 'The sandbox runner WebContents registry identity does not match.'
  }

  if (!snapshot.owningWindowMatches) {
    return 'The sandbox runner WebContents belongs to an unexpected window.'
  }

  if (snapshot.hasOpener || snapshot.hasHostWebContents || snapshot.hasDevToolsWebContents) {
    return 'The sandbox runner has an unexpected owner, opener or DevTools relationship.'
  }

  if (
    !isSandboxRunnerDocumentURL(snapshot.documentURL) ||
    !isSandboxRunnerDocumentURL(snapshot.mainFrameURL) ||
    snapshot.documentURL !== snapshot.mainFrameURL
  ) {
    return 'The sandbox runner document identity does not match.'
  }

  if (
    snapshot.mainFrameDetached ||
    snapshot.mainFrameHasParent ||
    !snapshot.mainFrameIsTop ||
    snapshot.frameCountInSubtree !== 1
  ) {
    return 'The sandbox runner frame hierarchy is invalid.'
  }

  const identity = snapshot.currentIdentity

  if (
    !isPositiveInteger(identity.webContentsId) ||
    !isPositiveInteger(identity.frameTreeNodeId) ||
    identity.frameToken.length === 0 ||
    !isPositiveInteger(identity.chromiumProcessId) ||
    !isPositiveInteger(identity.osProcessId)
  ) {
    return 'The sandbox runner contains invalid identity values.'
  }

  if (
    identity.chromiumProcessId !== snapshot.mainFrameChromiumProcessId ||
    identity.osProcessId !== snapshot.mainFrameOSProcessId
  ) {
    return 'The sandbox runner WebContents and main frame belong to different processes.'
  }

  if (snapshot.expectedIdentity !== null && !identitiesMatch(identity, snapshot.expectedIdentity)) {
    return 'The sandbox runner identity changed after initialization.'
  }

  if (snapshot.uninspectableWebContentsIds.length > 0) {
    return 'Another live WebContents could not be inspected for process isolation.'
  }

  if (snapshot.collidingWebContentsIds.length > 0) {
    return 'The sandbox runner operating-system process is shared with another WebContents.'
  }

  return null
}
