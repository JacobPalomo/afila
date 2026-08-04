import { describe, expect, it } from 'vitest'
import {
  getSandboxRunnerIdentityViolation,
  type SandboxRunnerIdentity,
  type SandboxRunnerIdentitySnapshot
} from './sandbox-runner-identity-policy'
import { SANDBOX_RUNNER_DOCUMENT_URL } from './sandbox-runner-document'

const identity = {
  webContentsId: 8,
  frameTreeNodeId: 21,
  frameToken: 'frame-token-1',
  chromiumProcessId: 100,
  osProcessId: 4_200
} satisfies SandboxRunnerIdentity

function createSnapshot(
  overrides: Partial<SandboxRunnerIdentitySnapshot> = {}
): SandboxRunnerIdentitySnapshot {
  return {
    windowDestroyed: false,
    windowVisible: false,
    contentsDestroyed: false,
    contentsType: 'window',
    sessionMatches: true,
    registeredWebContentsMatches: true,
    owningWindowMatches: true,
    hasOpener: false,
    hasHostWebContents: false,
    hasDevToolsWebContents: false,
    documentURL: SANDBOX_RUNNER_DOCUMENT_URL,
    mainFrameURL: SANDBOX_RUNNER_DOCUMENT_URL,
    mainFrameDetached: false,
    mainFrameHasParent: false,
    mainFrameIsTop: true,
    frameCountInSubtree: 1,
    mainFrameChromiumProcessId: identity.chromiumProcessId,
    mainFrameOSProcessId: identity.osProcessId,
    currentIdentity: identity,
    expectedIdentity: identity,
    collidingWebContentsIds: [],
    uninspectableWebContentsIds: [],
    ...overrides
  }
}

describe('sandbox runner identity policy', () => {
  it('accepts an exclusive and stable runner identity', () => {
    expect(getSandboxRunnerIdentityViolation(createSnapshot())).toBeNull()
  })

  it('rejects a destroyed or visible runner', () => {
    expect(
      getSandboxRunnerIdentityViolation(createSnapshot({ windowDestroyed: true }))
    ).not.toBeNull()

    expect(
      getSandboxRunnerIdentityViolation(createSnapshot({ windowVisible: true }))
    ).not.toBeNull()
  })

  it('rejects registry, session or window ownership mismatches', () => {
    expect(
      getSandboxRunnerIdentityViolation(createSnapshot({ sessionMatches: false }))
    ).not.toBeNull()

    expect(
      getSandboxRunnerIdentityViolation(
        createSnapshot({
          registeredWebContentsMatches: false
        })
      )
    ).not.toBeNull()

    expect(
      getSandboxRunnerIdentityViolation(
        createSnapshot({
          owningWindowMatches: false
        })
      )
    ).not.toBeNull()
  })

  it('rejects an unexpected document identity', () => {
    expect(
      getSandboxRunnerIdentityViolation(
        createSnapshot({
          mainFrameURL: 'afila-sandbox://runner/other.html'
        })
      )
    ).not.toBeNull()
  })

  it('rejects an unexpected frame hierarchy', () => {
    expect(
      getSandboxRunnerIdentityViolation(
        createSnapshot({
          frameCountInSubtree: 2
        })
      )
    ).not.toBeNull()

    expect(
      getSandboxRunnerIdentityViolation(
        createSnapshot({
          mainFrameHasParent: true
        })
      )
    ).not.toBeNull()
  })

  it('rejects mismatched process identifiers', () => {
    expect(
      getSandboxRunnerIdentityViolation(
        createSnapshot({
          mainFrameOSProcessId: identity.osProcessId + 1
        })
      )
    ).not.toBeNull()
  })

  it('rejects an identity changed after initialization', () => {
    expect(
      getSandboxRunnerIdentityViolation(
        createSnapshot({
          currentIdentity: {
            ...identity,
            frameToken: 'replacement-frame'
          }
        })
      )
    ).not.toBeNull()
  })

  it('rejects process collisions and uninspectable contents', () => {
    expect(
      getSandboxRunnerIdentityViolation(
        createSnapshot({
          collidingWebContentsIds: [19]
        })
      )
    ).not.toBeNull()

    expect(
      getSandboxRunnerIdentityViolation(
        createSnapshot({
          uninspectableWebContentsIds: [20]
        })
      )
    ).not.toBeNull()
  })
})
