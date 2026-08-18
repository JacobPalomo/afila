# Investigación de frontera de memoria en macOS

> **Languages:** [English](./README.md) | Español

## Propósito

Estos probes investigan si las APIs públicas de límites de recursos de macOS
pueden proporcionar una frontera dura de memoria para el renderer sandboxed de
Afila, denominado Candidato A en ADR-0001.

No ejecutan código escrito por usuarios y no forman parte de la aplicación
empaquetada.

## Entorno probado

Fecha de la prueba: 2026-08-05

```text
ProductName: macOS
ProductVersion: 26.5.2
BuildVersion: 25F84
Architecture: arm64
Apple clang version: 21.0.0
Target: arm64-apple-darwin25.5.0
```

## Probes

### `macos-rlimit-probe.c`

Este probe:

1. mide el espacio virtual y la memoria residente iniciales;
2. establece `RLIMIT_AS` en el espacio virtual actual más 64 MiB;
3. intenta asignar y tocar 16 MiB;
4. intenta asignar 96 MiB adicionales.

Resultado observado:

```json
{
  "available": true,
  "rssIsAs": true,
  "baselineVirtualBytes": 445745856512,
  "baselineResidentBytes": 1327104,
  "headroomBytes": 67108864,
  "requestedLimitBytes": 445812965376,
  "underLimitAllocationBytes": 16777216,
  "underLimitSucceeded": true,
  "overLimitAllocationBytes": 100663296,
  "overLimitSucceeded": false,
  "overLimitErrno": 12,
  "overLimitMessage": "Cannot allocate memory",
  "finalVirtualBytes": 445762633728,
  "finalResidentBytes": 18104320
}
```

El proceso terminó con código `0`.

Esto demuestra que `RLIMIT_AS` puede impedir nuevas asignaciones virtuales que
superen el límite instalado.

### `macos-rlimit-prereserved-probe.c`

Este probe:

1. reserva 192 MiB de espacio virtual antes de instalar `RLIMIT_AS`;
2. instala un límite con solo 64 MiB de margen adicional;
3. hace residentes 128 MiB dentro de la región previamente reservada;
4. intenta crear una nueva asignación de 96 MiB.

Resultado observado:

```json
{
  "baselineVirtualBytes": 445746380800,
  "baselineResidentBytes": 1343488,
  "existingReservationBytes": 201326592,
  "existingTouchBytes": 134217728,
  "virtualBytesAfterReservation": 445947707392,
  "residentBytesAfterReservation": 1343488,
  "limitHeadroomBytes": 67108864,
  "requestedLimitBytes": 446014816256,
  "virtualBytesAfterTouch": 445947707392,
  "residentBytesAfterTouch": 135561216,
  "residentGrowthBytes": 134217728,
  "newAllocationBytes": 100663296,
  "newAllocationSucceeded": false,
  "newAllocationErrno": 12,
  "newAllocationMessage": "Cannot allocate memory"
}
```

El proceso terminó con código `0`.

## Conclusión de seguridad

`RLIMIT_AS` limita el crecimiento del espacio de direcciones virtuales mediante
nuevas asignaciones, pero no limita el crecimiento de memoria residente dentro
de regiones virtuales existentes antes de instalar el límite.

En el segundo probe, el margen permitido era de 64 MiB, pero la memoria
residente creció 128 MiB dentro de una región previamente reservada.

Por tanto, `RLIMIT_AS` por sí solo no satisface la puerta de aceptación de Afila
para una frontera dura de memoria del renderer.

El Candidato A no queda aprobado para ejecución de producción en macOS. El
renderer existente puede conservarse como prototipo de aislamiento,
denegación de capacidades, timeout y terminación, pero el código escrito por
usuarios permanece desconectado.

El Candidato C, un motor JavaScript mínimo integrado en un helper nativo
restringido, debe evaluarse como sucesor para la ejecución real. Esta conclusión
no selecciona todavía el shell de escritorio de Afila.

## Limitaciones de la investigación

Los probes:

- prueban procesos nativos sencillos, no un renderer completo de Chromium;
- no demuestran que todas las fronteras posibles de macOS sean inviables;
- sí demuestran que `RLIMIT_AS` no controla la memoria residente dentro de
  mappings preexistentes;
- no evalúan Windows ni Linux;
- no aprueban todavía el Candidato C;
- no ejecutan código del usuario.

## Reproducción

Compilar:

```bash
xcrun clang \
  -std=c17 \
  -O2 \
  -Wall \
  -Wextra \
  -Wpedantic \
  -Werror \
  tools/memory-boundary/macos-rlimit-probe.c \
  -o /tmp/afila-macos-rlimit-probe

xcrun clang \
  -std=c17 \
  -O2 \
  -Wall \
  -Wextra \
  -Wpedantic \
  -Werror \
  tools/memory-boundary/macos-rlimit-prereserved-probe.c \
  -o /tmp/afila-macos-rlimit-prereserved-probe
```

Ejecutar:

```bash
/tmp/afila-macos-rlimit-probe
echo "exit: $?"

/tmp/afila-macos-rlimit-prereserved-probe
echo "exit: $?"
```

Los binarios compilados se escriben en `/tmp` y no deben agregarse al
repositorio.
