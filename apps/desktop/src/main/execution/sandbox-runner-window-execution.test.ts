import { EventEmitter } from 'node:events'
import type { BrowserWindow, WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import type { SandboxRunnerExecutionSupervisorClock } from './sandbox-runner-execution-supervisor'
import type { SandboxRunnerWindowHandle } from './sandbox-runner-window'
import { runSandboxRunnerWindowExecution } from './sandbox-runner-window-execution'

class FakeWebContents extends EventEmitter {
  destroyed = false
  crashed = false
  forceCrashCalls = 0

  isDestroyed(): boolean {
    return this.destroyed
  }

  isCrashed(): boolean {
    return this.crashed
  }

  forcefullyCrashRenderer(): void {
    this.forceCrashCalls += 1
    this.crashed = true
  }
}

function createManualClock(): {
  readonly clock: SandboxRunnerExecutionSupervisorClock
  triggerTimeout(): void
} {
  let callback: (() => void) | null = null

  const clock: SandboxRunnerExecutionSupervisorClock = {
    setTimeout: (nextCallback: () => void, delayMs: number): unknown => {
      void delayMs

      callback = nextCallback

      return Symbol('timeout')
    },

    clearTimeout: (handle: unknown): void => {
      void handle
    }
  }

  return {
    clock,

    triggerTimeout: (): void => {
      if (callback === null) {
        throw new Error('The timeout was not registered.')
      }

      callback()
    }
  }
}

interface Deferred<T> {
  readonly promise: Promise<T>
  resolve(value: T): void
  reject(error: unknown): void
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: (value: T) => void = () => undefined

  let rejectPromise: (error: unknown) => void = () => undefined

  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise
  }
}

function createNeverSettlingPromise<T>(): Promise<T> {
  return new Promise<T>(() => undefined)
}

function createHandle(contents: FakeWebContents): {
  readonly handle: SandboxRunnerWindowHandle
  readonly dispose: ReturnType<typeof vi.fn>
  readonly invalidate: ReturnType<typeof vi.fn>
} {
  const dispose = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)

  const invalidate = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)

  const window = {
    webContents: contents as unknown as WebContents
  } as unknown as BrowserWindow

  const handle = {
    window,

    session: {},

    identity: {
      webContentsId: 1,
      frameTreeNodeId: 2,
      frameToken: 'token',
      chromiumProcessId: 3,
      osProcessId: 4
    },

    assertReadyForExecution: vi.fn(() => ({
      webContentsId: 1,
      frameTreeNodeId: 2,
      frameToken: 'token',
      chromiumProcessId: 3,
      osProcessId: 4
    })),

    dispose,
    invalidate
  } as unknown as SandboxRunnerWindowHandle

  return {
    handle,
    dispose,
    invalidate
  }
}

