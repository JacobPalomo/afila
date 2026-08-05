import type { SandboxRunnerExecutionOutcome } from './sandbox-runner-execution-supervisor'

export const SANDBOX_RUNNER_EXECUTION_DIAGNOSTIC_SCENARIOS = [
  'complete',
  'timeout',
  'renderer-gone'
] as const

export type SandboxRunnerExecutionDiagnosticScenario =
  (typeof SANDBOX_RUNNER_EXECUTION_DIAGNOSTIC_SCENARIOS)[number]

export const SANDBOX_RUNNER_EXECUTION_DIAGNOSTIC_RESULT =
  'afila-sandbox-execution-completed-v1' as const

export function parseSandboxRunnerExecutionDiagnosticScenario(
  value: string | undefined
): SandboxRunnerExecutionDiagnosticScenario | null {
  if (value === undefined) {
    return null
  }

  const scenario = SANDBOX_RUNNER_EXECUTION_DIAGNOSTIC_SCENARIOS.find(
    (candidate) => candidate === value
  )

  if (scenario === undefined) {
    throw new Error(`Unsupported sandbox execution diagnostic scenario: ${JSON.stringify(value)}.`)
  }

  return scenario
}

export function assertSandboxRunnerExecutionDiagnosticOutcome(
  scenario: SandboxRunnerExecutionDiagnosticScenario,
  outcome: SandboxRunnerExecutionOutcome<unknown>
): void {
  switch (scenario) {
    case 'complete': {
      if (
        outcome.status !== 'completed' ||
        outcome.value !== SANDBOX_RUNNER_EXECUTION_DIAGNOSTIC_RESULT
      ) {
        throw new Error('The normal sandbox execution diagnostic returned an unexpected outcome.')
      }

      return
    }

    case 'timeout': {
      if (outcome.status !== 'timed-out') {
        throw new Error('The sandbox timeout diagnostic returned an unexpected outcome.')
      }

      return
    }

    case 'renderer-gone': {
      if (outcome.status !== 'renderer-gone') {
        throw new Error('The renderer-gone diagnostic returned an unexpected outcome.')
      }

      if (outcome.details.reason !== 'killed' && outcome.details.reason !== 'crashed') {
        throw new Error(
          `The renderer-gone diagnostic returned an unexpected reason: ${JSON.stringify(
            outcome.details.reason
          )}.`
        )
      }

      if (!Number.isInteger(outcome.details.exitCode)) {
        throw new Error('The renderer-gone diagnostic returned an invalid exit code.')
      }

      return
    }
  }
}
