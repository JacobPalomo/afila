import type { WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import {
  getSandboxRunnerIsolatedWorldProbeViolation,
  runSandboxRunnerIsolatedWorldProbe,
  SANDBOX_RUNNER_ISOLATED_WORLD_ID,
  SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_EXPECTED_RESULT,
  SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_SOURCE,
  SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_SOURCE_URL
} from './sandbox-runner-isolated-world-probe'

describe('sandbox runner isolated-world probe', () => {
  it('uses a dedicated non-Electron world identifier', () => {
    expect(SANDBOX_RUNNER_ISOLATED_WORLD_ID).toBe(1001)

    expect(SANDBOX_RUNNER_ISOLATED_WORLD_ID).toBeGreaterThan(999)

    expect(SANDBOX_RUNNER_ISOLATED_WORLD_ID).toBeLessThan(1 << 20)
  })

  it('accepts only the exact expected result', () => {
    expect(
      getSandboxRunnerIsolatedWorldProbeViolation(
        SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_EXPECTED_RESULT
      )
    ).toBeNull()
  })

  it('rejects unsupported and oversized results', () => {
    expect(getSandboxRunnerIsolatedWorldProbeViolation(undefined)).not.toBeNull()

    expect(getSandboxRunnerIsolatedWorldProbeViolation('x'.repeat(1_025))).not.toBeNull()
  })

  it('rejects an altered capability result', () => {
    const alteredResult = SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_EXPECTED_RESULT.replace(
      '"processType":"undefined"',
      '"processType":"object"'
    )

    expect(getSandboxRunnerIsolatedWorldProbeViolation(alteredResult)).not.toBeNull()
  })

  it('executes the fixed source in the dedicated world', async () => {
    const executeJavaScriptInIsolatedWorld = vi
      .fn()
      .mockResolvedValue(SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_EXPECTED_RESULT)

    const contents = {
      isDestroyed: () => false,
      isCrashed: () => false,
      executeJavaScriptInIsolatedWorld
    } as unknown as WebContents

    await expect(runSandboxRunnerIsolatedWorldProbe(contents)).resolves.toBeUndefined()

    expect(executeJavaScriptInIsolatedWorld).toHaveBeenCalledExactlyOnceWith(
      SANDBOX_RUNNER_ISOLATED_WORLD_ID,
      [
        {
          code: SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_SOURCE,
          url: SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_SOURCE_URL
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

    await expect(runSandboxRunnerIsolatedWorldProbe(contents)).rejects.toThrow(
      'returned an unexpected result'
    )
  })

  it('rejects destroyed or crashed contents', async () => {
    const executeJavaScriptInIsolatedWorld = vi.fn()

    const destroyedContents = {
      isDestroyed: () => true,
      isCrashed: () => false,
      executeJavaScriptInIsolatedWorld
    } as unknown as WebContents

    await expect(runSandboxRunnerIsolatedWorldProbe(destroyedContents)).rejects.toThrow(
      'WebContents is destroyed'
    )

    const crashedContents = {
      isDestroyed: () => false,
      isCrashed: () => true,
      executeJavaScriptInIsolatedWorld
    } as unknown as WebContents

    await expect(runSandboxRunnerIsolatedWorldProbe(crashedContents)).rejects.toThrow(
      'renderer process has crashed'
    )

    expect(executeJavaScriptInIsolatedWorld).not.toHaveBeenCalled()
  })
})
