import { describe, expect, it, vi } from 'vitest'
import {
  superviseSandboxRunnerExecution,
  type SandboxRunnerExecutionSupervisorClock,
  type SandboxRunnerRendererGoneDetails
} from './sandbox-runner-execution-supervisor'

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

function createManualClock(): {
  readonly clock: SandboxRunnerExecutionSupervisorClock
  triggerTimeout(): void
  readonly setTimeoutMock: ReturnType<typeof vi.fn>
  readonly clearTimeoutMock: ReturnType<typeof vi.fn>
} {
  let callback: (() => void) | null = null

  const timeoutHandle = Symbol('timeout-handle')

  const setTimeoutMock = vi.fn((nextCallback: () => void, delayMs: number): unknown => {
    void delayMs

    callback = nextCallback

    return timeoutHandle
  })

  const clearTimeoutMock = vi.fn((handle: unknown): void => {
    void handle
  })

  return {
    clock: {
      setTimeout: setTimeoutMock,
      clearTimeout: clearTimeoutMock
    },

    triggerTimeout: (): void => {
      if (callback === null) {
        throw new Error('The timeout was not registered.')
      }

      callback()
    },

    setTimeoutMock,
    clearTimeoutMock
  }
}

function createNeverSettlingPromise<T>(): Promise<T> {
  return new Promise<T>(() => undefined)
}

describe('sandbox runner execution supervisor', () => {
  it('disposes after normal completion', async () => {
    const { clock, clearTimeoutMock } = createManualClock()

    const dispose = vi.fn(async (): Promise<void> => undefined)

    const terminate = vi.fn(async (): Promise<void> => undefined)

    const outcome = await superviseSandboxRunnerExecution({
      timeoutMs: 100,
      execute: async () => 'result',
      waitForRendererGone: () => createNeverSettlingPromise(),
      dispose,
      terminate,
      clock
    })

    expect(outcome).toEqual({
      status: 'completed',
      value: 'result'
    })

    expect(dispose).toHaveBeenCalledTimes(1)

    expect(terminate).not.toHaveBeenCalled()

    expect(clearTimeoutMock).toHaveBeenCalledTimes(1)
  })

  it('terminates after the external timeout', async () => {
    const { clock, triggerTimeout } = createManualClock()

    const dispose = vi.fn(async (): Promise<void> => undefined)

    const terminate = vi.fn(async (): Promise<void> => undefined)

    const supervision = superviseSandboxRunnerExecution({
      timeoutMs: 100,
      execute: () => createNeverSettlingPromise(),
      waitForRendererGone: () => createNeverSettlingPromise(),
      dispose,
      terminate,
      clock
    })

    triggerTimeout()

    await expect(supervision).resolves.toEqual({
      status: 'timed-out'
    })

    expect(terminate).toHaveBeenCalledTimes(1)

    expect(terminate).toHaveBeenCalledWith('timeout')

    expect(dispose).not.toHaveBeenCalled()
  })

  it('terminates when the renderer disappears', async () => {
    const { clock } = createManualClock()

    const rendererGone = createDeferred<SandboxRunnerRendererGoneDetails>()

    const terminate = vi.fn(async (): Promise<void> => undefined)

    const supervision = superviseSandboxRunnerExecution({
      timeoutMs: 100,
      execute: () => createNeverSettlingPromise(),
      waitForRendererGone: () => rendererGone.promise,
      dispose: async () => undefined,
      terminate,
      clock
    })

    rendererGone.resolve({
      reason: 'crashed',
      exitCode: 9
    })

    await expect(supervision).resolves.toEqual({
      status: 'renderer-gone',
      details: {
        reason: 'crashed',
        exitCode: 9
      }
    })

    expect(terminate).toHaveBeenCalledWith('renderer-gone')
  })

  it('ignores a result delivered after timeout', async () => {
    const { clock, triggerTimeout } = createManualClock()

    const execution = createDeferred<string>()

    const dispose = vi.fn(async (): Promise<void> => undefined)

    const terminate = vi.fn(async (): Promise<void> => undefined)

    const supervision = superviseSandboxRunnerExecution({
      timeoutMs: 100,
      execute: () => execution.promise,
      waitForRendererGone: () => createNeverSettlingPromise(),
      dispose,
      terminate,
      clock
    })

    triggerTimeout()

    await expect(supervision).resolves.toEqual({
      status: 'timed-out'
    })

    execution.resolve('late-result')

    await Promise.resolve()

    expect(terminate).toHaveBeenCalledTimes(1)

    expect(dispose).not.toHaveBeenCalled()
  })

  it('terminates after execution failure', async () => {
    const { clock } = createManualClock()

    const executionError = new Error('Simulated execution failure.')

    const terminate = vi.fn(async (): Promise<void> => undefined)

    const outcome = await superviseSandboxRunnerExecution({
      timeoutMs: 100,
      execute: async () => {
        throw executionError
      },
      waitForRendererGone: () => createNeverSettlingPromise(),
      dispose: async () => undefined,
      terminate,
      clock
    })

    expect(outcome).toEqual({
      status: 'failed',
      error: executionError
    })

    expect(terminate).toHaveBeenCalledWith('execution-failed')
  })

  it('aggregates execution and termination failures', async () => {
    const { clock } = createManualClock()

    const executionError = new Error('Execution failure.')

    const terminationError = new Error('Termination failure.')

    const outcome = await superviseSandboxRunnerExecution({
      timeoutMs: 100,
      execute: async () => {
        throw executionError
      },
      waitForRendererGone: () => createNeverSettlingPromise(),
      dispose: async () => undefined,
      terminate: async () => {
        throw terminationError
      },
      clock
    })

    expect(outcome.status).toBe('failed')

    if (outcome.status !== 'failed') {
      throw new Error('Expected a failed outcome.')
    }

    expect(outcome.error).toBeInstanceOf(AggregateError)

    expect((outcome.error as AggregateError).errors).toEqual([executionError, terminationError])
  })

  it('rejects invalid timeout values', async () => {
    await expect(
      superviseSandboxRunnerExecution({
        timeoutMs: 0,
        execute: async () => undefined,
        waitForRendererGone: () => createNeverSettlingPromise(),
        dispose: async () => undefined,
        terminate: async () => undefined
      })
    ).rejects.toThrow('execution timeout')
  })
})
