function ProblemPanel(): React.JSX.Element {
  return (
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
  )
}

export default ProblemPanel
