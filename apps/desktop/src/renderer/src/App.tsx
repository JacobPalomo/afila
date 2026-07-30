import { useState } from 'react'
import AppHeader from './components/AppHeader'
import EditorPanel from './components/EditorPanel'
import ProblemPanel from './components/ProblemPanel'
import ResultsPanel from './components/ResultsPanel'
import StatusBar from './components/StatusBar'
import { getProblemById } from './features/problems/catalog'

const activeProblem = getProblemById('sum-two-numbers')

function App(): React.JSX.Element {
  const [solutionCode, setSolutionCode] = useState(() => activeProblem.starterCode)

  const isSolutionModified = solutionCode !== activeProblem.starterCode

  return (
    <div className="app-shell">
      <AppHeader />

      <div className="app-workspace">
        <ProblemPanel problem={activeProblem} />

        <main className="solution-workspace">
          <EditorPanel
            fileName={activeProblem.fileName}
            code={solutionCode}
            onCodeChange={setSolutionCode}
          />

          <ResultsPanel />
        </main>
      </div>

      <StatusBar isSolutionModified={isSolutionModified} />
    </div>
  )
}

export default App
