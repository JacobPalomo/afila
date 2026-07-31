# Modelo de amenazas del sandbox de ejecución

**Estado:** Propuesto  
**Fecha:** 2026-07-31  
**Alcance:** Ejecución local de soluciones TypeScript escritas por el usuario

> **Idiomas:** [English](./execution-sandbox-threat-model.md) | Español  
> **Política de sincronización:** Las versiones en inglés y español deben actualizarse en el mismo cambio. Si existe alguna diferencia entre ambas, los requisitos de seguridad deben aclararse antes de fusionar el cambio.

## 1. Propósito

Afila acepta código fuente TypeScript escrito o pegado por un usuario y lo evalúa contra casos de prueba locales.

El código fuente siempre debe tratarse como hostil, incluso cuando lo haya escrito el propietario de la computadora. El código pegado, el código generado, las soluciones compartidas y los cálculos infinitos accidentales pueden amenazar a la aplicación host y al sistema operativo.

Este documento define las fronteras de seguridad y los criterios mínimos de aceptación que deben cumplirse antes de que Afila ejecute código real escrito por el usuario.

No selecciona una implementación final del sandbox. Los runtimes candidatos deben evaluarse contra estos requisitos en una decisión de arquitectura separada.

## 2. Arquitectura actual

La ruta actual de ejecución es:

1. El renderer envía una solicitud de ejecución mediante una API restringida del preload.
2. El proceso principal valida al emisor de IPC.
3. El proceso principal valida el payload de la solicitud.
4. Se crea un nuevo utility process de Electron para la solicitud.
5. El proceso principal y el utility process se comunican mediante un protocolo tipado y validado en tiempo de ejecución.
6. El utility process devuelve resultados simulados deterministas.
7. El proceso principal valida la respuesta.
8. El utility process se termina.
9. La respuesta validada se devuelve al renderer.

El utility process actual dispone de un entorno Node.js. Es un supervisor de ejecución y una frontera para el ciclo de vida, no un sandbox de seguridad para el código del usuario.

Actualmente, `sourceCode` escrito por el usuario se transfiere, pero no se compila, evalúa ni ejecuta.

## 3. Objetivo de seguridad

Ejecutar una solución no debe concederle ninguna capacidad fuera de la API del reto de programación definida explícitamente.

Una solución puede:

- Recibir argumentos de prueba clonados.
- Usar un subconjunto aprobado del lenguaje JavaScript y de los objetos integrados estándar.
- Devolver un resultado serializable.
- Lanzar un error limitado que pueda convertirse en un resultado seguro.
- Consumir CPU y memoria únicamente dentro de límites aplicados externamente.

Una solución no debe:

- Leer ni escribir archivos.
- Descubrir rutas del sistema de archivos.
- Leer variables de entorno.
- Acceder al estado de la aplicación, borradores o datos de problemas no incluidos en la solicitud.
- Acceder a APIs de Electron o Node.js.
- Cargar módulos, paquetes o complementos nativos.
- Iniciar procesos, workers o hilos.
- Acceder a la red.
- Abrir sockets o canales IPC.
- Usar el shell del sistema.
- Acceder al portapapeles, cámara, micrófono u otras APIs de dispositivos.
- Persistir datos fuera de su ejecución aislada.
- Comunicarse con otra ejecución.
- Modificar el renderer, preload o proceso principal de Afila.
- Impedir que el supervisor de ejecución la termine.

## 4. Activos protegidos

El sandbox debe proteger:

### 4.1 Datos del host

- Archivos del usuario.
- Datos de la aplicación.
- Variables de entorno.
- Credenciales, tokens y cookies.
- Almacenamiento del navegador y de la aplicación.
- Contenido del portapapeles.
- Configuración del sistema operativo.

### 4.2 Integridad de la aplicación

- Proceso principal de Electron.
- Puente del preload.
- Estado del renderer.
- Archivos instalados de la aplicación.
- Catálogo de problemas.
- Casos de prueba.
- Borradores de soluciones almacenados.
- Protocolo de ejecución.

### 4.3 Disponibilidad del host

- Tiempo de CPU.
- Memoria.
- Cantidad de procesos.
- Descriptores de archivo.
- Sockets de red.
- Capacidad del disco.
- Capacidad de IPC.
- Capacidad de respuesta del renderer.

### 4.4 Integridad de resultados

