import { useState } from 'react'
import AppHeader from './components/AppHeader'
import EditorPanel from './components/EditorPanel'
import ProblemPanel from './components/ProblemPanel'
import ResultsPanel from './components/ResultsPanel'
import StatusBar from './components/StatusBar'
import type { SolutionExecutionState, TestCaseExecutionResult } from './features/execution/types'
import { getProblemById } from './features/problems/catalog'
import { useSolutionDraft } from './features/solutions/use-solution-draft'

const activeProblem = getProblemById('sum-two-numbers')

function createExecutionErrorResults(message: string): readonly TestCaseExecutionResult[] {
  return activeProblem.testCases.map((testCase) => ({
    status: 'error',
    testCaseId: testCase.id,
    durationMs: 0,
    message
  }))
}

function App(): React.JSX.Element {
  const { code, isModified, hasPersistenceError, updateCode } = useSolutionDraft(activeProblem)

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
        problemId: activeProblem.id,
        sourceCode: code,
        testCases: activeProblem.testCases.map(({ id, args, expected }) => ({
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
              results: createExecutionErrorResults(response.error.message)
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
            results: createExecutionErrorResults(message)
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
    <div className="app-shell">
      <AppHeader />

      <div className="app-workspace">
        <ProblemPanel problem={activeProblem} />

        <main className="solution-workspace">
          <EditorPanel
            fileName={activeProblem.fileName}
            code={code}
            isRunning={isExecutionRunning}
            onCodeChange={handleCodeChange}
            onRun={runSolution}
          />

          <ResultsPanel testCases={activeProblem.testCases} executionState={executionState} />
        </main>
      </div>

      <StatusBar isSolutionModified={isModified} hasPersistenceError={hasPersistenceError} />
    </div>
  )
}

export default App
