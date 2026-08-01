import { Buffer } from 'node:buffer'
import type { TestValue } from '../../shared/execution'

export const SANDBOX_RUNNER_PROTOCOL_VERSION = 1 as const

const EXECUTION_REQUEST_TYPE = 'execute-javascript'
const EXECUTION_RESPONSE_TYPE = 'execution-result'

const MAX_REQUEST_ID_BYTES = 100
const MAX_IDENTIFIER_LENGTH = 120
const MAX_JAVASCRIPT_BYTES = 400_000
const MAX_TEST_CASE_COUNT = 100
const MAX_ARGUMENT_COUNT = 32

const MAX_SERIALIZED_RESPONSE_BYTES = 1_000_000
const MAX_ERROR_MESSAGE_BYTES = 10_000
const MAX_REPORTED_DURATION_MS = 60_000

const MAX_TEST_VALUE_DEPTH = 20
const MAX_TEST_VALUE_NODES = 10_000
const MAX_TEST_VALUE_STRING_BYTES = 50_000
const MAX_TEST_VALUE_TOTAL_STRING_BYTES = 200_000
const MAX_OBJECT_KEY_BYTES = 1_000

const JAVASCRIPT_IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/

export interface SandboxRunnerTestCase {
  readonly id: string
  readonly args: readonly TestValue[]
}

export interface SandboxRunnerExecutionRequest {
  readonly version: typeof SANDBOX_RUNNER_PROTOCOL_VERSION
  readonly type: typeof EXECUTION_REQUEST_TYPE
  readonly requestId: string
  readonly entryPoint: string
  readonly javaScript: string
  readonly testCases: readonly SandboxRunnerTestCase[]
}

interface SandboxRunnerResultBase {
  readonly testCaseId: string
  readonly durationMs: number
}

export interface SandboxRunnerReturnedResult extends SandboxRunnerResultBase {
  readonly outcome: 'returned'
  readonly value: TestValue
}

export interface SandboxRunnerThrownResult extends SandboxRunnerResultBase {
  readonly outcome: 'threw'
  readonly message: string
}

export type SandboxRunnerTestResult = SandboxRunnerReturnedResult | SandboxRunnerThrownResult

export interface SandboxRunnerExecutionSuccess {
  readonly version: typeof SANDBOX_RUNNER_PROTOCOL_VERSION
  readonly type: typeof EXECUTION_RESPONSE_TYPE
  readonly requestId: string
  readonly ok: true
  readonly results: readonly SandboxRunnerTestResult[]
}

export interface SandboxRunnerExecutionFailure {
  readonly version: typeof SANDBOX_RUNNER_PROTOCOL_VERSION
  readonly type: typeof EXECUTION_RESPONSE_TYPE
  readonly requestId: string
  readonly ok: false
  readonly error: {
    readonly code: 'runner-failed'
    readonly message: string
  }
}

export type SandboxRunnerExecutionResponse =
  SandboxRunnerExecutionSuccess | SandboxRunnerExecutionFailure

interface TestValueBudget {
  remainingNodes: number
  remainingStringBytes: number
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)

  return prototype === Object.prototype || prototype === null
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const ownKeys = Reflect.ownKeys(value)

  return (
    ownKeys.length === expectedKeys.length &&
    ownKeys.every((key) => typeof key === 'string') &&
    expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  )
}

function isDenseArray(value: readonly unknown[]): boolean {
  if (
    Object.keys(value).length !== value.length ||
    Reflect.ownKeys(value).length !== value.length + 1
  ) {
    return false
  }

  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) {
      return false
    }
  }

  return true
}

function getUtf8ByteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8')
}

function isNonEmptyBoundedString(value: unknown, maximumBytes: number): value is string {
  return typeof value === 'string' && value.length > 0 && getUtf8ByteLength(value) <= maximumBytes
}

function createTestValueBudget(): TestValueBudget {
  return {
    remainingNodes: MAX_TEST_VALUE_NODES,
    remainingStringBytes: MAX_TEST_VALUE_TOTAL_STRING_BYTES
  }
}

function consumeString(
  value: string,
  budget: TestValueBudget,
  maximumBytes = MAX_TEST_VALUE_STRING_BYTES
): boolean {
  const byteLength = getUtf8ByteLength(value)

  if (byteLength > maximumBytes || byteLength > budget.remainingStringBytes) {
    return false
  }

  budget.remainingStringBytes -= byteLength

  return true
}

function isTestValue(value: unknown, budget: TestValueBudget, depth = 0): value is TestValue {
  if (depth > MAX_TEST_VALUE_DEPTH || budget.remainingNodes <= 0) {
    return false
  }

  budget.remainingNodes -= 1

  if (value === null || typeof value === 'boolean') {
    return true
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  if (typeof value === 'string') {
    return consumeString(value, budget)
  }

  if (Array.isArray(value)) {
    if (!isDenseArray(value)) {
      return false
    }

    return value.every((item) => isTestValue(item, budget, depth + 1))
  }

  if (!isPlainRecord(value)) {
    return false
  }

  const keys = Object.keys(value)

  if (Reflect.ownKeys(value).length !== keys.length) {
    return false
  }

  for (const key of keys) {
    if (
      !consumeString(key, budget, MAX_OBJECT_KEY_BYTES) ||
      !isTestValue(value[key], budget, depth + 1)
    ) {
      return false
    }
  }

  return true
}

function isSandboxRunnerTestCase(
  value: unknown,
  testCaseIds: Set<string>,
  budget: TestValueBudget
): value is SandboxRunnerTestCase {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, ['id', 'args']) ||
    !isNonEmptyBoundedString(value.id, MAX_IDENTIFIER_LENGTH) ||
    testCaseIds.has(value.id) ||
    !Array.isArray(value.args) ||
    value.args.length > MAX_ARGUMENT_COUNT ||
    !isDenseArray(value.args)
  ) {
    return false
  }

  for (const argument of value.args) {
    if (!isTestValue(argument, budget)) {
      return false
    }
  }

  testCaseIds.add(value.id)

  return true
}

