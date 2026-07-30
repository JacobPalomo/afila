import type { TestCaseExecutionResult } from '../../../../shared/execution'

export type {
  ErroredTestCaseExecutionResult,
  FailedTestCaseExecutionResult,
  PassedTestCaseExecutionResult,
  TestCaseExecutionResult
} from '../../../../shared/execution'

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
