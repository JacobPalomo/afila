import type { Problem, ProblemDifficulty } from '../features/problems/types'

interface ProblemPanelProps {
  problem: Problem
}

const difficultyLabels: Record<ProblemDifficulty, string> = {
  easy: 'Fácil',
  medium: 'Medio',
  hard: 'Difícil'
}

function ProblemPanel({ problem }: ProblemPanelProps): React.JSX.Element {
  return (
    <aside className="problem-panel" aria-labelledby="problem-title">
      <header className="problem-heading">
        <div>
          <p className="eyebrow">Problema de hoy</p>
          <h1 id="problem-title">{problem.title}</h1>
        </div>

        <span className="difficulty">{difficultyLabels[problem.difficulty]}</span>
      </header>

      <div className="problem-content">
        <p>{problem.description}</p>

        <section>
          <h2>Ejemplo</h2>

          <pre>
            <code>{problem.examples.join('\n')}</code>
          </pre>
        </section>

        <section>
          <h2>Restricciones</h2>

          <ul>
            {problem.constraints.map((constraint) => (
              <li key={constraint}>{constraint}</li>
            ))}
          </ul>
        </section>
      </div>
    </aside>
  )
}

export default ProblemPanel
