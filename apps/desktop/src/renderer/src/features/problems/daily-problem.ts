import { problemCatalog, type ProblemId } from './catalog'

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

export function getLocalDayNumber(date: Date): number {
  if (Number.isNaN(date.getTime())) {
    throw new Error('Cannot resolve a daily problem from an invalid date')
  }

  const localCalendarDateAsUTC = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())

  return Math.floor(localCalendarDateAsUTC / MILLISECONDS_PER_DAY)
}

export function getDailyProblemId(date: Date): ProblemId {
  const problemCount = problemCatalog.length
  const dayNumber = getLocalDayNumber(date)

  const problemIndex = ((dayNumber % problemCount) + problemCount) % problemCount

  const problem = problemCatalog[problemIndex]

  if (problem === undefined) {
    throw new Error('The problem catalog cannot be empty')
  }

  return problem.id
}
