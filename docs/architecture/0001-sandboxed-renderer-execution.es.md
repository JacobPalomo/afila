# ADR-0001: Ejecución prototipo en un renderer dedicado con sandbox

**Estado:** Aceptado  
**Fecha:** 2026-07-31  
**Tipo de decisión:** Arquitectura de seguridad  
**Alcance:** Compilación y ejecución local de soluciones TypeScript escritas por el usuario

> **Idiomas:** [English](./0001-sandboxed-renderer-execution.md) | Español  
> **Política de sincronización:** Las versiones en inglés y español deben
> actualizarse en el mismo cambio. Cualquier diferencia semántica bloquea el
> cambio hasta que se aclare.

## 1. Contexto

Afila actualmente envía solicitudes de ejecución validadas a un utility process
nuevo de Electron. Ese proceso aplica controles de ciclo de vida y devuelve
resultados simulados deterministas. No compila ni ejecuta el `sourceCode`
escrito por el usuario.

El modelo de amenazas exige que el código real del usuario permanezca fuera del
proceso principal de Electron, el renderer de la interfaz de Afila, el contexto
del preload y cualquier realm de Node.js sin restricciones.

Esta decisión selecciona la arquitectura para el primer prototipo adversarial.
No aprueba la ejecución en producción.

## 2. Resumen de la decisión

Afila prototipará la ejecución real usando dos etapas desechables:

1. Un utility process nuevo de Electron transpila un único archivo TypeScript
   en memoria a JavaScript.
2. Un renderer oculto y nuevo de Chromium ejecuta ese JavaScript con el sandbox
   de procesos de Chromium habilitado y sin Node.js.

El proceso principal permanece como coordinador. Valida todos los mensajes,
crea y termina ambas etapas, aplica el timeout externo y devuelve únicamente un
`RunSolutionResponse` validado.

Se selecciona el prototipo basado en renderer porque:

- Conserva el código de aplicación de Afila únicamente en TypeScript.
- Usa el sandbox de Chromium que Electron ya distribuye.
- Evita agregar un runtime nativo que deba firmarse por separado durante el
  primer prototipo.
- Permite desarrollar primero para macOS sin cerrar el camino hacia Windows y
  Linux.
- Puede crearse y destruirse para cada ejecución aceptada.

La decisión es condicional. La arquitectura basada en renderer no debe
habilitarse en producción si el prototipo no demuestra los criterios
obligatorios, especialmente separación confiable de procesos, terminación,
denegación de red, almacenamiento efímero y control aplicable de memoria.

## 3. Restricciones

El prototipo seleccionado debe conservar estas restricciones del proyecto:

- Aplicación de escritorio con Electron.
- Código de aplicación en TypeScript.
- Ejecución local.
- Sin dependencia de cuenta o nube.
- Desarrollo primero para macOS.
- Camino futuro hacia Windows y Linux.
- Inicialmente, un archivo fuente y un punto de entrada síncrono con nombre.
- Sin imports, resolución de paquetes, acceso a red, timers ni resultados
  Promise pendientes en el modo inicial.
- Sin fallback hacia ejecución en Node.js, preload, main o el renderer de la
  interfaz de Afila.

## 4. Criterios de evaluación

Cada candidato se evalúa según:

1. Aislamiento de capacidades del host.
2. Aplicación externa del límite de CPU.
3. Control de memoria.
4. Control del ciclo de vida de procesos.
5. Denegación de red.
6. Denegación del sistema de archivos.
7. Empaquetado multiplataforma.
8. Compatibilidad con la restricción de TypeScript.
9. Superficie de cadena de suministro.
10. Costo de implementación y mantenimiento.
11. Capacidad de prueba en desarrollo y builds empaquetados.
12. Capacidad de fallar de forma segura.

## 5. Candidato A: renderer dedicado de Chromium con sandbox

Se crea un `BrowserWindow` oculto o un `WebContents` equivalente para una
ejecución y se destruye al terminar.

Propiedades obligatorias del renderer:

