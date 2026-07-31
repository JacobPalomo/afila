import { describe, expect, it } from 'vitest'
import { problemCatalog } from './catalog'
import { getDailyProblemId, getLocalDayNumber } from './daily-problem'

describe('getLocalDayNumber', () => {
  it('uses the local calendar date', () => {
    const startOfDay = new Date(2026, 6, 30, 0, 0, 0)

    const endOfDay = new Date(2026, 6, 30, 23, 59, 59)

    expect(getLocalDayNumber(startOfDay)).toBe(getLocalDayNumber(endOfDay))
  })

  it('increments between consecutive dates', () => {
    const firstDate = new Date(2026, 6, 30)

    const nextDate = new Date(2026, 6, 31)

    expect(getLocalDayNumber(nextDate)).toBe(getLocalDayNumber(firstDate) + 1)
  })

  it('rejects invalid dates', () => {
    expect(() => {
      getLocalDayNumber(new Date(Number.NaN))
    }).toThrow('Cannot resolve a daily problem from an invalid date')
  })
})

describe('getDailyProblemId', () => {
  it('returns a catalog problem id', () => {
    const problemId = getDailyProblemId(new Date(2026, 6, 30))

    expect(problemCatalog.some(({ id }) => id === problemId)).toBe(true)
  })

  it('rotates on consecutive dates', () => {
    expect(problemCatalog.length).toBeGreaterThan(1)

    const firstProblemId = getDailyProblemId(new Date(2026, 6, 30))

    const nextProblemId = getDailyProblemId(new Date(2026, 6, 31))

    expect(nextProblemId).not.toBe(firstProblemId)
  })
})
