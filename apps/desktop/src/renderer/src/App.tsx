import AppHeader from './components/AppHeader'
import EditorPanel from './components/EditorPanel'
import ProblemPanel from './components/ProblemPanel'
import ResultsPanel from './components/ResultsPanel'
import StatusBar from './components/StatusBar'
import { sumTwoNumbersProblem } from './features/problems/data/sum-two-numbers'

function App(): React.JSX.Element {
  return (
    <div className="app-shell">
      <AppHeader />

      <div className="app-workspace">
        <ProblemPanel problem={sumTwoNumbersProblem} />

        <main className="solution-workspace">
          <EditorPanel
            fileName={sumTwoNumbersProblem.fileName}
            starterCode={sumTwoNumbersProblem.starterCode}
          />
          <ResultsPanel />
        </main>
      </div>

      <StatusBar />
    </div>
  )
}

export default App
