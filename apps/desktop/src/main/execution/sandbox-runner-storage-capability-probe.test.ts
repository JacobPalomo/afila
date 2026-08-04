import type { WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { SANDBOX_RUNNER_ISOLATED_WORLD_ID } from './sandbox-runner-isolated-world-probe'
import {
  getSandboxRunnerStorageCapabilityProbeViolation,
  runSandboxRunnerStorageCapabilityProbe,
  SANDBOX_RUNNER_STORAGE_CAPABILITY_PROBE_MARKER,
  SANDBOX_RUNNER_STORAGE_CAPABILITY_PROBE_SOURCE,
  SANDBOX_RUNNER_STORAGE_CAPABILITY_PROBE_SOURCE_URL
} from './sandbox-runner-storage-capability-probe'

const safeReport = {
  marker: SANDBOX_RUNNER_STORAGE_CAPABILITY_PROBE_MARKER,
  localStorageWritable: false,
  sessionStorageWritable: false,
  indexedDBWritable: false,
  cacheStorageWritable: false,
  documentCookieWritable: false,
  originPrivateFileSystemWritable: false
}

describe('sandbox runner storage-capability probe', () => {
  it('accepts a complete storage-denial report', () => {
    expect(getSandboxRunnerStorageCapabilityProbeViolation(JSON.stringify(safeReport))).toBeNull()
  })

  it('rejects every writable storage channel', () => {
    for (const key of [
      'localStorageWritable',
      'sessionStorageWritable',
      'indexedDBWritable',
      'cacheStorageWritable',
      'documentCookieWritable',
      'originPrivateFileSystemWritable'
    ] as const) {
      expect(
        getSandboxRunnerStorageCapabilityProbeViolation(
          JSON.stringify({
            ...safeReport,
            [key]: true
          })
        )
      ).not.toBeNull()
    }
  })

  it('rejects malformed and extended reports', () => {
    expect(getSandboxRunnerStorageCapabilityProbeViolation('not-json')).not.toBeNull()

    expect(
      getSandboxRunnerStorageCapabilityProbeViolation(
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

    await expect(runSandboxRunnerStorageCapabilityProbe(contents)).resolves.toBeUndefined()

    expect(executeJavaScriptInIsolatedWorld).toHaveBeenCalledExactlyOnceWith(
      SANDBOX_RUNNER_ISOLATED_WORLD_ID,
      [
        {
          code: SANDBOX_RUNNER_STORAGE_CAPABILITY_PROBE_SOURCE,
          url: SANDBOX_RUNNER_STORAGE_CAPABILITY_PROBE_SOURCE_URL
        }
      ],
      false
    )
  })

  it('rejects an unexpected runtime result', async () => {
    const contents = {
      isDestroyed: () => false,
      isCrashed: () => false,
      executeJavaScriptInIsolatedWorld: vi.fn().mockResolvedValue(
        JSON.stringify({
          ...safeReport,
          indexedDBWritable: true
        })
      )
    } as unknown as WebContents

    await expect(runSandboxRunnerStorageCapabilityProbe(contents)).rejects.toThrow(
      'indexedDBWritable'
    )
  })

  it('rejects destroyed or crashed contents', async () => {
    const executeJavaScriptInIsolatedWorld = vi.fn()

    await expect(
      runSandboxRunnerStorageCapabilityProbe({
        isDestroyed: () => true,
        isCrashed: () => false,
        executeJavaScriptInIsolatedWorld
      } as unknown as WebContents)
    ).rejects.toThrow('WebContents is destroyed')

    await expect(
      runSandboxRunnerStorageCapabilityProbe({
        isDestroyed: () => false,
        isCrashed: () => true,
        executeJavaScriptInIsolatedWorld
      } as unknown as WebContents)
    ).rejects.toThrow('renderer process has crashed')

    expect(executeJavaScriptInIsolatedWorld).not.toHaveBeenCalled()
  })
})
