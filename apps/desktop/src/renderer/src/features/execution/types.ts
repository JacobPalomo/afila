import type { TestValue } from '../problems/types'

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

export type SolutionExecutionState =
  | {
      readonly status: 'idle'
    }
  | {
      readonly status: 'running'
      readonly results: readonly TestCaseExecutionResult[]
    }
  | {
      readonly status: 'completed'
      readonly results: readonly TestCaseExecutionResult[]
    }
  | {
      readonly status: 'error'
      readonly message: string
      readonly results: readonly TestCaseExecutionResult[]
    }
