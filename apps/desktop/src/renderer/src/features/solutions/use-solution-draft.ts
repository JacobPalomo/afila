import { useState } from 'react'
import type { Problem } from '../problems/types'
import { loadSolutionDraft, persistSolutionDraft } from './storage'

interface SolutionDraft {
  code: string
  isModified: boolean
  hasPersistenceError: boolean
  updateCode: (code: string) => void
}

export function useSolutionDraft(problem: Problem): SolutionDraft {
  const [code, setCode] = useState(() => loadSolutionDraft(problem.id, problem.starterCode))

  const [hasPersistenceError, setHasPersistenceError] = useState(false)

  const updateCode = (nextCode: string): void => {
    const wasPersisted = persistSolutionDraft(problem.id, nextCode, problem.starterCode)

    setCode(nextCode)
    setHasPersistenceError(!wasPersisted)
  }

  return {
    code,
    isModified: code !== problem.starterCode,
    hasPersistenceError,
    updateCode
  }
}
