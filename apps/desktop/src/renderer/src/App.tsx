import AppHeader from './components/AppHeader'
import EditorPanel from './components/EditorPanel'
import ProblemPanel from './components/ProblemPanel'
import ResultsPanel from './components/ResultsPanel'
import StatusBar from './components/StatusBar'
import { getProblemById } from './features/problems/catalog'

const activeProblem = getProblemById('sum-two-numbers')

function App(): React.JSX.Element {
  return (
    <div className="app-shell">
      <AppHeader />

      <div className="app-workspace">
        <ProblemPanel problem={activeProblem} />

        <main className="solution-workspace">
          <EditorPanel fileName={activeProblem.fileName} starterCode={activeProblem.starterCode} />
          <ResultsPanel />
        </main>
      </div>

      <StatusBar />
    </div>
  )
}

export default App
