function AppHeader(): React.JSX.Element {
  return (
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
  )
}

export default AppHeader
