interface EditorPanelProps {
  fileName: string
  code: string
  isRunning: boolean
  onCodeChange: (code: string) => void
  onRun: () => void
}

function EditorPanel({
  fileName,
  code,
  isRunning,
  onCodeChange,
  onRun
}: EditorPanelProps): React.JSX.Element {
  const lineCount = Math.max(1, code.split('\n').length)

  return (
    <section className="editor-panel" aria-labelledby="editor-title">
      <header className="panel-toolbar">
        <div className="file-label">
          <span className="file-status" aria-hidden="true" />
          <h2 id="editor-title">{fileName}</h2>
        </div>

        <button type="button" disabled={isRunning} onClick={onRun}>
          {isRunning ? 'Ejecutando' : 'Ejecutar'}
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
          readOnly={isRunning}
          aria-label={`Editor de ${fileName}`}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => {
            onCodeChange(event.currentTarget.value)
          }}
          onKeyDown={(event) => {
            const isExecutionShortcut = event.key === 'Enter' && (event.metaKey || event.ctrlKey)

            if (!isExecutionShortcut) {
              return
            }

            event.preventDefault()

            if (!isRunning) {
              onRun()
            }
          }}
        />
      </div>
    </section>
  )
}

export default EditorPanel
