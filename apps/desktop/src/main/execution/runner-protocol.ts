import type { RunSolutionRequest, RunSolutionResponse, TestValue } from '../../shared/execution'
import { isRunSolutionRequest } from './validate-run-solution-request'

const RUN_REQUEST_TYPE = 'run-solution'
const RUN_RESPONSE_TYPE = 'run-solution-result'

const MAX_REQUEST_ID_LENGTH = 100
const MAX_RESULT_COUNT = 100
const MAX_IDENTIFIER_LENGTH = 120
const MAX_MESSAGE_LENGTH = 10_000
const MAX_TEST_VALUE_DEPTH = 20

export interface ExecutionRunnerRequestMessage {
  readonly type: typeof RUN_REQUEST_TYPE
  readonly requestId: string
  readonly request: RunSolutionRequest
}

export interface ExecutionRunnerResponseMessage {
  readonly type: typeof RUN_RESPONSE_TYPE
  readonly requestId: string
  readonly response: RunSolutionResponse
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

function isExecutionResult(value: unknown): boolean {
  if (!isPlainRecord(value)) {
    return false
  }

  if (
    !isNonEmptyString(value.testCaseId, MAX_IDENTIFIER_LENGTH) ||
    typeof value.durationMs !== 'number' ||
    !Number.isFinite(value.durationMs) ||
    value.durationMs < 0
  ) {
    return false
  }

  if (value.status === 'passed' || value.status === 'failed') {
    return isTestValue(value.actual)
  }

  if (value.status === 'error') {
    return isNonEmptyString(value.message, MAX_MESSAGE_LENGTH)
  }

  return false
}

function isRunSolutionResponse(value: unknown): value is RunSolutionResponse {
  if (!isPlainRecord(value)) {
    return false
  }

  if (value.ok === false) {
    if (!isPlainRecord(value.error)) {
      return false
    }

    return (
      (value.error.code === 'invalid-request' || value.error.code === 'execution-failed') &&
      isNonEmptyString(value.error.message, MAX_MESSAGE_LENGTH)
    )
  }

  if (
    value.ok !== true ||
    !Array.isArray(value.results) ||
    value.results.length === 0 ||
    value.results.length > MAX_RESULT_COUNT
  ) {
    return false
  }

  const testCaseIds = new Set<string>()

  for (let index = 0; index < value.results.length; index += 1) {
    if (!(index in value.results)) {
      return false
    }

    const result = value.results[index]

    if (
      !isExecutionResult(result) ||
      !isPlainRecord(result) ||
      typeof result.testCaseId !== 'string' ||
      testCaseIds.has(result.testCaseId)
    ) {
      return false
    }

    testCaseIds.add(result.testCaseId)
  }

  return true
}

export function isExecutionRunnerRequestMessage(
  value: unknown
): value is ExecutionRunnerRequestMessage {
  return (
    isPlainRecord(value) &&
    value.type === RUN_REQUEST_TYPE &&
    isNonEmptyString(value.requestId, MAX_REQUEST_ID_LENGTH) &&
    isRunSolutionRequest(value.request)
  )
}

export function isExecutionRunnerResponseMessage(
  value: unknown,
  expectedRequestId: string
): value is ExecutionRunnerResponseMessage {
  return (
    isPlainRecord(value) &&
    value.type === RUN_RESPONSE_TYPE &&
    value.requestId === expectedRequestId &&
    isRunSolutionResponse(value.response)
  )
}

export function isExecutionRunnerResponseMessageForRequest(
  value: unknown,
  requestMessage: ExecutionRunnerRequestMessage
): value is ExecutionRunnerResponseMessage {
  if (
    !isExecutionRunnerRequestMessage(requestMessage) ||
    !isExecutionRunnerResponseMessage(value, requestMessage.requestId)
  ) {
    return false
  }

  if (!value.response.ok) {
    return true
  }

  const { testCases } = requestMessage.request

  return (
    value.response.results.length === testCases.length &&
    value.response.results.every((result, index) => result.testCaseId === testCases[index]?.id)
  )
}
