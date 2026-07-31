export const RUN_SOLUTION_CHANNEL = 'afila:execution:run' as const

export type TestValue =
  string | number | boolean | null | readonly TestValue[] | { readonly [key: string]: TestValue }

export interface ExecutionTestCase {
  readonly id: string
  readonly args: readonly TestValue[]
  readonly expected: TestValue
}

export interface RunSolutionRequest {
  readonly problemId: string
  readonly entryPoint: string
  readonly sourceCode: string
  readonly testCases: readonly ExecutionTestCase[]
}

interface TestCaseExecutionResultBase {
  readonly testCaseId: string
  readonly durationMs: number
}

export interface PassedTestCaseExecutionResult extends TestCaseExecutionResultBase {
  readonly status: 'passed'
  readonly actual: TestValue
}

export interface FailedTestCaseExecutionResult extends TestCaseExecutionResultBase {
  readonly status: 'failed'
  readonly actual: TestValue
}

export interface ErroredTestCaseExecutionResult extends TestCaseExecutionResultBase {
  readonly status: 'error'
  readonly message: string
}

export type TestCaseExecutionResult =
  PassedTestCaseExecutionResult | FailedTestCaseExecutionResult | ErroredTestCaseExecutionResult

export interface RunSolutionError {
  readonly code: 'invalid-request' | 'execution-failed'
  readonly message: string
}

export type RunSolutionResponse =
  | {
      readonly ok: true
      readonly results: readonly TestCaseExecutionResult[]
    }
  | {
      readonly ok: false
      readonly error: RunSolutionError
    }
