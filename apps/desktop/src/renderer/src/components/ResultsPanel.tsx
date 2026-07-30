function ResultsPanel(): React.JSX.Element {
  return (
    <section className="results-panel" aria-labelledby="results-title">
      <header className="panel-toolbar">
        <h2 id="results-title">Resultados</h2>
      </header>

      <div className="results-empty">
        <p>Aún no has ejecutado tu solución.</p>
        <span>Los casos de prueba aparecerán aquí.</span>
      </div>
    </section>
  )
}

export default ResultsPanel
