import type { WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import {
  getSandboxRunnerBrowserCapabilityProbeViolation,
  runSandboxRunnerBrowserCapabilityProbe,
  SANDBOX_RUNNER_BROWSER_CAPABILITY_PROBE_MARKER,
  SANDBOX_RUNNER_BROWSER_CAPABILITY_PROBE_SOURCE,
  SANDBOX_RUNNER_BROWSER_CAPABILITY_PROBE_SOURCE_URL
} from './sandbox-runner-browser-capability-probe'
import { SANDBOX_RUNNER_ISOLATED_WORLD_ID } from './sandbox-runner-isolated-world-probe'

const safeReport = {
  marker: SANDBOX_RUNNER_BROWSER_CAPABILITY_PROBE_MARKER,
  fetchExternalConnected: false,
  fetchLoopbackConnected: false,
  xhrConnected: false,
  webSocketOpened: false,
  eventSourceOpened: false,
  workerAvailable: true,
  workerConstructed: true,
  workerStarted: false,
  sharedWorkerAvailable: true,
  sharedWorkerConstructed: true,
  sharedWorkerStarted: false,
  serviceWorkerAvailable: false,
  serviceWorkerRegistered: false,
  webTransportAvailable: true,
  webTransportReady: false,
  beaconAvailable: true,
  beaconQueued: false
}

describe('sandbox runner browser-capability probe', () => {
  it('accepts a bounded denial report', () => {
    expect(getSandboxRunnerBrowserCapabilityProbeViolation(JSON.stringify(safeReport))).toBeNull()
  })

  it('rejects a successful network connection', () => {
    expect(
      getSandboxRunnerBrowserCapabilityProbeViolation(
        JSON.stringify({
          ...safeReport,
          fetchLoopbackConnected: true
        })
      )
    ).not.toBeNull()
  })

  it('rejects execution of a Worker', () => {
    expect(
      getSandboxRunnerBrowserCapabilityProbeViolation(
        JSON.stringify({
          ...safeReport,
          workerStarted: true
        })
      )
    ).not.toBeNull()
  })

  it('rejects malformed and extended reports', () => {
    expect(getSandboxRunnerBrowserCapabilityProbeViolation('not-json')).not.toBeNull()

    expect(
      getSandboxRunnerBrowserCapabilityProbeViolation(
        JSON.stringify({
          ...safeReport,
          unexpected: true
        })
      )
    ).not.toBeNull()
  })

  it('executes the fixed source in world 1001', async () => {
    const executeJavaScriptInIsolatedWorld = vi.fn().mockResolvedValue(JSON.stringify(safeReport))

    const contents = {
      isDestroyed: () => false,
      isCrashed: () => false,
      executeJavaScriptInIsolatedWorld
    } as unknown as WebContents

    await expect(runSandboxRunnerBrowserCapabilityProbe(contents)).resolves.toBeUndefined()

    expect(executeJavaScriptInIsolatedWorld).toHaveBeenCalledExactlyOnceWith(
      SANDBOX_RUNNER_ISOLATED_WORLD_ID,
      [
        {
          code: SANDBOX_RUNNER_BROWSER_CAPABILITY_PROBE_SOURCE,
          url: SANDBOX_RUNNER_BROWSER_CAPABILITY_PROBE_SOURCE_URL
        }
      ],
      false
    )
  })

  it('rejects destroyed or crashed contents', async () => {
    const executeJavaScriptInIsolatedWorld = vi.fn()

    await expect(
      runSandboxRunnerBrowserCapabilityProbe({
        isDestroyed: () => true,
        isCrashed: () => false,
        executeJavaScriptInIsolatedWorld
      } as unknown as WebContents)
    ).rejects.toThrow('WebContents is destroyed')

    await expect(
      runSandboxRunnerBrowserCapabilityProbe({
        isDestroyed: () => false,
        isCrashed: () => true,
        executeJavaScriptInIsolatedWorld
      } as unknown as WebContents)
    ).rejects.toThrow('renderer process has crashed')

    expect(executeJavaScriptInIsolatedWorld).not.toHaveBeenCalled()
  })

  it('accepts a queued beacon without a successful connection', () => {
    expect(
      getSandboxRunnerBrowserCapabilityProbeViolation(
        JSON.stringify({
          ...safeReport,
          beaconAvailable: true,
          beaconQueued: true
        })
      )
    ).toBeNull()
  })
})
