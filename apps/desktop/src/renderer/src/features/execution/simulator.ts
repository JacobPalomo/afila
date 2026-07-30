import type { ProblemTestCase } from '../problems/types'
import type { TestCaseExecutionResult } from './types'

const SIMULATED_EXECUTION_DELAY_MS = 650

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs)
  })
}

export async function simulateSolutionExecution(
  testCases: readonly ProblemTestCase[]
): Promise<readonly TestCaseExecutionResult[]> {
  await wait(SIMULATED_EXECUTION_DELAY_MS)

  return testCases.map((testCase, index) => ({
    status: 'passed',
    testCaseId: testCase.id,
    actual: testCase.expected,
    durationMs: index + 1
  }))
}
