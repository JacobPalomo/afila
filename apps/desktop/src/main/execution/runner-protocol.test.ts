import { describe, expect, it } from 'vitest'
import {
  isExecutionRunnerRequestMessage,
  isExecutionRunnerResponseMessage
} from './runner-protocol'

const request = {
  problemId: 'sum-two-numbers',
  entryPoint: 'sumar',
  sourceCode: 'function sumar(a: number, b: number) { return a + b }',
  testCases: [
    {
      id: 'case-1',
      args: [2, 3],
      expected: 5
    }
  ]
}

describe('execution runner protocol', () => {
  it('accepts a valid request message', () => {
    expect(
      isExecutionRunnerRequestMessage({
        type: 'run-solution',
        requestId: 'request-1',
        request
      })
    ).toBe(true)
  })

  it('rejects an invalid request payload', () => {
    expect(
      isExecutionRunnerRequestMessage({
        type: 'run-solution',
        requestId: 'request-1',
        request: {
          ...request,
          entryPoint: 'sumar()'
        }
      })
    ).toBe(false)
  })

  it('accepts a valid response message', () => {
    expect(
      isExecutionRunnerResponseMessage(
        {
          type: 'run-solution-result',
          requestId: 'request-1',
          response: {
            ok: true,
            results: [
              {
                status: 'passed',
                testCaseId: 'case-1',
                actual: 5,
                durationMs: 1
              }
            ]
          }
        },
        'request-1'
      )
    ).toBe(true)
  })

  it('rejects a mismatched request id', () => {
    expect(
      isExecutionRunnerResponseMessage(
        {
          type: 'run-solution-result',
          requestId: 'unexpected-request',
          response: {
            ok: true,
            results: [
              {
                status: 'passed',
                testCaseId: 'case-1',
                actual: 5,
                durationMs: 1
              }
            ]
          }
        },
        'request-1'
      )
    ).toBe(false)
  })

  it('rejects unsupported result values', () => {
    expect(
      isExecutionRunnerResponseMessage(
        {
          type: 'run-solution-result',
          requestId: 'request-1',
          response: {
            ok: true,
            results: [
              {
                status: 'passed',
                testCaseId: 'case-1',
                actual: undefined,
                durationMs: 1
              }
            ]
          }
        },
        'request-1'
      )
    ).toBe(false)
  })

  it('accepts an execution failure', () => {
    expect(
      isExecutionRunnerResponseMessage(
        {
          type: 'run-solution-result',
          requestId: 'request-1',
          response: {
            ok: false,
            error: {
              code: 'execution-failed',
              message: 'Execution failed.'
            }
          }
        },
        'request-1'
      )
    ).toBe(true)
  })
})
