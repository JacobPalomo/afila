export type ProblemDifficulty = 'easy' | 'medium' | 'hard'

export interface Problem {
  readonly id: string
  readonly title: string
  readonly difficulty: ProblemDifficulty
  readonly description: string
  readonly examples: readonly string[]
  readonly constraints: readonly string[]
  readonly fileName: string
  readonly starterCode: string
}
