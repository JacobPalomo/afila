# ADR-0002: Eficiencia de recursos, privacidad e integridad como puertas de release

**Estado:** Aceptado<br>
**Fecha:** 2026-08-05<br>
**Tipo de decisión:** Arquitectura de producto y plataforma<br>
**Alcance:** Shell de escritorio, runtime de ejecución local, empaquetado, actualizaciones y validación de releases

> **Idiomas:** [English](./0002-resource-privacy-integrity-requirements.md) | Español<br>
> **Política de sincronización:** Las versiones en inglés y español deben
> actualizarse en el mismo cambio. Cualquier diferencia semántica bloquea el
> cambio hasta que se aclare.

## 1. Contexto

Afila debe ser sana y respetuosa con el dispositivo y los datos del usuario. El
bajo consumo de RAM, el tamaño instalado reducido, la mínima actividad en
segundo plano, la privacidad local y la integridad verificable de la aplicación
son requisitos de producto, no optimizaciones opcionales.

ADR-0001 demostró propiedades de seguridad útiles para un renderer desechable
de Electron, pero el Candidato A no demostró una frontera dura de memoria en
macOS. Electron también incorpora el costo de recursos de su runtime de
escritorio, independientemente de la decisión sobre el sandbox de ejecución.

El runtime de ejecución y el shell de escritorio son decisiones separadas:

- El Candidato C corresponde a la ejecución de código no confiable del usuario.
- Electron, un shell con WebView del sistema o una interfaz nativa corresponden
  al shell de la aplicación.

Ninguna decisión puede tomarse únicamente por conveniencia de implementación.

## 2. Decisión

Afila adopta la eficiencia de recursos, la privacidad y la integridad como
puertas obligatorias de release.

La arquitectura seleccionada debe ser la opción más pequeña y de menor consumo
que satisfaga toda la funcionalidad y todos los requisitos de seguridad,
privacidad e integridad. Reducir recursos nunca justifica debilitar una frontera
de seguridad, ocultar una falla de integridad ni transmitir datos del usuario.

Este ADR no selecciona un shell de reemplazo. Electron y los shells candidatos
deben medirse primero mediante el mismo procedimiento reproducible.

El Candidato C debe evaluarse de forma independiente como sucesor para ejecutar
código no confiable. Su selección no selecciona automáticamente un shell de
escritorio.

## 3. Requisitos de recursos

Afila debe:

- no mantener ningún helper de ejecución activo cuando no hay una ejecución;
- iniciar con una sola ejecución concurrente;
- evitar procesos, timers y polling innecesarios en segundo plano;
- no realizar en reposo trabajo que pueda ser dirigido por eventos;
- empaquetar solo los archivos necesarios para la arquitectura objetivo;
- evitar motores, assets y dependencias de desarrollo duplicados en releases;
- imponer límites explícitos de bytes a cada mensaje entre procesos;
- terminar y liberar de forma determinista los recursos desechables;
- medir tamaño y memoria antes de cada release para cada plataforma;
- tratar como bloqueantes las regresiones de recursos sin explicación.

Las optimizaciones deben considerar la aplicación completa, no solo el bundle
de la interfaz.

## 4. Requisitos de privacidad

Afila es local-first y funciona offline por defecto.

Salvo que una función futura tenga su propia decisión revisada y una acción
explícita del usuario, Afila debe tener:

- cero telemetría y analytics;
- cero identificadores publicitarios;
- ningún envío automático de reportes de crash;
- ningún contenido remoto renderizado dentro de la aplicación;
- ninguna actividad de red mientras está en reposo;
- ninguna subida de código fuente, pruebas, resultados, progreso o metadatos
  locales;
- ninguna sincronización de cuentas en segundo plano;
- ningún endpoint oculto o de rastreo de terceros incluido en la aplicación.

Una función con red debe identificar antes de implementarse su destino,
propósito, campos transmitidos, retención y control visible para el usuario. La
denegación o ausencia de red no debe volver insegura la ejecución local.

## 5. Requisitos de integridad

Los artefactos de producción deben:

- estar firmados con la identidad apropiada de cada plataforma;
- estar notarizados donde la plataforma lo requiera o permita;
- verificar los metadatos y artefactos de actualización antes de instalarlos;
- rechazar helpers sin firma, con firma inválida o modificados inesperadamente;
- fijar dependencias y toolchains sensibles para la seguridad;
- verificar origen, versión y digest de componentes nativos integrados;
- excluir diagnósticos de desarrollo y probes de los builds empaquetados;
- fallar de forma segura cuando no puedan verificarse versiones de protocolo,
  firmas, hashes o limpieza de recursos.

El helper de ejecución debe tratarse como componente sensible para la seguridad,
con políticas propias de build, pruebas, firma y actualización.

## 6. Mediciones obligatorias

Cada comparación de shells y cada baseline de release debe registrar por sistema
operativo y arquitectura de CPU:

