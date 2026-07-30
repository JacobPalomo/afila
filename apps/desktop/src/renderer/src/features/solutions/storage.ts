const SOLUTION_DRAFT_KEY_PREFIX = 'afila:solution-draft:v1'

function getSolutionDraftKey(problemId: string): string {
  return `${SOLUTION_DRAFT_KEY_PREFIX}:${problemId}`
}

export function loadSolutionDraft(problemId: string, starterCode: string): string {
  try {
    return window.localStorage.getItem(getSolutionDraftKey(problemId)) ?? starterCode
  } catch {
    return starterCode
  }
}

export function persistSolutionDraft(
  problemId: string,
  code: string,
  starterCode: string
): boolean {
  try {
    const storageKey = getSolutionDraftKey(problemId)

    if (code === starterCode) {
      window.localStorage.removeItem(storageKey)
    } else {
      window.localStorage.setItem(storageKey, code)
    }

    return true
  } catch {
    return false
  }
}
