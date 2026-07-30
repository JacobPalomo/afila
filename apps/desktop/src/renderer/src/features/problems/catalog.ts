import { reverseStringProblem } from './data/reverse-string'
import { sumTwoNumbersProblem } from './data/sum-two-numbers'
import type { Problem } from './types'

export const problemCatalog = [
  sumTwoNumbersProblem,
  reverseStringProblem
] as const satisfies readonly Problem[]

export type ProblemId = (typeof problemCatalog)[number]['id']

export function isProblemId(value: string): value is ProblemId {
  return problemCatalog.some(({ id }) => id === value)
}

export function getProblemById(problemId: ProblemId): Problem {
  const problem = problemCatalog.find(({ id }) => id === problemId)

  if (problem === undefined) {
    throw new Error(`Problem "${problemId}" was not found`)
  }

  return problem
}