describe('sandbox runner window execution', () => {
  it('disposes the runner after successful execution', async () => {
    const contents = new FakeWebContents()

    const { handle, dispose, invalidate } = createHandle(contents)

    const outcome = await runSandboxRunnerWindowExecution({
      handle,
      timeoutMs: 100,
      execute: async () => 'completed'
    })

    expect(outcome).toEqual({
      status: 'completed',
      value: 'completed'
    })

    expect(dispose).toHaveBeenCalledTimes(1)

    expect(invalidate).not.toHaveBeenCalled()

    expect(contents.forceCrashCalls).toBe(0)

    expect(contents.listenerCount('render-process-gone')).toBe(0)
  })

  it('forcefully terminates and invalidates after timeout', async () => {
    const contents = new FakeWebContents()

    const { handle, dispose, invalidate } = createHandle(contents)

    const { clock, triggerTimeout } = createManualClock()

    const execution = runSandboxRunnerWindowExecution({
      handle,
      timeoutMs: 100,
      execute: () => createNeverSettlingPromise(),
      clock
    })

    triggerTimeout()

    await expect(execution).resolves.toEqual({
      status: 'timed-out'
    })

    expect(contents.forceCrashCalls).toBe(1)

    expect(invalidate).toHaveBeenCalledTimes(1)

    expect(dispose).not.toHaveBeenCalled()

    expect(contents.listenerCount('render-process-gone')).toBe(0)
  })

  it('invalidates without crashing an already gone renderer', async () => {
    const contents = new FakeWebContents()

    const { handle, invalidate } = createHandle(contents)

    const execution = runSandboxRunnerWindowExecution({
      handle,
      timeoutMs: 100,
      execute: () => createNeverSettlingPromise()
    })

    contents.crashed = true

    contents.emit(
      'render-process-gone',
      {},
      {
        reason: 'crashed',
        exitCode: 9
      }
    )

    await expect(execution).resolves.toEqual({
      status: 'renderer-gone',
      details: {
        reason: 'crashed',
        exitCode: 9
      }
    })

    expect(contents.forceCrashCalls).toBe(0)

    expect(invalidate).toHaveBeenCalledTimes(1)

    expect(contents.listenerCount('render-process-gone')).toBe(0)
  })

  it('still invalidates when forceful termination throws', async () => {
    const contents = new FakeWebContents()

    contents.forcefullyCrashRenderer = (): void => {
      throw new Error('Simulated crash failure.')
    }

    const { handle, invalidate } = createHandle(contents)

    const { clock, triggerTimeout } = createManualClock()

    const execution = runSandboxRunnerWindowExecution({
      handle,
      timeoutMs: 100,
      execute: () => createNeverSettlingPromise(),
      clock
    })

    triggerTimeout()

    const outcome = await execution

    expect(outcome.status).toBe('failed')

    expect(invalidate).toHaveBeenCalledTimes(1)

    if (outcome.status !== 'failed') {
      throw new Error('Expected a failed outcome.')
    }

    expect(outcome.error).toBeInstanceOf(AggregateError)
  })

  it('invalidates when post-execution validation fails', async () => {
    const contents = new FakeWebContents()

    const { handle, dispose, invalidate } = createHandle(contents)

    const validationError = new Error('Simulated post-execution validation failure.')

    const assertReadyForExecution = vi.mocked(handle.assertReadyForExecution)

    assertReadyForExecution
      .mockReturnValueOnce(handle.identity)
      .mockReturnValueOnce(handle.identity)
      .mockImplementationOnce(() => {
        throw validationError
      })

    const outcome = await runSandboxRunnerWindowExecution({
      handle,
      timeoutMs: 100,
      execute: async () => 'untrusted-result'
    })

    expect(outcome).toEqual({
      status: 'failed',
      error: validationError
    })

    expect(invalidate).toHaveBeenCalledTimes(1)

    expect(dispose).not.toHaveBeenCalled()
  })

  it('escalates disposal when the renderer disappears during cleanup', async () => {
    const contents = new FakeWebContents()

    const { handle, dispose, invalidate } = createHandle(contents)

    const cleanup = createDeferred<void>()

    const disposeStarted = createDeferred<void>()

    const invalidationStarted = createDeferred<void>()

    dispose.mockImplementation((): Promise<void> => {
      disposeStarted.resolve()

      return cleanup.promise
    })

    /*
     * The real handle returns the same cleanup
     * promise when invalidate() escalates an
     * already-running dispose().
     */
    invalidate.mockImplementation((): Promise<void> => {
      invalidationStarted.resolve()

      return cleanup.promise
    })

    const execution = runSandboxRunnerWindowExecution({
      handle,
      timeoutMs: 100,
      execute: async () => 'completed'
    })

    await disposeStarted.promise

    contents.crashed = true

    contents.emit(
      'render-process-gone',
      {},
      {
        reason: 'crashed',
        exitCode: 9
      }
    )

    /*
     * Do not assume a fixed number of microtasks.
     * Wait for the observable escalation instead.
     */
    await invalidationStarted.promise

    expect(invalidate).toHaveBeenCalledTimes(1)

    cleanup.resolve()

    await expect(execution).resolves.toEqual({
      status: 'renderer-gone',
      details: {
        reason: 'crashed',
        exitCode: 9
      }
    })

    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('ignores renderer events delivered after successful disposal', async () => {
    const contents = new FakeWebContents()

    const { handle, invalidate } = createHandle(contents)

    await expect(
      runSandboxRunnerWindowExecution({
        handle,
        timeoutMs: 100,
        execute: async () => 'completed'
      })
    ).resolves.toEqual({
      status: 'completed',
      value: 'completed'
    })

    expect(contents.listenerCount('render-process-gone')).toBe(0)

    contents.crashed = true

    contents.emit(
      'render-process-gone',
      {},
      {
        reason: 'crashed',
        exitCode: 9
      }
    )

    await Promise.resolve()

    expect(invalidate).not.toHaveBeenCalled()
  })
})