- `sandbox: true`
- `nodeIntegration: false`
- `nodeIntegrationInWorker: false`
- `nodeIntegrationInSubFrames: false`
- `contextIsolation: true`
- `webviewTag: false`
- `devTools: false`
- Sin script de preload
- Partición de sesión única y no persistente
- Caché deshabilitada
- Documento runner local y fijo
- Sin navegación, popups ni permisos
- Solicitudes de red denegadas por la sesión dedicada
- Timeout externo controlado por el proceso principal
- Destrucción del renderer después de completar o fallar

### Ventajas

- Los procesos renderer de Chromium usan un sandbox respaldado por el sistema
  operativo.
- Un renderer con sandbox no dispone de un entorno Node.js.
- Electron ya empaqueta Chromium para sus plataformas compatibles.
- La implementación puede permanecer dentro de Electron y TypeScript.
- El main puede observar crashes y falta de respuesta del renderer.
- El main puede terminar el renderer de forma forzada.
- Una partición no persistente puede aislar el almacenamiento del navegador para
  una ejecución.

### Riesgos

- Las APIs del navegador crean una superficie mayor que un motor JavaScript
  mínimo.
- Chromium puede compartir un proceso renderer entre `WebContents` compatibles.
- Terminar a la fuerza un renderer compartido podría afectar a otro
  `WebContents`.
- Electron no expone un límite directo y duro de memoria por renderer.
- Consultar periódicamente la memoria no equivale a un límite duro del sistema
  operativo.
- CSP y la eliminación de APIs son defensa en profundidad, no el sandbox
  principal.
- Electron reconoce que renderizar contenido no confiable es un área difícil.
- Sigue siendo posible una vulnerabilidad de escape del sandbox de Chromium o
  Electron.

### Demostración obligatoria

Antes de ejecutar código, el prototipo debe obtener el PID del sistema
operativo del runner y compararlo con todos los demás `WebContents` activos
devueltos por `webContents.getAllWebContents()`, incluida la interfaz de Afila,
DevTools, páginas de extensiones y cualquier otro contenido oculto.

El PID debe pertenecer exclusivamente al runner. Compartirlo con cualquier otro
`WebContents` activo, privilegiado o no, o no poder comprobar su identidad
produce `execution-failed`. El PID debe comprobarse después de que termine de
cargar el documento fijo y nuevamente justo antes de ejecutar el código. La
concurrencia inicial queda limitada a una ejecución.

## 6. Candidato B: ejecutable independiente con runtime restringido

Afila podría empaquetar e iniciar un ejecutable JavaScript separado, como un
binario CLI de QuickJS-NG configurado cuidadosamente.

### Ventajas

- Proceso separado del sistema operativo.
- Timeout externo y terminación del árbol de procesos.
- QuickJS-NG ofrece límites de memoria mediante su CLI.
- Runtime más pequeño que Chromium.
- Existen binarios precompilados para plataformas principales.

### Riesgos

- Un runtime CLI genérico no es un sandbox diseñado específicamente para Afila.
- Las bibliotecas estándar o funciones de módulos pueden exponer capacidades del
  host.
- Sigue siendo necesario un sandbox adicional del sistema operativo.
- La obtención, verificación, firma y actualización del binario pasan a formar
  parte de la cadena de suministro.
- Cada arquitectura de CPU necesita un binario compatible.
- Stdin, stdout, argumentos y errores necesitan límites estrictos de bytes.
- La CLI genérica expone más comportamiento del que Afila necesita.

### Resultado

No se selecciona para el primer prototipo. Agrega distribución de binarios
nativos sin proporcionar el control de un helper integrado diseñado para Afila.

## 7. Candidato C: motor JavaScript integrado en un helper restringido

Afila podría construir un helper ejecutable que integre un motor JavaScript
mínimo como QuickJS-NG y exponga únicamente la API de pruebas de Afila.

QuickJS-NG proporciona APIs para limitar memoria, limitar stack e instalar un
manejador de interrupciones. Sus bibliotecas opcionales estándar y del sistema
operativo están separadas del motor principal y no se enlazarían al helper.

