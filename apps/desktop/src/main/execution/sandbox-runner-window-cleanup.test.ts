import type { BrowserWindow } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import {
  cleanupSandboxRunnerWindow,
  type SandboxRunnerSessionCleanupHandle
} from './sandbox-runner-window-cleanup'

function createSessionHandle(): {
  readonly sessionHandle: SandboxRunnerSessionCleanupHandle
  readonly dispose: ReturnType<typeof vi.fn>
  readonly invalidate: ReturnType<typeof vi.fn>
} {
  const dispose = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)

  const invalidate = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)

  return {
    sessionHandle: {
      dispose,
      invalidate
    },
    dispose,
    invalidate
  }
}

function createRunnerWindow(isDestroyed: () => boolean, destroy: () => void): BrowserWindow {
  return {
    isDestroyed,
    destroy
  } as unknown as BrowserWindow
}

describe('sandbox runner window cleanup', () => {
  it('disposes the reusable session after successful window destruction', async () => {
    const isDestroyed = vi.fn<() => boolean>().mockReturnValueOnce(false).mockReturnValue(true)

    const destroy = vi.fn<() => void>()

    const runnerWindow = createRunnerWindow(isDestroyed, destroy)

    const { sessionHandle, dispose, invalidate } = createSessionHandle()

    await expect(cleanupSandboxRunnerWindow(runnerWindow, sessionHandle, 'reuse')).resolves.toEqual(
      []
    )

    expect(destroy).toHaveBeenCalledTimes(1)

    expect(dispose).toHaveBeenCalledTimes(1)

    expect(invalidate).not.toHaveBeenCalled()
  })

  it('invalidates the session when window destruction throws', async () => {
    const destructionError = new Error('Simulated destruction failure.')

    const isDestroyed = vi.fn<() => boolean>().mockReturnValue(false)

    const destroy = vi.fn<() => void>(() => {
      throw destructionError
    })

    const runnerWindow = createRunnerWindow(isDestroyed, destroy)

    const { sessionHandle, dispose, invalidate } = createSessionHandle()

    const errors = await cleanupSandboxRunnerWindow(runnerWindow, sessionHandle, 'reuse')

    expect(errors).toEqual([destructionError])

    expect(destroy).toHaveBeenCalledTimes(1)

    expect(invalidate).toHaveBeenCalledTimes(1)

    expect(dispose).not.toHaveBeenCalled()
  })

  it('invalidates the session when the window remains alive after destruction', async () => {
    const isDestroyed = vi.fn<() => boolean>().mockReturnValue(false)

    const destroy = vi.fn<() => void>()

    const runnerWindow = createRunnerWindow(isDestroyed, destroy)

    const { sessionHandle, dispose, invalidate } = createSessionHandle()

    const errors = await cleanupSandboxRunnerWindow(runnerWindow, sessionHandle, 'reuse')

    expect(errors).toHaveLength(1)

    expect(errors[0]).toBeInstanceOf(Error)

    expect((errors[0] as Error).message).toBe(
      'The sandbox runner window remained alive after destruction.'
    )

    expect(destroy).toHaveBeenCalledTimes(1)

    expect(invalidate).toHaveBeenCalledTimes(1)

    expect(dispose).not.toHaveBeenCalled()
  })

  it('invalidates the session when invalidation mode is explicitly requested', async () => {
    const isDestroyed = vi.fn<() => boolean>().mockReturnValueOnce(false).mockReturnValue(true)

    const destroy = vi.fn<() => void>()

    const runnerWindow = createRunnerWindow(isDestroyed, destroy)

    const { sessionHandle, dispose, invalidate } = createSessionHandle()

    await expect(
      cleanupSandboxRunnerWindow(runnerWindow, sessionHandle, 'invalidate')
    ).resolves.toEqual([])

    expect(destroy).toHaveBeenCalledTimes(1)

    expect(invalidate).toHaveBeenCalledTimes(1)

    expect(dispose).not.toHaveBeenCalled()
  })
})
