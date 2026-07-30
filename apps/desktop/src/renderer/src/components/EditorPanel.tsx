interface EditorPanelProps {
  fileName: string
  code: string
  onCodeChange: (code: string) => void
}

function EditorPanel({ fileName, code, onCodeChange }: EditorPanelProps): React.JSX.Element {
  const lineCount = Math.max(1, code.split('\n').length)

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

      <div className="editor-placeholder">
        <div className="line-numbers" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, index) => (
            <span key={index + 1}>{index + 1}</span>
          ))}
        </div>

        <textarea
          className="solution-editor"
          value={code}
          rows={lineCount}
          wrap="off"
          aria-label={`Editor de ${fileName}`}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => {
            onCodeChange(event.currentTarget.value)
          }}
        />
      </div>
    </section>
  )
}

export default EditorPanel
