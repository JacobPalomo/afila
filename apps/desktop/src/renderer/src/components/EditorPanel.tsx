interface EditorPanelProps {
  fileName: string
  starterCode: string
}

function EditorPanel({ fileName, starterCode }: EditorPanelProps): React.JSX.Element {
  const lineCount = starterCode.split('\n').length

  return (
    <section className="editor-panel" aria-labelledby="editor-title">
      <header className="panel-toolbar">
        <div className="file-label">
          <span className="file-status" aria-hidden="true" />
          <h2 id="editor-title">{fileName}</h2>
        </div>

        <button type="button" disabled>
          Ejecutar
          <kbd>⌘↵</kbd>
        </button>
      </header>

      <div className="editor-placeholder" aria-label="Vista previa del editor">
        <div className="line-numbers" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, index) => (
            <span key={index + 1}>{index + 1}</span>
          ))}
        </div>

        <pre>
          <code>{starterCode}</code>
        </pre>
      </div>
    </section>
  )
}

export default EditorPanel
