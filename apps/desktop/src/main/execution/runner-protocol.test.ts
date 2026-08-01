import { describe, expect, it } from 'vitest'
import {
  isExecutionRunnerRequestMessage,
  isExecutionRunnerResponseMessage,
  isExecutionRunnerResponseMessageForRequest,
  type ExecutionRunnerResponseMessage
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

const correlatedRequestMessage = {
  type: 'run-solution',
  requestId: 'request-1',
  request: {
    ...request,
    testCases: [
      ...request.testCases,
      {
        id: 'case-2',
        args: [-2, 2],
        expected: 0
      }
    ]
  }
} as const

function createSuccessfulResponse(testCaseIds: readonly string[]): ExecutionRunnerResponseMessage {
  return {
    type: 'run-solution-result',
    requestId: 'request-1',
    response: {
      ok: true,
      results: testCaseIds.map((testCaseId) => ({
        status: 'passed',
        testCaseId,
        actual: 0,
        durationMs: 1
      }))
    }
  }
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

  it('accepts results that exactly match the original request', () => {
    expect(
      isExecutionRunnerResponseMessageForRequest(
        createSuccessfulResponse(['case-1', 'case-2']),
        correlatedRequestMessage
      )
    ).toBe(true)
  })

  it('rejects missing results from the original request', () => {
    expect(
      isExecutionRunnerResponseMessageForRequest(
        createSuccessfulResponse(['case-1']),
        correlatedRequestMessage
      )
    ).toBe(false)
  })

  it('rejects results returned in a different order', () => {
    expect(
      isExecutionRunnerResponseMessageForRequest(
        createSuccessfulResponse(['case-2', 'case-1']),
        correlatedRequestMessage
      )
    ).toBe(false)
  })

  it('accepts a correlated execution failure without results', () => {
    expect(
      isExecutionRunnerResponseMessageForRequest(
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
        correlatedRequestMessage
      )
    ).toBe(true)
  })
})