- Identificadores de las pruebas.
- Orden de las pruebas.
- Valores esperados.
- Valores obtenidos.
- Estado de ejecución.
- Mensajes de error.
- Información de duración.

## 5. Suposiciones de confianza

Los siguientes valores no son confiables:

- Código fuente del usuario.
- Nombres de funciones recibidos mediante IPC.
- Argumentos de prueba recibidos a través de una frontera de proceso.
- Resultados devueltos por un runtime de ejecución.
- Nombres de errores, mensajes y stack traces.
- Diagnósticos del compilador.
- Valores serializados.
- Códigos de salida de procesos.
- Mensajes recibidos después de que una ejecución haya finalizado.

Los siguientes componentes se consideran confiables dentro de este modelo de amenazas:

- La aplicación empaquetada de Afila.
- El proceso principal de Electron.
- El puente restringido del preload.
- Los validadores de solicitudes y respuestas.
- Los binarios del compilador y del runtime seleccionados después de revisar sus dependencias.
- El sistema operativo y sus primitivas de aislamiento de procesos.

Confiar en un componente no elimina la necesidad de validar cada mensaje que cruce una frontera de proceso.

## 6. Capacidades del atacante

Un atacante puede enviar código fuente diseñado para:

- Ejecutar un bucle infinito.
- Asignar memoria hasta agotarla.
- Producir valores extremadamente profundos o grandes.
- Generar strings o mensajes de error muy grandes.
- Activar casos límite del parser, compilador o runtime.
- Modificar prototipos integrados.
- Escapar de un contexto del lenguaje.
- Acceder a variables globales de Node.js.
- Cargar código dinámicamente.
- Descubrir objetos del host mediante cadenas de prototipos.
- Crear trabajo asíncrono que sobreviva a la llamada del punto de entrada.
- Aprovechar condiciones de carrera entre el inicio, timeout y terminación de procesos.
- Falsificar resultados de ejecución.
- Reutilizar o cambiar identificadores de solicitudes.
- Explotar mensajes tardíos de una ejecución anterior.
- Provocar la terminación anormal de un proceso.
- Explotar vulnerabilidades del compilador o del runtime.

El atacante no necesita tener acceso al código fuente de Afila ni a su sistema de archivos. La solución enviada se considera por sí sola una entrada suficiente del atacante.

## 7. Fronteras de confianza

### Frontera A: renderer a preload

El renderer solo puede invocar métodos de alcance reducido expuestos por el puente del preload.

Las APIs IPC sin restricciones de Electron nunca deben exponerse.

### Frontera B: preload a proceso principal

El proceso principal debe autenticar al emisor, frame y URL del renderer.

Cada solicitud debe pasar la validación en tiempo de ejecución antes de crear cualquier proceso.

### Frontera C: proceso principal a compilador

El código fuente TypeScript debe tratarse como datos.

La compilación no debe realizarse en el proceso principal ni en el renderer.

La etapa del compilador debe ser desechable y tener recursos limitados. No debe cargar:

- Archivos de configuración del proyecto.
- Plugins de TypeScript.
- Módulos arbitrarios.
- Exportaciones de paquetes.
- Archivos del proyecto con declaraciones ambientales.
- Extensiones del compilador controladas por el usuario.

El modo inicial del lenguaje debe operar sobre un único archivo fuente en memoria y no debe realizar resolución de módulos.

### Frontera D: compilador a runtime

Solo la salida del compilador y los metadatos explícitos de ejecución pueden cruzar esta frontera.

Nunca deben transferirse objetos del compilador, funciones, prototipos ni referencias al host.

### Frontera E: runtime a supervisor

La respuesta del runtime no es confiable.

Debe validarse lo siguiente:

- Tipo de mensaje.
- Identificador de la solicitud.
- Cantidad de resultados.
- Identificadores de prueba únicos.
- Estados permitidos.
- Duraciones finitas.
- Profundidad de valores.
- Tipo de valores.
- Longitud de mensajes.
- Arreglos dispersos.
- Prototipos no compatibles.

### Frontera F: supervisor a renderer

Solo un `RunSolutionResponse` validado puede llegar al renderer.

Los errores sin procesar de los procesos, reportes de diagnóstico y stack traces sin límites no deben exponerse.

## 8. Amenazas y controles obligatorios

