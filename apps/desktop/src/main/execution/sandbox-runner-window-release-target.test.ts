import type { BrowserWindow } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { captureSandboxRunnerWindowReleaseTarget } from './sandbox-runner-window-release-target'

const IDENTITY = {
  webContentsId: 1,
  frameTreeNodeId: 2,
  frameToken: 'token',
  chromiumProcessId: 3,
  osProcessId: 4
} as const

describe('sandbox runner window release target', () => {
  it('invalidates the runner when process capture fails', async () => {
    const captureError = new Error('Simulated process capture failure.')

    const isDestroyed = vi.fn<() => boolean>().mockReturnValueOnce(false).mockReturnValue(true)

    const destroy = vi.fn<() => void>()

    const runnerWindow = {
      isDestroyed,
      destroy
    } as unknown as BrowserWindow

    const dispose = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)

    const invalidate = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)

    const captureTarget = vi.fn(() => {
      throw captureError
    })

    await expect(
      captureSandboxRunnerWindowReleaseTarget(
        runnerWindow,
        IDENTITY,
        {
          dispose,
          invalidate
        },
        captureTarget
      )
    ).rejects.toBe(captureError)

    expect(destroy).toHaveBeenCalledTimes(1)

    expect(invalidate).toHaveBeenCalledTimes(1)

    expect(dispose).not.toHaveBeenCalled()
  })

  it('aggregates capture and invalidation failures', async () => {
    const captureError = new Error('Capture failure.')

    const invalidationError = new Error('Invalidation failure.')

    const runnerWindow = {
      isDestroyed: vi.fn<() => boolean>().mockReturnValue(true),

      destroy: vi.fn<() => void>()
    } as unknown as BrowserWindow

    const outcome = captureSandboxRunnerWindowReleaseTarget(
      runnerWindow,
      IDENTITY,
      {
        dispose: async () => undefined,

        invalidate: async () => {
          throw invalidationError
        }
      },
      () => {
        throw captureError
      }
    )

    await expect(outcome).rejects.toBeInstanceOf(AggregateError)

    try {
      await outcome
    } catch (error) {
      expect((error as AggregateError).errors).toEqual([captureError, invalidationError])
    }
  })
})