### Ventajas

- Superficie de capacidades pequeña y explícita.
- Límites de memoria y stack del runtime.
- Manejador de interrupciones del motor para límites cooperativos.
- El supervisor externo todavía puede terminar todo el helper.
- Sin APIs del navegador.
- Sin APIs de Node.js.
- Control fuerte sobre serialización e invocación del punto de entrada.

### Riesgos

- Requiere construir y mantener código nativo en C o C++.
- Entra en conflicto con la restricción actual de implementación en TypeScript.
- Exige compilación, empaquetado, firma y pruebas por plataforma.
- Agrega un componente nativo sensible para la seguridad.
- Todavía necesita sandbox del sistema operativo y terminación externa.
- Las vulnerabilidades del motor pasan a formar parte de la superficie de
  ataque de Afila.

### Resultado

No se selecciona inicialmente. Es el fallback preferido si el Candidato A no
puede satisfacer los criterios de producción, especialmente el control duro de
memoria o la terminación confiable de un proceso dedicado.

## 8. Comparación

| Criterio                              | A: renderer con sandbox | B: CLI de runtime                            | C: helper integrado                          |
| ------------------------------------- | ----------------------- | -------------------------------------------- | -------------------------------------------- |
| Node.js ausente del realm del usuario | Sí                      | Depende del runtime                          | Sí, por diseño                               |
| Frontera de proceso del SO            | Sandbox de Chromium     | Proceso separado; necesita sandbox adicional | Proceso separado; necesita sandbox adicional |
| Timeout externo                       | Sí                      | Sí                                           | Sí                                           |
| Control duro de memoria del runtime   | No demostrado           | Depende de la CLI                            | APIs sólidas del motor                       |
| Superficie de APIs del navegador      | Alta                    | Ninguna                                      | Ninguna                                      |
| Superficie de API del host            | Media                   | Media                                        | Baja                                         |
| Código de app solo en TypeScript      | Sí                      | En su mayoría; incluye binario nativo        | No                                           |
| Build nativo necesario                | No                      | No al usar precompilados                     | Sí                                           |
| Costo de empaquetado multiplataforma  | Bajo                    | Medio                                        | Alto                                         |
| Costo inicial de implementación       | Medio                   | Medio                                        | Alto                                         |
| Potencial de seguridad a largo plazo  | Medio y condicional     | Medio                                        | Alto                                         |
| Seleccionado                          | Prototipo               | No                                           | Fallback                                     |

## 9. Arquitectura seleccionada

### 9.1 Proceso principal

El proceso principal:

- Autentica al renderer que originó la solicitud.
- Valida `RunSolutionRequest`.
- Aplica límites de código, casos de prueba y valores.
- Aplica inicialmente un límite global de una ejecución concurrente.
- Crea un utility process nuevo para el compilador.
- Valida la salida del compilador.
- Crea un renderer runner nuevo con sandbox.
- Confirma la separación del proceso antes de enviar el código.
- Inicia el timeout externo antes de que pueda ejecutarse el código.
- Valida el resultado contra la solicitud original.
- Termina y destruye todos los recursos de ejecución.
- Devuelve únicamente una respuesta validada.

El proceso principal nunca analiza con plugins elegidos por el usuario,
transpila ni ejecuta directamente el código del usuario.

### 9.2 Utility process del compilador

La etapa del compilador:

- Se crea desde cero para cada ejecución aceptada.
- Recibe un string fuente limitado y mantenido en memoria.
- Usa una dependencia fijada del compilador TypeScript.
- No lee un `tsconfig.json` del usuario.
- No carga plugins de TypeScript.
- No resuelve imports ni paquetes.
- No inspecciona archivos arbitrarios del proyecto.
- Rechaza todos los imports y exports estáticos, el import dinámico y las
  capacidades no compatibles.
- Produce texto JavaScript limitado y diagnósticos sanitizados limitados.
- Tiene timeout externo y límite de heap propios.
- Se termina después de completar o fallar.

