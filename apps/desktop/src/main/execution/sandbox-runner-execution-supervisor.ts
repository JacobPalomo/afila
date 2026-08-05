export interface SandboxRunnerRendererGoneDetails {
  readonly reason: string
  readonly exitCode: number
}

export type SandboxRunnerExecutionTerminationReason =
  'timeout' | 'renderer-gone' | 'execution-failed' | 'monitor-failed' | 'cleanup-failed'

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

type SandboxRunnerRendererEvent =
  | {
      readonly type: 'renderer-gone'
      readonly details: SandboxRunnerRendererGoneDetails
    }
  | {
      readonly type: 'monitor-failed'
      readonly error: unknown
    }

interface SandboxRunnerTimeoutEvent {
  readonly type: 'timed-out'
}

type SandboxRunnerDisposalEvent =
  | {
      readonly type: 'disposed'
    }
  | {
      readonly type: 'dispose-failed'
      readonly error: unknown
    }

const defaultClock: SandboxRunnerExecutionSupervisorClock = {
  setTimeout: (callback: () => void, delayMs: number): unknown => {
    return setTimeout(callback, delayMs)
  },

  clearTimeout: (handle: unknown): void => {
    clearTimeout(handle as ReturnType<typeof setTimeout>)
  }
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

function assertNever(value: never): never {
  throw new Error(`Unexpected sandbox runner event: ${JSON.stringify(value)}`)
}

async function terminateAfterFailure<T>(
  terminate: SuperviseSandboxRunnerExecutionOptions<unknown>['terminate'],
  reason: SandboxRunnerExecutionTerminationReason,
  originalError: unknown
): Promise<SandboxRunnerExecutionOutcome<T>> {
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

async function terminateAfterRendererGone<T>(
  terminate: SuperviseSandboxRunnerExecutionOptions<unknown>['terminate'],
  details: SandboxRunnerRendererGoneDetails
): Promise<SandboxRunnerExecutionOutcome<T>> {
  try {
    await terminate('renderer-gone')
  } catch (error) {
    return {
      status: 'failed',
      error
    }
  }

  return {
    status: 'renderer-gone',
    details
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
      (value): SandboxRunnerExecutionEvent<T> => ({
        type: 'completed',
        value
      }),
      (error): SandboxRunnerExecutionEvent<T> => ({
        type: 'execution-failed',
        error
      })
    )

  const rendererEvent: Promise<SandboxRunnerRendererEvent> = Promise.resolve()
    .then(options.waitForRendererGone)
    .then(
      (details): SandboxRunnerRendererEvent => ({
        type: 'renderer-gone',
        details
      }),
      (error): SandboxRunnerRendererEvent => ({
        type: 'monitor-failed',
        error
      })
    )

  let timeoutHandle: unknown = null

  const timeoutEvent = new Promise<SandboxRunnerTimeoutEvent>((resolve) => {
    timeoutHandle = clock.setTimeout(() => {
      resolve({
        type: 'timed-out'
      })
    }, options.timeoutMs)
  })

  const initialEvent = await Promise.race([executionEvent, rendererEvent, timeoutEvent])

  clock.clearTimeout(timeoutHandle)

  if (initialEvent.type === 'completed') {
    const disposalEvent: Promise<SandboxRunnerDisposalEvent> = Promise.resolve()
      .then(options.dispose)
      .then(
        (): SandboxRunnerDisposalEvent => ({
          type: 'disposed'
        }),
        (error): SandboxRunnerDisposalEvent => ({
          type: 'dispose-failed',
          error
        })
      )

    /*
     * Keep monitoring the renderer until reusable
     * cleanup has completed. A crash during cleanup
     * must elevate the in-flight cleanup to
     * invalidation.
     */
    const finalizationEvent = await Promise.race([disposalEvent, rendererEvent])

    switch (finalizationEvent.type) {
      case 'disposed':
        return {
          status: 'completed',
          value: initialEvent.value
        }

      case 'renderer-gone':
        return terminateAfterRendererGone(options.terminate, finalizationEvent.details)

      case 'monitor-failed':
        return terminateAfterFailure(options.terminate, 'monitor-failed', finalizationEvent.error)

      case 'dispose-failed':
        return terminateAfterFailure(options.terminate, 'cleanup-failed', finalizationEvent.error)

      default:
        return assertNever(finalizationEvent)
    }
  }

  switch (initialEvent.type) {
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

    case 'renderer-gone':
      return terminateAfterRendererGone(options.terminate, initialEvent.details)

    case 'execution-failed':
      return terminateAfterFailure(options.terminate, 'execution-failed', initialEvent.error)

    case 'monitor-failed':
      return terminateAfterFailure(options.terminate, 'monitor-failed', initialEvent.error)

    default:
      return assertNever(initialEvent)
  }
}
