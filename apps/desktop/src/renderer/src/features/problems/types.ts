export type ProblemDifficulty = 'easy' | 'medium' | 'hard'

export type TestValue =
  string | number | boolean | null | readonly TestValue[] | { readonly [key: string]: TestValue }

export interface ProblemTestCase {
  readonly id: string
  readonly label: string
  readonly args: readonly TestValue[]
  readonly expected: TestValue
}

export interface Problem {
  readonly id: string
  readonly title: string
  readonly difficulty: ProblemDifficulty
  readonly description: string
  readonly examples: readonly string[]
  readonly constraints: readonly string[]
  readonly fileName: string
  readonly starterCode: string
  readonly testCases: readonly ProblemTestCase[]
}
