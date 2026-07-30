import { ipcMain } from 'electron'
import { isTrustedIpcSender } from '../security/trusted-renderer'
import {
  RUN_SOLUTION_CHANNEL,
  type ExecutionTestCase,
  type RunSolutionRequest,
  type RunSolutionResponse,
  type TestValue
} from '../../shared/execution'

const SIMULATED_EXECUTION_DELAY_MS = 650
const MAX_PROBLEM_ID_LENGTH = 120
const MAX_SOURCE_CODE_LENGTH = 100_000
const MAX_TEST_CASE_COUNT = 100
const MAX_TEST_VALUE_DEPTH = 20

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)

  return prototype === Object.prototype || prototype === null
}

function isNonEmptyString(value: unknown, maximumLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximumLength
}

function isTestValue(value: unknown, depth = 0): value is TestValue {
  if (depth > MAX_TEST_VALUE_DEPTH) {
    return false
  }

  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!(index in value) || !isTestValue(value[index], depth + 1)) {
        return false
      }
    }

    return true
  }

  if (!isPlainRecord(value)) {
    return false
  }

  return Object.values(value).every((item) => isTestValue(item, depth + 1))
}

function isExecutionTestCase(value: unknown): value is ExecutionTestCase {
  if (!isPlainRecord(value)) {
    return false
  }

  return (
    isNonEmptyString(value.id, MAX_PROBLEM_ID_LENGTH) &&
    Array.isArray(value.args) &&
    value.args.every((argument) => isTestValue(argument)) &&
    isTestValue(value.expected)
  )
}

function isRunSolutionRequest(value: unknown): value is RunSolutionRequest {
  if (!isPlainRecord(value)) {
    return false
  }

  if (
    !isNonEmptyString(value.problemId, MAX_PROBLEM_ID_LENGTH) ||
    typeof value.sourceCode !== 'string' ||
    value.sourceCode.length > MAX_SOURCE_CODE_LENGTH ||
    !Array.isArray(value.testCases) ||
    value.testCases.length === 0 ||
    value.testCases.length > MAX_TEST_CASE_COUNT
  ) {
    return false
  }

  const testCaseIds = new Set<string>()

  for (const testCase of value.testCases) {
    if (!isExecutionTestCase(testCase) || testCaseIds.has(testCase.id)) {
      return false
    }

    testCaseIds.add(testCase.id)
  }

  return true
}

export function registerExecutionHandler(): void {
  ipcMain.handle(
    RUN_SOLUTION_CHANNEL,
    async (event, request: unknown): Promise<RunSolutionResponse> => {
      if (!isTrustedIpcSender(event)) {
        return {
          ok: false,
          error: {
            code: 'invalid-request',
            message: 'El remitente de la solicitud no está autorizado.'
          }
        }
      }

      if (!isRunSolutionRequest(request)) {
        return {
          ok: false,
          error: {
            code: 'invalid-request',
            message: 'La solicitud de ejecución no es válida.'
          }
        }
      }

      await wait(SIMULATED_EXECUTION_DELAY_MS)

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
  )
}