1. tamaño sin comprimir de la aplicación;
2. tamaño del instalador o archivo;
3. tamaño instalado después del primer inicio;
4. cantidad e identidad de procesos en reposo;
5. memoria privada o residente después de un periodo definido de estabilización;
6. pico de memoria durante un arranque en frío;
7. memoria con la interfaz principal cargada;
8. memoria durante y después de una ejecución acotada;
9. uso de CPU en reposo;
10. tiempo de arranque en frío y en caliente;
11. conexiones y bytes de red transferidos en reposo;
12. archivos, cachés y datos persistentes creados en el primer inicio;
13. tamaño del binario helper y su pico de memoria;
14. estado de limpieza después de cerrar la aplicación.

Las comparaciones deben usar builds de release en la misma máquina y versión del
sistema operativo. El procedimiento debe documentar herramientas, duración y
condiciones ambientales. Deben recopilarse al menos cinco ejecuciones y
conservarse la mediana y el peor resultado observado.

## 7. Puerta de decisión del shell

Antes de reemplazar Electron, Afila debe construir un spike mínimo pero
representativo para cada shell candidato serio.

Un candidato solo puede avanzar cuando:

- conserva el comportamiento requerido de la interfaz;
- no expone una API privilegiada mayor de la necesaria;
- no debilita el aislamiento de procesos ni la integridad de actualizaciones;
- no empeora ni el tamaño instalado ni la memoria estable y mejora materialmente
  al menos uno de ambos;
- no introduce actividad inexplicable de red o disco en reposo;
- dispone de una ruta viable de firma, empaquetado y actualización en todas las
  plataformas soportadas;
- tiene dependencias mantenibles, comprobables y auditables.

La comparación debe producir un ADR posterior que seleccione el shell y registre
presupuestos duros. Hasta entonces, afirmar que un shell es más ligero es una
hipótesis, no arquitectura aceptada.

## 8. Puerta de decisión del runtime de ejecución

El Candidato C debe demostrar mediante probes internos fijos, antes de conectar
código del usuario:

- un límite duro de asignación controlado por el motor;
- un techo total de memoria del helper demostrado que cubra asignaciones del
  motor, asignaciones nativas, stack, buffers de serialización y protocolo y
  el overhead fijo del runtime;
- ninguna ruta de asignación dinámica sin límites fuera del presupuesto de
  memoria contabilizado;
- tamaño máximo de stack;
- interrupción de bucles infinitos;
- terminación externa del proceso;
- entrada, salida y diagnósticos acotados;
- ausencia de acceso a archivos, red, procesos y entorno;
- ninguna biblioteca estándar u operating-system opcional enlazada al realm del
  usuario;
- limpieza determinista después de éxito, falla, timeout y agotamiento de
  memoria;
- tamaño aceptable del binario helper y pico de memoria;
- builds reproducibles y firmados para cada plataforma soportada.

El Candidato C no queda aprobado para producción hasta demostrar mediante
probes adversariales tanto el límite de asignación del motor como el techo
total de memoria del helper.

El código escrito por usuarios permanece desconectado hasta satisfacer estas
puertas y las puertas existentes de protocolo y validación de ADR-0001.

## 9. Política de presupuestos

El primer baseline reproducible de Electron y los spikes de shells candidatos
definirán los presupuestos numéricos iniciales.

Después de aceptar esos presupuestos:

- superar un presupuesto duro bloquea el release;
- aumentar un presupuesto exige un ADR revisado con justificación funcional o
  de seguridad;
- el trabajo normal de funciones no puede consumir silenciosamente el margen;
- CI y la validación de releases deben conservar mediciones históricas.

El objetivo no es únicamente superar a Electron. El objetivo es la mínima huella
práctica compatible con todos los requisitos de seguridad, privacidad,
integridad y funcionalidad de Afila.

## 10. Consecuencias

### Positivas

- La salud del dispositivo se vuelve una propiedad exigible del producto.
- Los defaults de privacidad quedan explícitos y comprobables.
- Las decisiones de shell y runtime se basan en mediciones.
- La seguridad no puede intercambiarse por binarios más pequeños.
- Las regresiones de recursos son visibles antes del release.

### Negativas

- La validación de releases se vuelve más exigente.
- Los helpers nativos y varias plataformas requieren mediciones dedicadas.
- Firma, notarización y empaquetado reproducible agregan trabajo operativo.
- La arquitectura aceptable más ligera puede exigir migrar fuera de Electron.
- Los presupuestos numéricos no pueden finalizarse hasta disponer de baselines
  representativos.

## 11. Siguientes pasos

1. Completar en PR #42 la evidencia de frontera de memoria de macOS.
2. Registrar el baseline del release actual de Electron.
3. Construir y medir spikes representativos sin eliminar Electron.
4. Construir y medir el helper del Candidato C con probes fijos.
5. Seleccionar el shell de escritorio mediante un ADR posterior.
6. Seleccionar o rechazar el Candidato C en un ADR separado del runtime.
7. Establecer presupuestos duros de release a partir de las mediciones aceptadas.
