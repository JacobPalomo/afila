import AppHeader from './components/AppHeader'
import EditorPanel from './components/EditorPanel'
import ProblemPanel from './components/ProblemPanel'
import ResultsPanel from './components/ResultsPanel'
import StatusBar from './components/StatusBar'
import { getProblemById } from './features/problems/catalog'
import { useSolutionDraft } from './features/solutions/use-solution-draft'

const activeProblem = getProblemById('sum-two-numbers')

function App(): React.JSX.Element {
  const { code, isModified, hasPersistenceError, updateCode } = useSolutionDraft(activeProblem)

  return (
    <div className="app-shell">
      <AppHeader />

      <div className="app-workspace">
        <ProblemPanel problem={activeProblem} />

        <main className="solution-workspace">
          <EditorPanel fileName={activeProblem.fileName} code={code} onCodeChange={updateCode} />

          <ResultsPanel />
        </main>
      </div>

      <StatusBar isSolutionModified={isModified} hasPersistenceError={hasPersistenceError} />
    </div>
  )
}

export default App
