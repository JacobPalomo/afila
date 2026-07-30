import { useState } from 'react'
import AppHeader from './components/AppHeader'
import EditorPanel from './components/EditorPanel'
import ProblemPanel from './components/ProblemPanel'
import ResultsPanel from './components/ResultsPanel'
import StatusBar from './components/StatusBar'
import { simulateSolutionExecution } from './features/execution/simulator'
import type { SolutionExecutionState } from './features/execution/types'
import { getProblemById } from './features/problems/catalog'
import { useSolutionDraft } from './features/solutions/use-solution-draft'

const activeProblem = getProblemById('sum-two-numbers')

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

    void simulateSolutionExecution(activeProblem.testCases).then(
      (results) => {
        setExecutionState({
          status: 'completed',
          results
        })
      },
      () => {
        setExecutionState({
          status: 'error',
          message: 'No se pudo completar la simulación.',
          results: []
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