El primer prototipo puede usar `ts.transpileModule` con diagnósticos. Esto
proporciona transformación de un archivo y diagnósticos sintácticos, pero no
type checking semántico completo. El type checking completo en memoria requiere
una decisión posterior con una allowlist fija de declaraciones de la biblioteca
estándar de TypeScript empaquetadas por Afila.

### 9.3 Renderer runner

El runner usa un renderer oculto nuevo para cada ejecución. El main crea
`runnerSession` como se describe en la sección 9.4 y entrega directamente ese
mismo objeto de sesión a la ventana.

Su configuración mínima es:

```ts
{
  show: false,
  webPreferences: {
    sandbox: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    contextIsolation: true,
    webviewTag: false,
    devTools: false,
    javascript: true,
    session: runnerSession
  }
}
```

No se adjunta ningún script de preload.

El runner carga un documento fijo mediante un esquema personalizado propiedad
de Afila. Los privilegios del esquema, si se registran, se configuran una sola
vez antes de `app.ready`; el handler de cada ejecución se registra en la sesión
dedicada mediante `runnerSession.protocol.handle`.

El esquema no debe habilitar `standard`, `secure`, `bypassCSP`,
`allowServiceWorkers`, `supportFetchAPI`, `corsEnabled`, `stream`, `codeCache`
ni `allowExtensions`. El documento fijo no usa recursos relativos ni remotos y
envía una CSP restrictiva que incluye `script-src 'none'`,
`connect-src 'none'`, `worker-src 'none'`, `frame-src 'none'` y
`object-src 'none'`.

CSP es defensa en profundidad. El prototipo debe comprobar que la ejecución
inyectada por Electron continúa funcionando mientras los scripts, workers y
recursos externos creados por la página permanecen bloqueados.

### 9.4 Restricciones de sesión

Afila mantiene una única sesión runner no persistente durante la vida del
proceso de la aplicación:

```ts
const runnerSession = session.fromPartition("afila-sandbox-runner", {
  cache: false,
});
```

La sesión solo puede reutilizarse de forma secuencial mediante un lease
exclusivo. Cada ejecución continúa creando un BrowserWindow, WebContents,
proceso renderer del sistema operativo y realm aislado de JavaScript nuevos.

El lease solo se libera después de destruir el runner, eliminar todos los
handlers, cerrar las conexiones activas, limpiar los datos y cachés auxiliares
de la sesión y comprobar que la sesión está vacía.

La creación concurrente de runners falla de forma cerrada.

Cualquier fallo de inicialización, validación o limpieza envenena
permanentemente el lease de la sesión durante el resto del proceso de la
aplicación. Una sesión envenenada no puede reutilizarse hasta reiniciar Afila.

La sesión debe:

- Denegar cada solicitud y comprobación de permisos.
- Instalar una política centralizada de denegación mediante
  `webRequest.onBeforeRequest`.
- Cancelar toda solicitud excepto el documento runner fijo inicial.
- Denegar HTTP, HTTPS, WebSocket, FTP, loopback y localhost.
- Denegar subframes y recursos externos.
- Cancelar descargas.
- Cerrar conexiones activas y eliminar handlers de solicitudes, permisos y
  protocolo durante la limpieza.
- Limpiar caché y datos de sesión antes de liberar referencias de la aplicación.
- Nunca usar una partición `persist:`.
- Permitir como máximo un lease de runner activo.
- Crear una ventana, `WebContents`, proceso renderer y realm de JavaScript
  nuevos para cada ejecución.
- Liberar el lease únicamente después de una limpieza completa y de comprobar
  que la sesión está vacía.
- Envenenar permanentemente el lease después de cualquier inicialización o
  limpieza incompleta.

`webRequest` y CSP son capas de defensa en profundidad, no una demostración de
que todo transporte de Chromium esté deshabilitado. El prototipo debe probar por
separado WebRTC, `RTCDataChannel`, STUN/TURN, WebTransport y cualquier transporte
que no aparezca como una solicitud URL normal.