| Amenaza                                         | Ejemplo                                          | Controles obligatorios                                                                                          |
| ----------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Acceso arbitrario al host                       | `process.env`, `require('node:fs')`              | El código del usuario se ejecuta en un entorno sin capacidades de Node ni Electron                              |
| Acceso al sistema de archivos                   | Leer claves SSH o borradores                     | No disponer de capacidades de filesystem; denegarlas mediante el runtime y la frontera del sistema operativo    |
| Acceso a la red                                 | Exfiltrar código fuente o credenciales           | No disponer de APIs de red; denegar sockets y red del navegador                                                 |
| Creación de procesos                            | Iniciar un shell                                 | No disponer de APIs de procesos; no invocar el shell; denegar la capacidad de crear procesos hijos              |
| Carga dinámica de código                        | `eval`, `Function`, import dinámico              | Eliminar o rechazar las capacidades de código dinámico y carga de módulos                                       |
| Agotamiento de CPU                              | Bucle infinito                                   | Límite de tiempo transcurrido aplicado externamente por el supervisor                                           |
| Agotamiento de memoria                          | Arreglos o strings sin límite                    | Límite de memoria por ejecución y terminación del proceso                                                       |
| Agotamiento mediante la salida                  | Valores de retorno o errores enormes             | Límites de serialización, profundidad, cantidad de elementos y bytes                                            |
| Inundación de procesos                          | Múltiples envíos paralelos                       | Límite de concurrencia y un runtime supervisado por cada ejecución aceptada                                     |
| Manipulación de prototipos                      | Sustituir métodos integrados                     | Runtime nuevo por ejecución y ningún realm mutable compartido                                                   |
| Persistencia del runtime                        | Timers pendientes después del retorno            | Terminar el runtime después de la respuesta; no reutilizar el realm del usuario                                 |
| Respuesta falsificada                           | IDs o estados de prueba falsos                   | Validación en tiempo de ejecución y correlación mediante el ID de la solicitud                                  |
| Mensajes obsoletos                              | Un proceso anterior responde tarde               | Mecanismo de finalización única; ignorar todos los eventos posteriores a la finalización                        |
| Abuso del compilador                            | Entrada TypeScript patológica                    | Timeout del compilador, límite de tamaño del código y proceso desechable                                        |
| Escape del sandbox                              | Vulnerabilidad del runtime                       | Defensa en profundidad, actualización de dependencias y frontera de proceso respaldada por el sistema operativo |
| Fuga de información                             | Rutas del host dentro de stack traces            | Sanitizar diagnósticos, errores y nombres de archivo antes de devolverlos                                       |
| Compromiso de la interfaz                       | Ejecutar código fuente en el renderer del editor | Nunca evaluar código del usuario en el renderer de la interfaz de Afila ni en el preload                        |
| Compromiso del proceso principal                | Compilar o ejecutar en el proceso principal      | El proceso principal solo coordina: no usa plugins de análisis sintáctico ni realiza compilación o evaluación. |
| Fuga entre ejecuciones                          | Variables globales o cachés compartidas          | Runtime aislado nuevo y entradas clonadas explícitamente para cada ejecución                                    |

## 9. Límites obligatorios de recursos

Antes de habilitar la ejecución real, la implementación debe aplicar:

- Longitud máxima del código fuente.
- Cantidad máxima de casos de prueba.
- Profundidad máxima de argumentos y resultados.
- Tamaño máximo de la solicitud serializada.
- Tamaño máximo de la respuesta serializada.
- Tamaño máximo del mensaje de error.
- Duración máxima de compilación medida como tiempo transcurrido.
- Duración máxima de ejecución medida como tiempo transcurrido.
- Memoria máxima del runtime.
- Cantidad máxima de ejecuciones concurrentes.
- Cantidad máxima de ejecuciones en cola.
- Cantidad máxima de resultados.
- Cantidad máxima de tareas asíncronas, preferiblemente cero en el modo síncrono inicial del lenguaje.

Un timeout implementado dentro del mismo realm de JavaScript que el código no confiable es insuficiente. El supervisor debe poder terminar externamente todo el runtime.

## 10. Restricciones iniciales del lenguaje

La primera versión con ejecución real debe soportar deliberadamente un subconjunto pequeño y síncrono:

