import { useState } from 'react'
import AppHeader from './components/AppHeader'
import EditorPanel from './components/EditorPanel'
import ProblemPanel from './components/ProblemPanel'
import ResultsPanel from './components/ResultsPanel'
import StatusBar from './components/StatusBar'
import type { SolutionExecutionState, TestCaseExecutionResult } from './features/execution/types'
import {
  getProblemById,
  isProblemId,
  problemCatalog,
  type ProblemId
} from './features/problems/catalog'
import type { Problem } from './features/problems/types'
import { useSolutionDraft } from './features/solutions/use-solution-draft'

const DEFAULT_PROBLEM_ID: ProblemId = 'sum-two-numbers'

interface ProblemWorkspaceProps {
  readonly problem: Problem
}

function createExecutionErrorResults(
  problem: Problem,
  message: string
): readonly TestCaseExecutionResult[] {
  return problem.testCases.map((testCase) => ({
    status: 'error',
    testCaseId: testCase.id,
    durationMs: 0,
    message
  }))
}

function ProblemWorkspace({ problem }: ProblemWorkspaceProps): React.JSX.Element {
  const { code, isModified, hasPersistenceError, updateCode } = useSolutionDraft(problem)

  const [executionState, setExecutionState] = useState<SolutionExecutionState>({
    status: 'idle'
  })

  const isExecutionRunning = executionState.status === 'running'

  const runSolution = (): void => {
    if (isExecutionRunning) {
      return
    }

    setExecutionState({
      status: 'running',
      results: []
    })

    void window.api.execution
      .run({
        problemId: problem.id,
        sourceCode: code,
        testCases: problem.testCases.map(({ id, args, expected }) => ({
          id,
          args,
          expected
        }))
      })
      .then(
        (response) => {
          if (!response.ok) {
            setExecutionState({
              status: 'error',
              message: response.error.message,
              results: createExecutionErrorResults(problem, response.error.message)
            })

            return
          }

          setExecutionState({
            status: 'completed',
            results: response.results
          })
        },
        () => {
          const message = 'No se pudo comunicar con el proceso de ejecución.'

          setExecutionState({
            status: 'error',
            message,
            results: createExecutionErrorResults(problem, message)
          })
        }
      )
  }

  const handleCodeChange = (nextCode: string): void => {
    updateCode(nextCode)

    setExecutionState({
      status: 'idle'
    })
  }

  return (
    <>
      <div className="app-workspace">
        <ProblemPanel problem={problem} />

        <main className="solution-workspace">
          <EditorPanel
            fileName={problem.fileName}
            code={code}
            isRunning={isExecutionRunning}
            onCodeChange={handleCodeChange}
            onRun={runSolution}
          />

          <ResultsPanel testCases={problem.testCases} executionState={executionState} />
        </main>
      </div>

      <StatusBar isSolutionModified={isModified} hasPersistenceError={hasPersistenceError} />
    </>
  )
}

function App(): React.JSX.Element {
  const [activeProblemId, setActiveProblemId] = useState<ProblemId>(DEFAULT_PROBLEM_ID)

  const activeProblem = getProblemById(activeProblemId)

  const handleProblemChange = (nextProblemId: string): void => {
    if (!isProblemId(nextProblemId)) {
      return
    }

    setActiveProblemId(nextProblemId)
  }

  return (
    <div className="app-shell">
      <AppHeader
        problems={problemCatalog}
        activeProblemId={activeProblemId}
        onProblemChange={handleProblemChange}
      />

      <ProblemWorkspace key={activeProblem.id} problem={activeProblem} />
    </div>
  )
}

export default App
