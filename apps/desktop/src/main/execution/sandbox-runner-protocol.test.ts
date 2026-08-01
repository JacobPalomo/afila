import { describe, expect, it } from 'vitest'
import {
  isSandboxRunnerExecutionRequest,
  parseSandboxRunnerExecutionResponse,
  SANDBOX_RUNNER_PROTOCOL_VERSION,
  type SandboxRunnerExecutionRequest
} from './sandbox-runner-protocol'

const request = {
  version: SANDBOX_RUNNER_PROTOCOL_VERSION,
  type: 'execute-javascript',
  requestId: 'request-1',
  entryPoint: 'sumar',
  javaScript: 'function sumar(a, b) { return a + b }',
  testCases: [
    {
      id: 'case-1',
      args: [2, 3]
    },
    {
      id: 'case-2',
      args: [-2, 2]
    }
  ]
} satisfies SandboxRunnerExecutionRequest

function serializeResponse(value: unknown): string {
  return JSON.stringify(value)
}

function createSuccessfulResponse(testCaseIds: readonly string[]): string {
  return serializeResponse({
    version: SANDBOX_RUNNER_PROTOCOL_VERSION,
    type: 'execution-result',
    requestId: 'request-1',
    ok: true,
    results: testCaseIds.map((testCaseId) => ({
      testCaseId,
      durationMs: 1,
      outcome: 'returned',
      value: 5
    }))
  })
}

describe('sandbox runner protocol', () => {
  it('accepts a valid execution request', () => {
    expect(isSandboxRunnerExecutionRequest(request)).toBe(true)
  })

  it('rejects expected values in the sandbox request', () => {
    expect(
      isSandboxRunnerExecutionRequest({
        ...request,
        testCases: [
          {
            id: 'case-1',
            args: [2, 3],
            expected: 5
          }
        ]
      })
    ).toBe(false)
  })

  it('rejects duplicate test-case identifiers', () => {
    expect(
      isSandboxRunnerExecutionRequest({
        ...request,
        testCases: [
          {
            id: 'case-1',
            args: [2, 3]
          },
          {
            id: 'case-1',
            args: [4, 5]
          }
        ]
      })
    ).toBe(false)
  })

  it('parses a correlated successful response', () => {
    const response = parseSandboxRunnerExecutionResponse(
      createSuccessfulResponse(['case-1', 'case-2']),
      request
    )

    expect(response?.ok).toBe(true)
  })

  it('accepts a bounded thrown result', () => {
    const response = parseSandboxRunnerExecutionResponse(
      serializeResponse({
        version: SANDBOX_RUNNER_PROTOCOL_VERSION,
        type: 'execution-result',
        requestId: 'request-1',
        ok: true,
        results: [
          {
            testCaseId: 'case-1',
            durationMs: 1,
            outcome: 'threw',
            message: 'Boom'
          },
          {
            testCaseId: 'case-2',
            durationMs: 1,
            outcome: 'returned',
            value: 0
          }
        ]
      }),
      request
    )

    expect(response?.ok).toBe(true)
  })

  it('rejects a non-serialized response', () => {
    expect(
      parseSandboxRunnerExecutionResponse(
        {
          version: SANDBOX_RUNNER_PROTOCOL_VERSION
        },
        request
      )
    ).toBeNull()
  })

  it('rejects a mismatched request identifier', () => {
    expect(
      parseSandboxRunnerExecutionResponse(
        serializeResponse({
          version: SANDBOX_RUNNER_PROTOCOL_VERSION,
          type: 'execution-result',
          requestId: 'another-request',
          ok: false,
          error: {
            code: 'runner-failed',
            message: 'Failed'
          }
        }),
        request
      )
    ).toBeNull()
  })

  it('rejects missing test results', () => {
    expect(
      parseSandboxRunnerExecutionResponse(createSuccessfulResponse(['case-1']), request)
    ).toBeNull()
  })

  it('rejects reordered test results', () => {
    expect(
      parseSandboxRunnerExecutionResponse(createSuccessfulResponse(['case-2', 'case-1']), request)
    ).toBeNull()
  })

  it('rejects unsupported extra response properties', () => {
    expect(
      parseSandboxRunnerExecutionResponse(
        serializeResponse({
          version: SANDBOX_RUNNER_PROTOCOL_VERSION,
          type: 'execution-result',
          requestId: 'request-1',
          ok: false,
          error: {
            code: 'runner-failed',
            message: 'Failed'
          },
          debug: 'should not cross the boundary'
        }),
        request
      )
    ).toBeNull()
  })

  it('accepts a correlated runner failure', () => {
    const response = parseSandboxRunnerExecutionResponse(
      serializeResponse({
        version: SANDBOX_RUNNER_PROTOCOL_VERSION,
        type: 'execution-result',
        requestId: 'request-1',
        ok: false,
        error: {
          code: 'runner-failed',
          message: 'Runner initialization failed.'
        }
      }),
      request
    )

    expect(response).toEqual({
      version: SANDBOX_RUNNER_PROTOCOL_VERSION,
      type: 'execution-result',
      requestId: 'request-1',
      ok: false,
      error: {
        code: 'runner-failed',
        message: 'Runner initialization failed.'
      }
    })
  })

  it('rejects sparse argument arrays', () => {
    const sparseArgs: unknown[] = []
    sparseArgs.length = 2
    sparseArgs[1] = 3

    expect(
      isSandboxRunnerExecutionRequest({
        ...request,
        testCases: [
          {
            id: 'case-1',
            args: sparseArgs
          }
        ]
      })
    ).toBe(false)
  })

  it('rejects non-plain request objects', () => {
    const nonPlainRequest = Object.assign(Object.create({ inherited: true }), request)

    expect(isSandboxRunnerExecutionRequest(nonPlainRequest)).toBe(false)
  })

  it('rejects unsupported argument values', () => {
    expect(
      isSandboxRunnerExecutionRequest({
        ...request,
        testCases: [
          {
            id: 'case-1',
            args: [undefined]
          }
        ]
      })
    ).toBe(false)
  })

  it('rejects oversized JavaScript', () => {
    expect(
      isSandboxRunnerExecutionRequest({
        ...request,
        javaScript: 'x'.repeat(400_001)
      })
    ).toBe(false)
  })

  it('rejects oversized serialized responses before parsing', () => {
    expect(parseSandboxRunnerExecutionResponse(' '.repeat(1_000_001), request)).toBeNull()
  })

  it('rejects a mismatched protocol version', () => {
    expect(
      parseSandboxRunnerExecutionResponse(
        serializeResponse({
          version: 2,
          type: 'execution-result',
          requestId: 'request-1',
          ok: false,
          error: {
            code: 'runner-failed',
            message: 'Failed'
          }
        }),
        request
      )
    ).toBeNull()
  })
})