- Un único archivo fuente TypeScript en memoria.
- Un único punto de entrada nombrado y obligatorio.
- Sin imports.
- El usuario no necesita escribir exports.
- Sin resolución de paquetes.
- Sin resolución de módulos respaldada por el sistema de archivos.
- Sin import dinámico.
- Sin `require`.
- Sin `eval`.
- Sin el constructor `Function`.
- Sin compilación de WebAssembly.
- Sin workers.
- Sin procesos hijos.
- Sin APIs de red.
- Sin timers.
- Sin ejecución asíncrona en el nivel superior.
- Sin una Promise pendiente como resultado.

Las capacidades adicionales del lenguaje deben introducirse explícitamente y someterse a un nuevo análisis de amenazas antes de habilitarlas.

## 11. Fronteras de seguridad rechazadas

Los siguientes mecanismos no son suficientes como sandbox principal:

### 11.1 Utility process de Electron por sí solo

Un utility process de Electron tiene integración con Node.js. La separación de procesos, los timeouts y los límites de heap mejoran la resiliencia, pero no eliminan del JavaScript malicioso las capacidades del host.

El utility process puede conservarse como supervisor de ejecución, pero el código del usuario no debe evaluarse directamente dentro de su realm de Node.js.

### 11.2 `node:vm`

Un contexto separado de V8 no constituye una frontera de seguridad para código no confiable.

`node:vm` no debe usarse como sandbox de Afila.

### 11.3 Node.js Permission Model por sí solo

El Permission Model puede evaluarse como defensa en profundidad para el código confiable del compilador o supervisor.

No debe tratarse como protección contra código malicioso del usuario.

### 11.4 Worker thread por sí solo

Un worker comparte la frontera de seguridad del proceso host. Los límites de recursos y la terminación del hilo no impiden el acceso a capacidades de Node.js ni protegen al proceso padre contra un escape del runtime.

### 11.5 Intérprete JavaScript dentro del mismo proceso

Un intérprete integrado sin una frontera de proceso del sistema operativo convertiría una vulnerabilidad de ese intérprete en una vulnerabilidad del proceso de Afila.

Un motor integrado solo puede considerarse dentro de un proceso desechable, restringido y supervisado externamente.

## 12. Clases de arquitectura candidatas

Las siguientes clases requieren una decisión de arquitectura y un prototipo separados:

### Candidato A: renderer de Chromium con sandbox

Un renderer dedicado podría proporcionar:

- Sandboxing de procesos de Chromium.
- Ausencia de integración con Node.js.
- Un proceso separado de la interfaz de Afila.
- Terminación externa mediante `webContents`.

También sería necesario demostrar que:

- Toda la red está bloqueada.
- La navegación y creación de popups están bloqueadas.
- Ningún preload expone APIs privilegiadas.
- El almacenamiento del navegador no está disponible o es efímero.
- Los permisos se deniegan.
- El código del usuario no puede alcanzar el origen de la interfaz de Afila.
- Los timeouts y fallos de memoria terminan el renderer de forma confiable.

### Candidato B: helper ejecutable con runtime restringido

Un helper ejecutable separado podría incluir un motor JavaScript sin APIs de Node.js.

Requeriría:

- Empaquetado multiplataforma.
- Sandboxing del sistema operativo.
- Protocolo estricto mediante stdin/stdout o mensajes.
- Terminación de todo el árbol de procesos.
- Revisión de la cadena de suministro del runtime y compilador.
- Aplicación de límites de memoria y CPU en cada plataforma compatible.

### Candidato C: motor integrado dentro de un helper restringido

Un motor JavaScript pequeño podría ejecutarse dentro de un helper desechable.

El helper debe seguir considerándose hostil después de recibir código del usuario y debe estar restringido mediante controles de procesos del sistema operativo.

## 13. Pruebas de aceptación

La ejecución real debe permanecer deshabilitada hasta que pruebas automatizadas o reproducibles demuestren que el código fuente no puede:

- Leer un archivo arbitrario.
- Escribir un archivo.
- Listar directorios.
- Leer variables de entorno.
- Acceder a variables globales de Node.js.
- Importar módulos integrados o instalados.
- Iniciar un proceso.
- Iniciar un worker.
- Abrir una conexión de red.
- Alcanzar servicios de localhost.
- Abrir una ventana o navegar.
- Acceder a almacenamiento persistente del navegador.
- Acceder al estado de otra ejecución.
- Devolver prototipos no compatibles.
- Devolver arreglos dispersos.
- Devolver números no finitos.
- Devolver un resultado demasiado grande.
- Producir un error demasiado grande.
- Continuar ejecutándose después del timeout.
- Dejar vivo un proceso hijo.
- Congelar el renderer de Afila.
- Provocar un crash del proceso principal de Electron.

