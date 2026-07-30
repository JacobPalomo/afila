import AppHeader from './components/AppHeader'
import EditorPanel from './components/EditorPanel'
import ProblemPanel from './components/ProblemPanel'
import ResultsPanel from './components/ResultsPanel'
import StatusBar from './components/StatusBar'

function App(): React.JSX.Element {
  return (
    <div className="app-shell">
      <AppHeader />

      <div className="app-workspace">
        <ProblemPanel />

        <main className="solution-workspace">
          <EditorPanel />
          <ResultsPanel />
        </main>
      </div>

      <StatusBar />
    </div>
  )
}

export default App
