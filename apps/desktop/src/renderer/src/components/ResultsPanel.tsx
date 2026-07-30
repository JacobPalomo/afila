import type { SolutionExecutionState, TestCaseExecutionResult } from '../features/execution/types'
import type { ProblemTestCase, TestValue } from '../features/problems/types'

interface ResultsPanelProps {
  testCases: readonly ProblemTestCase[]
  executionState: SolutionExecutionState
}

type DisplayStatus = 'pending' | 'running' | TestCaseExecutionResult['status']

const statusLabels: Record<DisplayStatus, string> = {
  pending: 'Pendiente',
  running: 'Ejecutando',
  passed: 'Correcto',
  failed: 'Incorrecto',
  error: 'Error'
}

function formatTestValue(value: TestValue): string {
  return JSON.stringify(value) ?? 'null'
}

function getDisplayStatus(
  executionState: SolutionExecutionState,
  result: TestCaseExecutionResult | undefined
): DisplayStatus {
  if (result !== undefined) {
    return result.status
  }

  if (executionState.status === 'running') {
    return 'running'
  }

  return 'pending'
}

function getResultDetail(
  testCase: ProblemTestCase,
  result: TestCaseExecutionResult | undefined
): string {
  if (result === undefined) {
    return `Entrada: ${formatTestValue(testCase.args)} · Esperado: ${formatTestValue(
      testCase.expected
    )}`
  }

  if (result.status === 'error') {
    return result.message
  }

  if (result.status === 'failed') {
    return `Obtenido: ${formatTestValue(result.actual)} · Esperado: ${formatTestValue(
      testCase.expected
    )}`
  }

  return `Resultado: ${formatTestValue(result.actual)} · ${result.durationMs} ms`
}

function ResultsPanel({ testCases, executionState }: ResultsPanelProps): React.JSX.Element {
  const executionResults = executionState.status === 'idle' ? [] : executionState.results

  const resultsByTestCaseId = new Map(executionResults.map((result) => [result.testCaseId, result]))

  return (
    <section className="results-panel" aria-labelledby="results-title">
      <header className="panel-toolbar">
        <h2 id="results-title">Resultados</h2>
        <span className="results-summary">{testCases.length} casos</span>
      </header>

      <div className="results-list">
        {testCases.map((testCase) => {
          const result = resultsByTestCaseId.get(testCase.id)
          const displayStatus = getDisplayStatus(executionState, result)

          return (
            <article className={`test-result test-result--${displayStatus}`} key={testCase.id}>
              <span className="test-result-indicator" aria-hidden="true" />

              <div className="test-result-content">
                <strong>{testCase.label}</strong>
                <span>{getResultDetail(testCase, result)}</span>
              </div>

              <span className="test-result-status">{statusLabels[displayStatus]}</span>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default ResultsPanel
