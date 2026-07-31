import { describe, expect, it } from 'vitest'
import { simulateRunSolution } from './simulate-run-solution'

describe('simulateRunSolution', () => {
  it('returns deterministic passed results', () => {
    expect(
      simulateRunSolution({
        problemId: 'sum-two-numbers',
        entryPoint: 'sumar',
        sourceCode: '',
        testCases: [
          {
            id: 'case-1',
            args: [2, 3],
            expected: 5
          },
          {
            id: 'case-2',
            args: [-1, 1],
            expected: 0
          }
        ]
      })
    ).toEqual({
      ok: true,
      results: [
        {
          status: 'passed',
          testCaseId: 'case-1',
          actual: 5,
          durationMs: 1
        },
        {
          status: 'passed',
          testCaseId: 'case-2',
          actual: 0,
          durationMs: 2
        }
      ]
    })
  })
})
