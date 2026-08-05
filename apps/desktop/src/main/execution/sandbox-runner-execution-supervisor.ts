export interface SandboxRunnerRendererGoneDetails {
  readonly reason: string
  readonly exitCode: number
}

export type SandboxRunnerExecutionTerminationReason =
  'timeout' | 'renderer-gone' | 'execution-failed' | 'monitor-failed'

export type SandboxRunnerExecutionOutcome<T> =
  | {
      readonly status: 'completed'
      readonly value: T
    }
  | {
      readonly status: 'timed-out'
    }
  | {
      readonly status: 'renderer-gone'
      readonly details: SandboxRunnerRendererGoneDetails
    }
  | {
      readonly status: 'failed'
      readonly error: unknown
    }

export interface SandboxRunnerExecutionSupervisorClock {
  setTimeout(callback: () => void, delayMs: number): unknown

  clearTimeout(handle: unknown): void
}

export interface SuperviseSandboxRunnerExecutionOptions<T> {
  readonly timeoutMs: number

  readonly execute: () => Promise<T>

  readonly waitForRendererGone: () => Promise<SandboxRunnerRendererGoneDetails>

  readonly dispose: () => Promise<void>

  readonly terminate: (reason: SandboxRunnerExecutionTerminationReason) => Promise<void>

  readonly clock?: SandboxRunnerExecutionSupervisorClock
}

type SandboxRunnerExecutionEvent<T> =
  | {
      readonly type: 'completed'
      readonly value: T
    }
  | {
      readonly type: 'execution-failed'
      readonly error: unknown
    }
  | {
      readonly type: 'timed-out'
    }
  | {
      readonly type: 'renderer-gone'
      readonly details: SandboxRunnerRendererGoneDetails
    }
  | {
      readonly type: 'monitor-failed'
      readonly error: unknown
    }

const defaultClock: SandboxRunnerExecutionSupervisorClock = {
  setTimeout: (callback: () => void, delayMs: number): unknown => setTimeout(callback, delayMs),

  clearTimeout: (handle: unknown): void => {
    clearTimeout(handle as ReturnType<typeof setTimeout>)
  }
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

async function terminateAfterFailure(
  terminate: SuperviseSandboxRunnerExecutionOptions<unknown>['terminate'],
  reason: SandboxRunnerExecutionTerminationReason,
  originalError: unknown
): Promise<SandboxRunnerExecutionOutcome<never>> {
  try {
    await terminate(reason)
  } catch (terminationError) {
    return {
      status: 'failed',
      error: new AggregateError(
        [originalError, terminationError],
        'The sandbox runner failed and could not be terminated completely.'
      )
    }
  }

  return {
    status: 'failed',
    error: originalError
  }
}

export async function superviseSandboxRunnerExecution<T>(
  options: SuperviseSandboxRunnerExecutionOptions<T>
): Promise<SandboxRunnerExecutionOutcome<T>> {
  if (!isPositiveSafeInteger(options.timeoutMs)) {
    throw new RangeError('The sandbox runner execution timeout must be a positive safe integer.')
  }

  const clock = options.clock ?? defaultClock

  const executionEvent: Promise<SandboxRunnerExecutionEvent<T>> = Promise.resolve()
    .then(options.execute)
    .then(
      (value) => ({
        type: 'completed',
        value
      }),
      (error) => ({
        type: 'execution-failed',
        error
      })
    )

  const rendererGoneEvent: Promise<SandboxRunnerExecutionEvent<T>> = Promise.resolve()
    .then(options.waitForRendererGone)
    .then(
      (details) => ({
        type: 'renderer-gone',
        details
      }),
      (error) => ({
        type: 'monitor-failed',
        error
      })
    )

  let timeoutHandle: unknown = null

  const timeoutEvent = new Promise<SandboxRunnerExecutionEvent<T>>((resolve) => {
    timeoutHandle = clock.setTimeout(() => {
      resolve({
        type: 'timed-out'
      })
    }, options.timeoutMs)
  })

  const event = await Promise.race([executionEvent, rendererGoneEvent, timeoutEvent])

  clock.clearTimeout(timeoutHandle)

  switch (event.type) {
    case 'completed': {
      try {
        await options.dispose()
      } catch (error) {
        return {
          status: 'failed',
          error
        }
      }

      return {
        status: 'completed',
        value: event.value
      }
    }

    case 'timed-out': {
      try {
        await options.terminate('timeout')
      } catch (error) {
        return {
          status: 'failed',
          error
        }
      }

      return {
        status: 'timed-out'
      }
    }

    case 'renderer-gone': {
      try {
        await options.terminate('renderer-gone')
      } catch (error) {
        return {
          status: 'failed',
          error
        }
      }

      return {
        status: 'renderer-gone',
        details: event.details
      }
    }

    case 'execution-failed':
      return terminateAfterFailure(options.terminate, 'execution-failed', event.error)

    case 'monitor-failed':
      return terminateAfterFailure(options.terminate, 'monitor-failed', event.error)
  }
}
