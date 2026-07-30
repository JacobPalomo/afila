function EditorPanel(): React.JSX.Element {
  return (
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
  )
}

export default EditorPanel
