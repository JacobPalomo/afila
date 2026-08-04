import type { WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { SANDBOX_RUNNER_ISOLATED_WORLD_ID } from './sandbox-runner-isolated-world-probe'
import {
  getSandboxRunnerWebRTCLockdownViolation,
  runSandboxRunnerWebRTCLockdown,
  SANDBOX_RUNNER_WEBRTC_GLOBAL_NAMES,
  SANDBOX_RUNNER_WEBRTC_LOCKDOWN_EXPECTED_RESULT,
  SANDBOX_RUNNER_WEBRTC_LOCKDOWN_SOURCE,
  SANDBOX_RUNNER_WEBRTC_LOCKDOWN_SOURCE_URL
} from './sandbox-runner-webrtc-lockdown'

describe('sandbox runner WebRTC lockdown', () => {
  it('covers every WebRTC constructor entry point', () => {
    expect(SANDBOX_RUNNER_WEBRTC_GLOBAL_NAMES).toEqual([
      'RTCPeerConnection',
      'webkitRTCPeerConnection',
      'mozRTCPeerConnection',
      'RTCDataChannel'
    ])
  })

  it('accepts only the exact lockdown result', () => {
    expect(
      getSandboxRunnerWebRTCLockdownViolation(SANDBOX_RUNNER_WEBRTC_LOCKDOWN_EXPECTED_RESULT)
    ).toBeNull()
  })

  it('rejects a configurable WebRTC global', () => {
    const alteredResult = SANDBOX_RUNNER_WEBRTC_LOCKDOWN_EXPECTED_RESULT.replace(
      '"configurable":false',
      '"configurable":true'
    )

    expect(getSandboxRunnerWebRTCLockdownViolation(alteredResult)).not.toBeNull()
  })

  it('executes the fixed lockdown in world 1001', async () => {
    const executeJavaScriptInIsolatedWorld = vi
      .fn()
      .mockResolvedValue(SANDBOX_RUNNER_WEBRTC_LOCKDOWN_EXPECTED_RESULT)

    const contents = {
      isDestroyed: () => false,
      isCrashed: () => false,
      executeJavaScriptInIsolatedWorld
    } as unknown as WebContents

    await expect(runSandboxRunnerWebRTCLockdown(contents)).resolves.toBeUndefined()

    expect(executeJavaScriptInIsolatedWorld).toHaveBeenCalledExactlyOnceWith(
      SANDBOX_RUNNER_ISOLATED_WORLD_ID,
      [
        {
          code: SANDBOX_RUNNER_WEBRTC_LOCKDOWN_SOURCE,
          url: SANDBOX_RUNNER_WEBRTC_LOCKDOWN_SOURCE_URL
        }
      ],
      false
    )
  })

  it('rejects an unexpected runtime result', async () => {
    const contents = {
      isDestroyed: () => false,
      isCrashed: () => false,
      executeJavaScriptInIsolatedWorld: vi.fn().mockResolvedValue('unexpected')
    } as unknown as WebContents

    await expect(runSandboxRunnerWebRTCLockdown(contents)).rejects.toThrow(
      'returned an unexpected result'
    )
  })

  it('rejects destroyed or crashed contents', async () => {
    const executeJavaScriptInIsolatedWorld = vi.fn()

    await expect(
      runSandboxRunnerWebRTCLockdown({
        isDestroyed: () => true,
        isCrashed: () => false,
        executeJavaScriptInIsolatedWorld
      } as unknown as WebContents)
    ).rejects.toThrow('WebContents is destroyed')

    await expect(
      runSandboxRunnerWebRTCLockdown({
        isDestroyed: () => false,
        isCrashed: () => true,
        executeJavaScriptInIsolatedWorld
      } as unknown as WebContents)
    ).rejects.toThrow('renderer process has crashed')

    expect(executeJavaScriptInIsolatedWorld).not.toHaveBeenCalled()
  })
})
