import { BrowserWindow, webContents } from 'electron'
import { createSandboxRunnerWindow } from './sandbox-runner-window'
import { runSandboxRunnerWindowExecution } from './sandbox-runner-window-execution'
import {
  captureSandboxRunnerProcessReleaseTarget,
  readSandboxRunnerProcessReleaseSnapshot
} from './sandbox-runner-process-release'
import {
  getSandboxRunnerProcessReleaseViolation,
  type SandboxRunnerProcessReleaseSnapshot
} from './sandbox-runner-process-release-policy'
import {
  armSandboxRunnerCrashDiagnosticProbe,
  runSandboxRunnerCompletionDiagnosticProbe,
  runSandboxRunnerTimeoutDiagnosticProbe
} from './sandbox-runner-execution-diagnostic-probe'
import {
  assertSandboxRunnerExecutionDiagnosticOutcome,
  type SandboxRunnerExecutionDiagnosticScenario
} from './sandbox-runner-execution-diagnostic-policy'
import type { SandboxRunnerExecutionOutcome } from './sandbox-runner-execution-supervisor'

const COMPLETE_TIMEOUT_MS = 2_000 as const

const LOOP_TIMEOUT_MS = 250 as const

const CRASH_TIMEOUT_MS = 2_000 as const

const CRASH_DELAY_MS = 100 as const

export interface SandboxRunnerExecutionDiagnosticReport {
  readonly scenario: SandboxRunnerExecutionDiagnosticScenario

  readonly outcomeStatus: SandboxRunnerExecutionOutcome<unknown>['status']

  readonly elapsedMs: number

  readonly runner: {
    readonly windowId: number
    readonly webContentsId: number
    readonly osProcessId: number
  }

  readonly rendererGoneDetails: {
    readonly reason: string
    readonly exitCode: number
  } | null

  readonly releaseSnapshot: SandboxRunnerProcessReleaseSnapshot

  readonly baselineWindowIds: readonly number[]

  readonly finalWindowIds: readonly number[]

  readonly baselineWebContentsIds: readonly number[]

  readonly finalWebContentsIds: readonly number[]
}

function getRegisteredWindowIds(): number[] {
  return BrowserWindow.getAllWindows()
    .map((window) => window.id)
    .sort((left, right) => left - right)
}

function getRegisteredWebContentsIds(): number[] {
  return webContents
    .getAllWebContents()
    .map((contents) => contents.id)
    .sort((left, right) => left - right)
}

function assertSameIds(
  resourceName: string,
  baselineIds: readonly number[],
  finalIds: readonly number[]
): void {
  if (
    baselineIds.length !== finalIds.length ||
    baselineIds.some((id, index) => finalIds[index] !== id)
  ) {
    throw new Error(
      `The sandbox diagnostic did not restore the ${resourceName} baseline. ` +
        `Baseline: ${JSON.stringify(baselineIds)}. Final: ${JSON.stringify(finalIds)}.`
    )
  }
}

async function runScenario(
  scenario: SandboxRunnerExecutionDiagnosticScenario,
  handle: Awaited<ReturnType<typeof createSandboxRunnerWindow>>
): Promise<SandboxRunnerExecutionOutcome<unknown>> {
  switch (scenario) {
    case 'complete':
      return runSandboxRunnerWindowExecution({
        handle,
        timeoutMs: COMPLETE_TIMEOUT_MS,
        execute: runSandboxRunnerCompletionDiagnosticProbe
      })

    case 'timeout':
      return runSandboxRunnerWindowExecution({
        handle,
        timeoutMs: LOOP_TIMEOUT_MS,
        execute: runSandboxRunnerTimeoutDiagnosticProbe
      })

    case 'renderer-gone': {
      let crashTimer: ReturnType<typeof setTimeout> | null = null

      try {
        return await runSandboxRunnerWindowExecution({
          handle,
          timeoutMs: CRASH_TIMEOUT_MS,

          execute: async (contents): Promise<never> => {
            await armSandboxRunnerCrashDiagnosticProbe(contents)

            return new Promise<never>((_resolve, reject) => {
              crashTimer = setTimeout(() => {
                try {
                  if (contents.isDestroyed()) {
                    throw new Error('The sandbox runner was destroyed before the crash diagnostic.')
                  }

                  if (contents.isCrashed()) {
                    throw new Error(
                      'The sandbox runner had already crashed before the crash diagnostic.'
                    )
                  }

                  contents.forcefullyCrashRenderer()
                } catch (error) {
                  reject(error)
                }
              }, CRASH_DELAY_MS)
            })
          }
        })
      } finally {
        if (crashTimer !== null) {
          clearTimeout(crashTimer)
        }
      }
    }
  }
}

export async function runSandboxRunnerExecutionDiagnostic(
  scenario: SandboxRunnerExecutionDiagnosticScenario
): Promise<SandboxRunnerExecutionDiagnosticReport> {
  const baselineWindowIds = getRegisteredWindowIds()

  const baselineWebContentsIds = getRegisteredWebContentsIds()

  const handle = await createSandboxRunnerWindow()

  const releaseTarget = captureSandboxRunnerProcessReleaseTarget(handle.window, handle.identity)

  const startedAt = Date.now()

  const outcome = await runScenario(scenario, handle)

  const elapsedMs = Date.now() - startedAt

  assertSandboxRunnerExecutionDiagnosticOutcome(scenario, outcome)

  const releaseSnapshot = readSandboxRunnerProcessReleaseSnapshot(releaseTarget)

  const releaseViolation = getSandboxRunnerProcessReleaseViolation(releaseSnapshot)

  if (releaseViolation !== null) {
    throw new Error(`The sandbox runner diagnostic left a resource registered: ${releaseViolation}`)
  }

  const finalWindowIds = getRegisteredWindowIds()

  const finalWebContentsIds = getRegisteredWebContentsIds()

  assertSameIds('BrowserWindow', baselineWindowIds, finalWindowIds)

  assertSameIds('WebContents', baselineWebContentsIds, finalWebContentsIds)

  return {
    scenario,
    outcomeStatus: outcome.status,
    elapsedMs,

    runner: {
      windowId: releaseTarget.windowId,
      webContentsId: releaseTarget.webContentsId,
      osProcessId: releaseTarget.osProcessId
    },

    rendererGoneDetails: outcome.status === 'renderer-gone' ? outcome.details : null,

    releaseSnapshot,

    baselineWindowIds,
    finalWindowIds,
    baselineWebContentsIds,
    finalWebContentsIds
  }
}
