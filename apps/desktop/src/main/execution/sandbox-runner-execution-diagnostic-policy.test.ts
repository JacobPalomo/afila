import { describe, expect, it } from 'vitest'
import {
  assertSandboxRunnerExecutionDiagnosticOutcome,
  parseSandboxRunnerExecutionDiagnosticScenario,
  SANDBOX_RUNNER_EXECUTION_DIAGNOSTIC_RESULT
} from './sandbox-runner-execution-diagnostic-policy'

describe('sandbox runner execution diagnostic policy', () => {
  it('disables the diagnostic when the environment value is absent', () => {
    expect(parseSandboxRunnerExecutionDiagnosticScenario(undefined)).toBeNull()
  })

  it.each(['complete', 'timeout', 'renderer-gone'] as const)(
    'accepts the %s diagnostic scenario',
    (scenario) => {
      expect(parseSandboxRunnerExecutionDiagnosticScenario(scenario)).toBe(scenario)
    }
  )

  it('rejects unsupported diagnostic scenarios', () => {
    expect(() => parseSandboxRunnerExecutionDiagnosticScenario('unknown')).toThrow(
      'Unsupported sandbox execution diagnostic scenario'
    )
  })

  it('accepts the expected completion result', () => {
    expect(() =>
      assertSandboxRunnerExecutionDiagnosticOutcome('complete', {
        status: 'completed',
        value: SANDBOX_RUNNER_EXECUTION_DIAGNOSTIC_RESULT
      })
    ).not.toThrow()
  })

  it('accepts the expected timeout result', () => {
    expect(() =>
      assertSandboxRunnerExecutionDiagnosticOutcome('timeout', {
        status: 'timed-out'
      })
    ).not.toThrow()
  })

  it.each(['killed', 'crashed'])('accepts the %s renderer termination reason', (reason) => {
    expect(() =>
      assertSandboxRunnerExecutionDiagnosticOutcome('renderer-gone', {
        status: 'renderer-gone',
        details: {
          reason,
          exitCode: 9
        }
      })
    ).not.toThrow()
  })

  it('rejects an outcome that does not match its scenario', () => {
    expect(() =>
      assertSandboxRunnerExecutionDiagnosticOutcome('timeout', {
        status: 'completed',
        value: 'unexpected'
      })
    ).toThrow('timeout diagnostic returned an unexpected outcome')
  })
})