export function isSandboxRunnerExecutionRequest(
  value: unknown
): value is SandboxRunnerExecutionRequest {
  try {
    if (
      !isPlainRecord(value) ||
      !hasExactKeys(value, [
        'version',
        'type',
        'requestId',
        'entryPoint',
        'javaScript',
        'testCases'
      ]) ||
      value.version !== SANDBOX_RUNNER_PROTOCOL_VERSION ||
      value.type !== EXECUTION_REQUEST_TYPE ||
      !isNonEmptyBoundedString(value.requestId, MAX_REQUEST_ID_BYTES) ||
      typeof value.entryPoint !== 'string' ||
      value.entryPoint.length > MAX_IDENTIFIER_LENGTH ||
      !JAVASCRIPT_IDENTIFIER_PATTERN.test(value.entryPoint) ||
      !isNonEmptyBoundedString(value.javaScript, MAX_JAVASCRIPT_BYTES) ||
      !Array.isArray(value.testCases) ||
      value.testCases.length === 0 ||
      value.testCases.length > MAX_TEST_CASE_COUNT ||
      !isDenseArray(value.testCases)
    ) {
      return false
    }

    const testCaseIds = new Set<string>()
    const budget = createTestValueBudget()

    return value.testCases.every((testCase) =>
      isSandboxRunnerTestCase(testCase, testCaseIds, budget)
    )
  } catch {
    return false
  }
}

function isValidDuration(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_REPORTED_DURATION_MS
  )
}

function isSandboxRunnerTestResult(
  value: unknown,
  budget: TestValueBudget
): value is SandboxRunnerTestResult {
  if (
    !isPlainRecord(value) ||
    !isNonEmptyBoundedString(value.testCaseId, MAX_IDENTIFIER_LENGTH) ||
    !isValidDuration(value.durationMs)
  ) {
    return false
  }

  if (value.outcome === 'returned') {
    return (
      hasExactKeys(value, ['testCaseId', 'durationMs', 'outcome', 'value']) &&
      isTestValue(value.value, budget)
    )
  }

  if (value.outcome === 'threw') {
    return (
      hasExactKeys(value, ['testCaseId', 'durationMs', 'outcome', 'message']) &&
      isNonEmptyBoundedString(value.message, MAX_ERROR_MESSAGE_BYTES)
    )
  }

  return false
}

function isSandboxRunnerFailure(
  value: unknown,
  request: SandboxRunnerExecutionRequest
): value is SandboxRunnerExecutionFailure {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, ['version', 'type', 'requestId', 'ok', 'error']) ||
    value.version !== SANDBOX_RUNNER_PROTOCOL_VERSION ||
    value.type !== EXECUTION_RESPONSE_TYPE ||
    value.requestId !== request.requestId ||
    value.ok !== false ||
    !isPlainRecord(value.error) ||
    !hasExactKeys(value.error, ['code', 'message'])
  ) {
    return false
  }

  return (
    value.error.code === 'runner-failed' &&
    isNonEmptyBoundedString(value.error.message, MAX_ERROR_MESSAGE_BYTES)
  )
}

function isSandboxRunnerSuccess(
  value: unknown,
  request: SandboxRunnerExecutionRequest
): value is SandboxRunnerExecutionSuccess {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, ['version', 'type', 'requestId', 'ok', 'results']) ||
    value.version !== SANDBOX_RUNNER_PROTOCOL_VERSION ||
    value.type !== EXECUTION_RESPONSE_TYPE ||
    value.requestId !== request.requestId ||
    value.ok !== true ||
    !Array.isArray(value.results) ||
    value.results.length !== request.testCases.length ||
    !isDenseArray(value.results)
  ) {
    return false
  }

  const budget = createTestValueBudget()

  for (let index = 0; index < value.results.length; index += 1) {
    const result = value.results[index]
    const expectedTestCase = request.testCases[index]

    if (
      expectedTestCase === undefined ||
      !isSandboxRunnerTestResult(result, budget) ||
      result.testCaseId !== expectedTestCase.id
    ) {
      return false
    }
  }

  return true
}

export function parseSandboxRunnerExecutionResponse(
  value: unknown,
  request: SandboxRunnerExecutionRequest
): SandboxRunnerExecutionResponse | null {
  if (
    !isSandboxRunnerExecutionRequest(request) ||
    typeof value !== 'string' ||
    value.length === 0 ||
    getUtf8ByteLength(value) > MAX_SERIALIZED_RESPONSE_BYTES
  ) {
    return null
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(value) as unknown
  } catch {
    return null
  }

  try {
    if (isSandboxRunnerFailure(parsed, request)) {
      return parsed
    }

    if (isSandboxRunnerSuccess(parsed, request)) {
      return parsed
    }

    return null
  } catch {
    return null
  }
}