La suite de pruebas también debe comprobar que:

- Las soluciones síncronas válidas se ejecutan correctamente.
- Los errores del compilador están sanitizados y limitados.
- Los errores del runtime están sanitizados y limitados.
- Los identificadores de solicitudes no pueden falsificarse.
- Los mensajes tardíos se ignoran.
- Cada proceso de ejecución termina o es finalizado.
- Los builds de desarrollo y empaquetados se comportan de la misma manera.

## 14. Requisitos de fallo seguro

Cualquier condición ambigua debe producir `execution-failed`.

Algunos ejemplos son:

- Timeout del compilador.
- Timeout del runtime.
- Salida no válida del compilador.
- Respuesta no válida del runtime.
- Salida inesperada de un proceso.
- Falla al entregar un mensaje.
- `requestId` que no coincide.
- Estado de resultado desconocido.
- Valor no compatible.
- Falla al terminar un proceso.
- Capacidad de sandbox ausente.
- Falla específica de una plataforma al inicializar el sandbox.

Afila nunca debe recurrir silenciosamente a ejecutar código fuente dentro del proceso principal, renderer, preload o un proceso Node.js sin restricciones.

## 15. Invariantes de seguridad

Las siguientes invariantes siempre deben mantenerse:

1. El código del usuario nunca se ejecuta en el proceso principal de Electron.
2. El código del usuario nunca se ejecuta en el renderer de Afila.
3. El código del usuario nunca se ejecuta en el contexto del preload.
4. El código del usuario nunca se ejecuta directamente en el realm de un utility process con Node.js habilitado.
5. La compilación nunca carga módulos ni plugins elegidos por el usuario.
6. Cada ejecución usa un runtime aislado nuevo.
7. Cada mensaje que cruza una frontera de proceso se valida.
8. Cada ejecución tiene límites de tiempo y memoria aplicados externamente.
9. Cada proceso de ejecución se recolecta o termina.
10. Ninguna respuesta de ejecución se considera confiable antes de validarla.
11. Ninguna falla del sandbox provoca un fallback menos restringido.
12. La ejecución real permanece deshabilitada hasta que se aprueben todos los criterios de aceptación.

## 16. Fuera de alcance

Este modelo de amenazas no afirma proteger contra:

- Un sistema operativo comprometido.
- Un administrador malicioso con control sobre la computadora.
- Un binario firmado de Afila que ya haya sido comprometido.
- Una vulnerabilidad de Electron, Chromium, el runtime seleccionado o el sistema operativo que derrote todas las capas de aislamiento configuradas.
- Canales laterales microarquitectónicos.
- Denegación de servicio provocada por el usuario al iniciar repetidamente Afila fuera de los propios controles de concurrencia de la aplicación.

La seguridad de la cadena de suministro, fijación de dependencias, firma de código y actualizaciones de la aplicación siguen siendo necesarias, pero se controlan por separado.

## 17. Criterios de decisión

Antes de implementar la ejecución real:

1. Comparar las clases de arquitectura candidatas.
2. Seleccionar la frontera del runtime y del compilador.
3. Documentar la decisión en un registro de decisión de arquitectura.
4. Crear un prototipo adversarial mínimo.
5. Ejecutar todas las pruebas de aceptación en desarrollo y builds empaquetados.
6. Revisar el ciclo de vida y comportamiento de terminación de procesos.
7. Revisar las diferencias entre plataformas.
8. Aprobar el diseño del sandbox antes de conectarlo al renderer.

Hasta completar estos criterios, el simulador determinista permanece como la única implementación de ejecución.

## 18. Referencias

- Seguridad de Electron:  
  https://www.electronjs.org/docs/latest/tutorial/security
- Sandboxing de procesos de Electron:  
  https://www.electronjs.org/docs/latest/tutorial/sandbox/
- Aislamiento de contexto de Electron:  
  https://www.electronjs.org/docs/latest/tutorial/context-isolation
- Utility Process de Electron:  
  https://www.electronjs.org/docs/latest/api/utility-process
- VM de Node.js:  
  https://nodejs.org/api/vm.html
- Permisos de Node.js:  
  https://nodejs.org/api/permissions.html
