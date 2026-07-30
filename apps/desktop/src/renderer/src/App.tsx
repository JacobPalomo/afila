function App(): React.JSX.Element {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-name">.afila</span>
          <span className="brand-section">Reto diario</span>
        </div>

        <div className="streak" aria-label="Racha actual: cero días">
          <strong>0</strong>
          <span>días</span>
        </div>
      </header>

      <div className="app-workspace">
        <aside className="problem-panel" aria-labelledby="problem-title">
          <header className="problem-heading">
            <div>
              <p className="eyebrow">Problema de hoy</p>
              <h1 id="problem-title">Suma de dos números</h1>
            </div>

            <span className="difficulty">Fácil</span>
          </header>

          <div className="problem-content">
            <p>Escribe una función que reciba dos números y devuelva la suma de ambos.</p>

            <section>
              <h2>Ejemplo</h2>

              <pre>
                <code>{`sumar(2, 3) // 5
sumar(-4, 7) // 3`}</code>
              </pre>
            </section>

            <section>
              <h2>Restricciones</h2>

              <ul>
                <li>Los argumentos siempre serán números enteros.</li>
                <li>La función debe devolver un número.</li>
              </ul>
            </section>
          </div>
        </aside>

        <main className="solution-workspace">
          <section className="editor-panel" aria-labelledby="editor-title">
            <header className="panel-toolbar">
              <div className="file-label">
                <span className="file-status" aria-hidden="true" />
                <h2 id="editor-title">solution.ts</h2>
              </div>

              <button type="button" disabled>
                Ejecutar
                <kbd>⌘↵</kbd>
              </button>
            </header>

            <div className="editor-placeholder" aria-label="Vista previa del editor">
              <div className="line-numbers" aria-hidden="true">
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
              </div>

              <pre>
                <code>{`function sumar(a: number, b: number): number {
  return a + b
}`}</code>
              </pre>
            </div>
          </section>

          <section className="results-panel" aria-labelledby="results-title">
            <header className="panel-toolbar">
              <h2 id="results-title">Resultados</h2>
            </header>

            <div className="results-empty">
              <p>Aún no has ejecutado tu solución.</p>
              <span>Los casos de prueba aparecerán aquí.</span>
            </div>
          </section>
        </main>
      </div>

      <footer className="app-statusbar">
        <span className="ready-status">
          <span className="ready-indicator" aria-hidden="true" />
          Listo
        </span>

        <div>
          <span>TypeScript</span>
          <span>Guardado localmente</span>
        </div>
      </footer>
    </div>
  )
}

export default App
