import type { Problem } from '../features/problems/types'
import type { ProblemId } from '../features/problems/catalog'

interface AppHeaderProps {
  readonly problems: readonly Problem[]
  readonly activeProblemId: ProblemId
  readonly dailyProblemId: ProblemId
  readonly onProblemChange: (problemId: string) => void
}

function AppHeader({
  problems,
  activeProblemId,
  dailyProblemId,
  onProblemChange
}: AppHeaderProps): React.JSX.Element {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-name">.afila</span>

        <span className="brand-section">Reto diario</span>
      </div>

      <div className="header-actions">
        <select
          className="problem-selector"
          aria-label="Seleccionar problema"
          value={activeProblemId}
          onChange={(event) => {
            onProblemChange(event.currentTarget.value)
          }}
        >
          {problems.map((problem) => (
            <option key={problem.id} value={problem.id}>
              {problem.title}
              {problem.id === dailyProblemId ? ' · Hoy' : ''}
            </option>
          ))}
        </select>

        <div className="streak" aria-label="Racha actual: cero días">
          <strong>0</strong>
          <span>días</span>
        </div>
      </div>
    </header>
  )
}

export default AppHeader
