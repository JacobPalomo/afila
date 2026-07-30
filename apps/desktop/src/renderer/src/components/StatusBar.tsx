interface StatusBarProps {
  isSolutionModified: boolean
}

function StatusBar({ isSolutionModified }: StatusBarProps): React.JSX.Element {
  return (
    <footer className="app-statusbar">
      <span className="ready-status">
        <span className="ready-indicator" aria-hidden="true" />
        Listo
      </span>

      <div>
        <span>TypeScript</span>
        <span>{isSolutionModified ? 'Cambios sin guardar' : 'Código inicial'}</span>
      </div>
    </footer>
  )
}

export default StatusBar
