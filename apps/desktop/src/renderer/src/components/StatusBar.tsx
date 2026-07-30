interface StatusBarProps {
  isSolutionModified: boolean
  hasPersistenceError: boolean
}

function StatusBar({ isSolutionModified, hasPersistenceError }: StatusBarProps): React.JSX.Element {
  let solutionStatus = 'Código inicial'

  if (hasPersistenceError) {
    solutionStatus = 'No se pudo guardar'
  } else if (isSolutionModified) {
    solutionStatus = 'Guardado localmente'
  }

  return (
    <footer className="app-statusbar">
      <span className="ready-status">
        <span className="ready-indicator" aria-hidden="true" />
        Listo
      </span>

      <div>
        <span>TypeScript</span>
        <span>{solutionStatus}</span>
      </div>
    </footer>
  )
}

export default StatusBar
