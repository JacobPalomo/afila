import type { WebContents } from 'electron'
import {
  superviseSandboxRunnerExecution,
  type SandboxRunnerExecutionOutcome,
  type SandboxRunnerExecutionSupervisorClock,
  type SandboxRunnerExecutionTerminationReason
} from './sandbox-runner-execution-supervisor'
import { createSandboxRunnerRendererGoneMonitor } from './sandbox-runner-renderer-gone-monitor'
import type { SandboxRunnerWindowHandle } from './sandbox-runner-window'

export interface RunSandboxRunnerWindowExecutionOptions<T> {
  readonly handle: SandboxRunnerWindowHandle

  readonly timeoutMs: number

  readonly execute: (contents: WebContents) => Promise<T>

  readonly clock?: SandboxRunnerExecutionSupervisorClock
}

async function terminateSandboxRunnerWindow(
  handle: SandboxRunnerWindowHandle,
  contents: WebContents,
  reason: SandboxRunnerExecutionTerminationReason,
  stopMonitoring: () => void
): Promise<void> {
  const errors: unknown[] = []

  stopMonitoring()

  if (reason !== 'renderer-gone' && !contents.isDestroyed() && !contents.isCrashed()) {
    try {
      contents.forcefullyCrashRenderer()
    } catch (error) {
      errors.push(error)
    }
  }

  try {
    await handle.invalidate()
  } catch (error) {
    errors.push(error)
  }

  if (errors.length > 0) {
    throw new AggregateError(errors, 'The sandbox runner could not be terminated completely.')
  }
}

export async function runSandboxRunnerWindowExecution<T>(
  options: RunSandboxRunnerWindowExecutionOptions<T>
): Promise<SandboxRunnerExecutionOutcome<T>> {
  const handle = options.handle

  const contents = handle.window.webContents

  let monitor: ReturnType<typeof createSandboxRunnerRendererGoneMonitor> | null = null

  const stopMonitoring = (): void => {
    monitor?.dispose()
  }

  try {
    handle.assertReadyForExecution()

    monitor = createSandboxRunnerRendererGoneMonitor(contents)
  } catch (error) {
    try {
      await terminateSandboxRunnerWindow(handle, contents, 'execution-failed', stopMonitoring)
    } catch (terminationError) {
      return {
        status: 'failed',
        error: new AggregateError(
          [error, terminationError],
          'The sandbox runner failed during execution setup and could not be terminated completely.'
        )
      }
    }

    return {
      status: 'failed',
      error
    }
  }

  try {
    return await superviseSandboxRunnerExecution({
      timeoutMs: options.timeoutMs,

      execute: async (): Promise<T> => {
        handle.assertReadyForExecution()

        const value = await options.execute(contents)

        /*
         * Never accept a result before confirming that
         * the runner identity, process exclusivity,
         * document and request audit still match.
         */
        handle.assertReadyForExecution()

        return value
      },

      waitForRendererGone: () => {
        if (monitor === null) {
          throw new Error('The sandbox runner renderer monitor is not available.')
        }

        return monitor.wait()
      },

      dispose: async (): Promise<void> => {
        await handle.dispose()
      },

      terminate: (reason): Promise<void> =>
        terminateSandboxRunnerWindow(handle, contents, reason, stopMonitoring),

      clock: options.clock
    })
  } finally {
    stopMonitoring()
  }
}