El prototipo también debe ejecutar una prueba prolongada de ejecuciones repetidas
y rechazar el diseño si sesiones, handlers, conexiones o procesos renderer se
acumulan sin una ruta de liberación acotada.

Una prueba prolongada de desarrollo de 200 ciclos utilizando una única sesión
en memoria reutilizable creó 200 procesos renderer distintos con sandbox. Cada
ventana runner, `WebContents` y proceso renderer fue liberado, la aplicación
regresó exactamente a sus conjuntos iniciales de ventanas y `WebContents`, y
los últimos 50 ciclos no mostraron crecimiento monótono de memoria privada.

Se rechazó crear una nueva partición con nombre para cada ejecución porque el
proceso del navegador retenía aproximadamente 1.2 MiB por cada partición nueva
durante la prueba diagnóstica.

### 9.5 Restricciones de navegación y ventanas

El runner debe:

- Denegar `window.open`.
- Impedir toda navegación después de cargar el documento runner fijo.
- Impedir la creación o navegación de frames fuera del frame principal
  esperado.
- Deshabilitar `<webview>`.
- Rechazar descargas.
- Rechazar intentos de abrir URLs externas.
- No adjuntar DevTools nunca.

### 9.6 Invocación del código fuente

El main envía un único script de ejecución generado mediante
`webContents.executeJavaScriptInIsolatedWorld`, usando un identificador de mundo
dedicado distinto de cero y diferente del mundo de aislamiento de contexto de
Electron.

El script generado:

- Usa un wrapper fijo de Afila en modo estricto.
- Captura los objetos integrados originales que necesita antes de ejecutar el
  código del usuario.
- Coloca el JavaScript transpilado dentro de un ámbito léxico nuevo.
- Resuelve exactamente el punto de entrada solicitado.
- Clona los argumentos antes de cada prueba.
- Ejecuta los casos de prueba secuencialmente.
- Rechaza resultados Promise.
- Convierte valores lanzados en errores limitados y sanitizados.
- Acepta únicamente valores permitidos por `TestValue`.
- Aplica límites de profundidad, cantidad de elementos, longitud de strings y
  bytes totales dentro del runner.
- Nunca devuelve un objeto crudo creado por el usuario a través de la frontera de
  proceso.
- Devuelve únicamente un sobre limitado creado por el runner o un string
  serializado limitado.
- No expone un puente IPC de Afila al realm del usuario.

El sobre limitado continúa siendo no confiable. El main debe validarlo
estructuralmente y correlacionar la cantidad exacta de resultados y los
identificadores de prueba con la solicitud original. Un getter, trap de proxy,
falla del serializador o valor sobredimensionado debe fallar de forma segura
dentro del timeout externo.

### 9.7 Timeout y terminación

El timeout pertenece al proceso principal, fuera del renderer no confiable.

Al completar, agotar el tiempo, hacer crash, devolver una respuesta inválida o
fallar un mensaje, el main debe:

1. Resolver la solicitud una sola vez.
2. Impedir que se acepte cualquier resultado posterior.
3. Terminar a la fuerza el renderer cuando sea necesario.
4. Destruir su `BrowserWindow` o `WebContents`.
5. Eliminar listeners de sesión y el handler de protocolo de la ejecución.
6. Cerrar conexiones activas y limpiar caché y datos de sesión.
7. Terminar el utility process del compilador.
8. Confirmar que no permanezca ningún recurso de ejecución activo.

Un timeout dentro del realm del usuario no constituye un control de seguridad.

#### Diagnósticos de terminación en desarrollo

Afila incluye un punto de entrada de diagnóstico exclusivo de desarrollo para
la frontera de terminación del sandbox runner. Acepta únicamente scripts
internos fijos y está deshabilitado en aplicaciones empaquetadas.

El 4 de agosto de 2026, el build preview de Electron en macOS produjo los
siguientes resultados:

- Un script síncrono fijo terminó normalmente en 42 ms.
- Un bucle infinito fijo alcanzó el timeout externo de 250 ms y completó la
  terminación forzada y limpieza en 285 ms.
