import type { RunSolutionRequest, RunSolutionResponse } from '../../shared/execution'

export function simulateRunSolution(request: RunSolutionRequest): RunSolutionResponse {
  return {
    ok: true,
    results: request.testCases.map((testCase, index) => ({
      status: 'passed',
      testCaseId: testCase.id,
      actual: testCase.expected,
      durationMs: index + 1
    }))
  }
}
