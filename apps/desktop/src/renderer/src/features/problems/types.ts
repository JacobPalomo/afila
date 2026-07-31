import type { ExecutionTestCase } from '../../../../shared/execution'

export type { TestValue } from '../../../../shared/execution'

export type ProblemDifficulty = 'easy' | 'medium' | 'hard'

export interface ProblemTestCase extends ExecutionTestCase {
  readonly label: string
}

export interface Problem {
  readonly id: string
  readonly title: string
  readonly difficulty: ProblemDifficulty
  readonly description: string
  readonly examples: readonly string[]
  readonly constraints: readonly string[]
  readonly fileName: string
  readonly entryPoint: string
  readonly starterCode: string
  readonly testCases: readonly ProblemTestCase[]
}