- Una terminación forzada del renderer produjo `render-process-gone` con razón
  `killed` y código de salida `2`, completando la limpieza en 139 ms.
- Cada escenario restauró exactamente los conjuntos baseline de IDs de
  BrowserWindow y WebContents.
- Cada escenario confirmó que BrowserWindow, WebContents y el proceso renderer
  del sistema operativo dejaron de estar registrados.

La Session reutilizable se libera únicamente después de que desaparezcan la
ventana runner, sus WebContents y la identidad capturada del proceso renderer.
Una falla al comprobar esta liberación invalida el lease de la Session en lugar
de permitir su reutilización.

Estos diagnósticos validan el protocolo de terminación y liberación de recursos
para la configuración de desarrollo probada. No demuestran un comportamiento
equivalente en builds empaquetados ni en todos los sistemas operativos
soportados, no habilitan la ejecución de código escrito por el usuario y no
demuestran contención dura de memoria.

### 9.8 Control de memoria

El prototipo puede observar el proceso renderer mediante su PID del sistema
operativo y las métricas de procesos de Electron.

Esto constituye únicamente un control experimental. No se acepta como límite
duro de memoria.

La ejecución en producción permanece deshabilitada hasta demostrar una opción:

- Límite duro confiable para el proceso renderer dedicado.
- Frontera de memoria de plataforma que pueda aplicarse y probarse.
- Arquitectura posterior usando el helper integrado restringido.

No demostrar la contención de memoria obliga a reemplazar este ADR para
producción.

## 10. Criterios de aceptación del prototipo

El prototipo debe demostrar todo lo siguiente en desarrollo y en builds
empaquetados:

### Aislamiento de procesos

- El runner usa un proceso del SO diferente al de la interfaz de Afila.
- El PID del runner no se comparte con ningún otro `WebContents` activo.
- La exclusividad del PID se comprueba después de cargar y justo antes de
  ejecutar.
- Un crash del runner no provoca crash ni congelamiento de la interfaz.
- Un timeout termina el runner y no deja procesos de ejecución activos.

### Denegación de capacidades

El código del usuario no puede:

- Acceder a `process`, `require`, Electron ni variables globales de Node.js.
- Leer, escribir ni enumerar archivos del host.
- Leer variables de entorno.
- Iniciar procesos o hilos.
- Crear un Worker, SharedWorker o ServiceWorker.
- Conectarse mediante `fetch`, XHR, WebSocket, EventSource, imágenes, medios,
  fuentes, hojas de estilo, formularios, frames, pings, beacons o
  `navigator.sendBeacon`.
- Crear objetos WebRTC con capacidad de red, `RTCDataChannel`, tráfico STUN/TURN
  o sesiones WebTransport.
- Alcanzar servicios loopback o localhost mediante cualquier transporte de
  Chromium.
- Navegar el runner.
- Abrir un popup.
- Iniciar una descarga.
- Acceder desde otra ejecución a cookies, IndexedDB, Cache Storage o
  almacenamiento local persistente.
- Comunicarse con el renderer de la interfaz de Afila.

### Manejo de recursos

- Los bucles infinitos se terminan externamente.
- La recursión profunda no congela la interfaz.
- La salida sobredimensionada se rechaza antes de que un valor crudo del
  usuario cruce la frontera de proceso.
- Los errores sobredimensionados se recortan y sanitizan antes de cruzar la
  frontera de proceso.
- Los resultados tardíos se ignoran.
- Los ataques de crecimiento de memoria se detectan durante el prototipo.
- El equipo demuestra una frontera dura de memoria o registra que el Candidato A
  no es apto para producción.

### Comportamiento correcto

- Las soluciones síncronas válidas se ejecutan correctamente.
- La ausencia del punto de entrada falla de forma segura.
- Los diagnósticos sintácticos están limitados y sanitizados.
- Los errores del runtime están limitados y sanitizados.
- Los IDs y la cantidad de resultados coinciden exactamente con las pruebas
  originales.
- Las ejecuciones repetidas no comparten estado mutable.
- El simulador determinista permanece disponible detrás de la frontera de
  implementación hasta habilitar explícitamente la ejecución real.

## 11. Consecuencias

### Positivas

- El primer prototipo permanece dentro del stack existente de Electron y
  TypeScript.
- No agrega un helper nativo en la implementación inicial.
- El realm del usuario no dispone de Node.js.
- El sandbox de Chromium proporciona una frontera respaldada por el sistema
  operativo.
- La arquitectura es desechable y comprobable.
- El Candidato C permanece disponible como fallback más fuerte.

### Negativas

- Un renderer oculto de Chromium consume memoria y tiempo de arranque.
- Las APIs del navegador requieren muchas pruebas de denegación.
- La contención dura de memoria no está resuelta.
- Debe detectarse el uso compartido de procesos y tratarse como falla.
- La implementación depende del comportamiento de seguridad de Electron y
  Chromium.
- Aprobar el prototipo no elimina el riesgo de escape del sandbox.

## 12. Alternativas rechazadas por ahora

### Ejecutar en el utility process existente

Se rechaza porque dispone de capacidades de Node.js y no es un sandbox para
código malicioso.

### Usar `node:vm`

Se rechaza porque no es una frontera de seguridad para código no confiable.

### Usar un worker thread

Se rechaza porque comparte la frontera de seguridad del proceso Node.js.

### Empaquetar inmediatamente una CLI genérica de QuickJS

Se rechaza porque agrega trabajo de cadena de suministro y empaquetado de
binarios sin la superficie mínima de un helper diseñado específicamente.

### Construir inmediatamente el helper nativo

Se pospone porque entra en conflicto con la restricción de TypeScript y
retrasaría el prototipo adversarial. Permanece como arquitectura fallback.

## 13. Reversión y reemplazo

Este ADR debe reemplazarse si no puede cumplirse cualquiera de los criterios
obligatorios.

El Candidato A no debe conservarse solamente porque ya se haya invertido trabajo
en implementarlo.

El simulador permanece como fallback seguro. Afila nunca debe recurrir a
ejecución en Node.js.

## 14. Secuencia de implementación después de este ADR

1. Agregar contratos y validadores del runner sin ejecutar código fuente.
2. Agregar la sesión dedicada y el protocolo personalizado con limpieza
   determinista.
3. Agregar la fábrica desechable del renderer con sandbox.
4. Demostrar identidad exclusiva del proceso y terminación determinista.
5. Agregar pruebas de permisos, navegación, popups, descargas, workers y red,
   incluidos WebRTC y WebTransport.
6. Agregar pruebas prolongadas para sesiones, handlers y procesos.
7. Agregar pruebas adversariales de timeout, crash y crecimiento de memoria.
8. Agregar la etapa desechable del compilador TypeScript.
9. Ejecutar JavaScript fijo y respuestas limitadas propiedad del runner.
10. Ejecutar JavaScript limitado del usuario detrás de un feature flag exclusivo
    para desarrollo.
11. Ejecutar toda la suite adversarial en un build empaquetado.
12. Decidir si el Candidato A puede continuar o si el Candidato C debe
    reemplazarlo.

## 15. Referencias

- Sandboxing de procesos de Electron:
  https://www.electronjs.org/docs/latest/tutorial/sandbox/
- Seguridad de Electron:
  https://www.electronjs.org/docs/latest/tutorial/security
- BrowserWindow de Electron:
  https://www.electronjs.org/docs/latest/api/browser-window
- WebContents de Electron:
  https://www.electronjs.org/docs/latest/api/web-contents/
- Session de Electron:
  https://www.electronjs.org/docs/latest/api/session
- WebRequest de Electron:
  https://www.electronjs.org/docs/latest/api/web-request
- Protocol de Electron:
  https://www.electronjs.org/docs/latest/api/protocol
- API del compilador TypeScript:
  https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
- QuickJS-NG:
  https://quickjs-ng.github.io/quickjs/
- API C de QuickJS-NG:
  https://quickjs-ng.github.io/quickjs/developer-guide/intro/
