import { Buffer } from 'node:buffer'
import type { WebContents } from 'electron'
import { SANDBOX_RUNNER_ISOLATED_WORLD_ID } from './sandbox-runner-isolated-world-probe'

export const SANDBOX_RUNNER_BROWSER_CAPABILITY_PROBE_SOURCE_URL =
  'afila-sandbox://runner/browser-capability-probe.js' as const

export const SANDBOX_RUNNER_BROWSER_CAPABILITY_PROBE_TIMEOUT_MS = 5_000 as const

export const SANDBOX_RUNNER_BROWSER_CAPABILITY_PROBE_MARKER =
  'afila-sandbox-browser-capability-probe-v1' as const

const CAPABILITY_OPERATION_TIMEOUT_MS = 1_500

const EXTERNAL_PROBE_URL = 'https://example.invalid/afila-sandbox-probe'

const LOOPBACK_HTTP_PROBE_URL = 'http://127.0.0.1:9/afila-sandbox-probe'

const LOOPBACK_WEBSOCKET_PROBE_URL = 'ws://127.0.0.1:9/afila-sandbox-probe'

const LOOPBACK_WEBTRANSPORT_PROBE_URL = 'https://127.0.0.1:9/afila-sandbox-probe'

const SAME_ORIGIN_XHR_PROBE_URL = 'afila-sandbox://runner/forbidden-xhr'

const SERVICE_WORKER_PROBE_URL = 'afila-sandbox://runner/service-worker-probe.js'

export interface SandboxRunnerBrowserCapabilityProbeReport {
  readonly marker: typeof SANDBOX_RUNNER_BROWSER_CAPABILITY_PROBE_MARKER
  readonly fetchExternalConnected: boolean
  readonly fetchLoopbackConnected: boolean
  readonly xhrConnected: boolean
  readonly webSocketOpened: boolean
  readonly eventSourceOpened: boolean
  readonly workerAvailable: boolean
  readonly workerConstructed: boolean
  readonly workerStarted: boolean
  readonly sharedWorkerAvailable: boolean
  readonly sharedWorkerConstructed: boolean
  readonly sharedWorkerStarted: boolean
  readonly serviceWorkerAvailable: boolean
  readonly serviceWorkerRegistered: boolean
  readonly webTransportAvailable: boolean
  readonly webTransportReady: boolean
  readonly beaconAvailable: boolean
  readonly beaconQueued: boolean
}

const BOOLEAN_REPORT_KEYS = [
  'fetchExternalConnected',
  'fetchLoopbackConnected',
  'xhrConnected',
  'webSocketOpened',
  'eventSourceOpened',
  'workerAvailable',
  'workerConstructed',
  'workerStarted',
  'sharedWorkerAvailable',
  'sharedWorkerConstructed',
  'sharedWorkerStarted',
  'serviceWorkerAvailable',
  'serviceWorkerRegistered',
  'webTransportAvailable',
  'webTransportReady',
  'beaconAvailable',
  'beaconQueued'
] as const

const REPORT_KEYS = ['marker', ...BOOLEAN_REPORT_KEYS] as const

const MAX_CAPABILITY_PROBE_RESULT_BYTES = 4_096

export const SANDBOX_RUNNER_BROWSER_CAPABILITY_PROBE_SOURCE = `(
  async () => {
    'use strict'

    const operationTimeoutMs =
      ${CAPABILITY_OPERATION_TIMEOUT_MS}

    const probeFetch = async (url) => {
      if (
        typeof fetch !== 'function' ||
        typeof AbortController !== 'function'
      ) {
        return false
      }

      const controller = new AbortController()

      const timeoutHandle = setTimeout(
        () => controller.abort(),
        operationTimeoutMs
      )

      try {
        await fetch(url, {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'error',
          referrerPolicy: 'no-referrer',
          signal: controller.signal
        })

        return true
      } catch {
        return false
      } finally {
        clearTimeout(timeoutHandle)
      }
    }

    const probeXHR = () =>
      new Promise((resolve) => {
        if (
          typeof XMLHttpRequest !== 'function'
        ) {
          resolve(false)
          return
        }

        const xhr = new XMLHttpRequest()
        let settled = false

        const finish = (connected) => {
          if (settled) {
            return
          }

          settled = true
          clearTimeout(timeoutHandle)

          xhr.onload = null
          xhr.onerror = null
          xhr.onabort = null
          xhr.ontimeout = null

          resolve(connected)
        }

        const timeoutHandle = setTimeout(
          () => {
            finish(false)

            try {
              xhr.abort()
            } catch {
              // Best-effort probe cleanup.
            }
          },
          operationTimeoutMs
        )

        xhr.onload = () => finish(true)
        xhr.onerror = () => finish(false)
        xhr.onabort = () => finish(false)
        xhr.ontimeout = () => finish(false)
        xhr.timeout = operationTimeoutMs

        try {
          xhr.open(
            'GET',
            ${JSON.stringify(SAME_ORIGIN_XHR_PROBE_URL)},
            true
          )

          xhr.send()
        } catch {
          finish(false)
        }
      })

    const probeWebSocket = () =>
      new Promise((resolve) => {
        if (typeof WebSocket !== 'function') {
          resolve(false)
          return
        }

        let socket = null
        let settled = false

        const finish = (opened) => {
          if (settled) {
            return
          }

          settled = true
          clearTimeout(timeoutHandle)

          if (socket !== null) {
            socket.onopen = null
            socket.onerror = null
            socket.onclose = null

            try {
              socket.close()
            } catch {
              // Best-effort probe cleanup.
            }
          }

          resolve(opened)
        }

        const timeoutHandle = setTimeout(
          () => finish(false),
          operationTimeoutMs
        )

        try {
          socket = new WebSocket(
            ${JSON.stringify(LOOPBACK_WEBSOCKET_PROBE_URL)}
          )

          socket.onopen = () => finish(true)
          socket.onerror = () => finish(false)
          socket.onclose = () => finish(false)
        } catch {
          finish(false)
        }
      })

    const probeEventSource = () =>
      new Promise((resolve) => {
        if (
          typeof EventSource !== 'function'
        ) {
          resolve(false)
          return
        }

        let eventSource = null
        let settled = false

        const finish = (opened) => {
          if (settled) {
            return
          }

          settled = true
          clearTimeout(timeoutHandle)

          if (eventSource !== null) {
            eventSource.onopen = null
            eventSource.onerror = null
            eventSource.close()
          }

          resolve(opened)
        }

        const timeoutHandle = setTimeout(
          () => finish(false),
          operationTimeoutMs
        )

        try {
          eventSource = new EventSource(
            ${JSON.stringify(LOOPBACK_HTTP_PROBE_URL)}
          )

          eventSource.onopen =
            () => finish(true)

          eventSource.onerror =
            () => finish(false)
        } catch {
          finish(false)
        }
      })

    const probeWorker = () =>
      new Promise((resolve) => {
        const available =
          typeof Worker === 'function'

        if (!available) {
          resolve({
            available: false,
            constructed: false,
            started: false
          })
          return
        }

        let worker = null
        let objectURL = null
        let constructed = false
        let settled = false

        const finish = (started) => {
          if (settled) {
            return
          }

          settled = true
          clearTimeout(timeoutHandle)

          if (worker !== null) {
            worker.onmessage = null
            worker.onerror = null
            worker.terminate()
          }

          if (objectURL !== null) {
            URL.revokeObjectURL(objectURL)
          }

          resolve({
            available,
            constructed,
            started
          })
        }

        const timeoutHandle = setTimeout(
          () => finish(false),
          operationTimeoutMs
        )

        try {
          objectURL = URL.createObjectURL(
            new Blob(
              ['postMessage("started")'],
              {
                type: 'text/javascript'
              }
            )
          )

          worker = new Worker(objectURL)
          constructed = true

          worker.onmessage =
            () => finish(true)

          worker.onerror = () => {
            finish(false)
            return true
          }
        } catch {
          finish(false)
        }
      })

    const probeSharedWorker = () =>
      new Promise((resolve) => {
        const available =
          typeof SharedWorker === 'function'

        if (!available) {
          resolve({
            available: false,
            constructed: false,
            started: false
          })
          return
        }

        let sharedWorker = null
        let objectURL = null
        let constructed = false
        let settled = false

        const finish = (started) => {
          if (settled) {
            return
          }

          settled = true
          clearTimeout(timeoutHandle)

          if (sharedWorker !== null) {
            sharedWorker.port.onmessage = null
            sharedWorker.port.close()
          }

          if (objectURL !== null) {
            URL.revokeObjectURL(objectURL)
          }

          resolve({
            available,
            constructed,
            started
          })
        }

        const timeoutHandle = setTimeout(
          () => finish(false),
          operationTimeoutMs
        )

        try {
          objectURL = URL.createObjectURL(
            new Blob(
              [
                'onconnect = (event) => ' +
                'event.ports[0].postMessage("started")'
              ],
              {
                type: 'text/javascript'
              }
            )
          )

          sharedWorker =
            new SharedWorker(objectURL)

          constructed = true

          sharedWorker.port.onmessage =
            () => finish(true)

          sharedWorker.port.start()
        } catch {
          finish(false)
        }
      })

    const probeServiceWorker = async () => {
			const available =
				'serviceWorker' in navigator &&
				navigator.serviceWorker !== undefined

			if (!available) {
				return {
					available: false,
					registered: false
				}
			}

			try {
				const registration =
					await navigator.serviceWorker.register(
						${JSON.stringify(SERVICE_WORKER_PROBE_URL)}
					)

				try {
					await registration.unregister()
				} catch {
					// Best-effort cleanup. Registration
					// itself is still reported as a failure.
				}

				return {
					available,
					registered: true
				}
			} catch {
				return {
					available,
					registered: false
				}
			}
		}

    const probeWebTransport = async () => {
      const available =
        typeof WebTransport === 'function'

      if (!available) {
        return {
          available: false,
          ready: false
        }
      }

      let transport = null
      let timeoutHandle = null

      try {
        transport = new WebTransport(
          ${JSON.stringify(LOOPBACK_WEBTRANSPORT_PROBE_URL)}
        )

        void transport.closed.catch(() => {
          // Prevent an unhandled rejection.
        })

        const timeoutPromise =
          new Promise((resolve) => {
            timeoutHandle = setTimeout(
              () => resolve(false),
              operationTimeoutMs
            )
          })

        const ready =
          await Promise.race([
            transport.ready.then(
              () => true,
              () => false
            ),
            timeoutPromise
          ])

        return {
          available,
          ready
        }
      } catch {
        return {
          available,
          ready: false
        }
      } finally {
        if (timeoutHandle !== null) {
          clearTimeout(timeoutHandle)
        }

        if (transport !== null) {
          try {
            transport.close()
          } catch {
            // Best-effort probe cleanup.
          }
        }
      }
    }

    const probeBeacon = () => {
      const available =
        typeof navigator.sendBeacon ===
        'function'

      if (!available) {
        return {
          available: false,
          queued: false
        }
      }

      try {
        return {
          available,
          queued: navigator.sendBeacon(
            ${JSON.stringify(LOOPBACK_HTTP_PROBE_URL)},
            new Uint8Array([1])
          )
        }
      } catch {
        return {
          available,
          queued: false
        }
      }
    }

    const [
      fetchExternalConnected,
      fetchLoopbackConnected,
      xhrConnected,
      webSocketOpened,
      eventSourceOpened,
      worker,
      sharedWorker,
      serviceWorker,
      webTransport
    ] = await Promise.all([
      probeFetch(
        ${JSON.stringify(EXTERNAL_PROBE_URL)}
      ),
      probeFetch(
        ${JSON.stringify(LOOPBACK_HTTP_PROBE_URL)}
      ),
      probeXHR(),
      probeWebSocket(),
      probeEventSource(),
      probeWorker(),
      probeSharedWorker(),
      probeServiceWorker(),
      probeWebTransport()
    ])

    const beacon = probeBeacon()

    return JSON.stringify({
      marker:
        ${JSON.stringify(SANDBOX_RUNNER_BROWSER_CAPABILITY_PROBE_MARKER)},
      fetchExternalConnected,
      fetchLoopbackConnected,
      xhrConnected,
      webSocketOpened,
      eventSourceOpened,
      workerAvailable:
        worker.available,
      workerConstructed:
        worker.constructed,
      workerStarted:
        worker.started,
      sharedWorkerAvailable:
        sharedWorker.available,
      sharedWorkerConstructed:
        sharedWorker.constructed,
      sharedWorkerStarted:
        sharedWorker.started,
      serviceWorkerAvailable:
        serviceWorker.available,
      serviceWorkerRegistered:
        serviceWorker.registered,
      webTransportAvailable:
        webTransport.available,
      webTransportReady:
        webTransport.ready,
      beaconAvailable:
        beacon.available,
      beaconQueued:
        beacon.queued
    })
  }
)()`

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function parseProbeReport(result: unknown): SandboxRunnerBrowserCapabilityProbeReport | null {
  if (typeof result !== 'string') {
    return null
  }

  if (Buffer.byteLength(result, 'utf8') > MAX_CAPABILITY_PROBE_RESULT_BYTES) {
    return null
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(result)
  } catch {
    return null
  }

  if (!isPlainRecord(parsed)) {
    return null
  }

  const keys = Object.keys(parsed)

  if (
    keys.length !== REPORT_KEYS.length ||
    !REPORT_KEYS.every((key) => Object.hasOwn(parsed, key))
  ) {
    return null
  }

  if (parsed.marker !== SANDBOX_RUNNER_BROWSER_CAPABILITY_PROBE_MARKER) {
    return null
  }

  for (const key of BOOLEAN_REPORT_KEYS) {
    if (typeof parsed[key] !== 'boolean') {
      return null
    }
  }

  return Object.freeze(parsed as unknown as SandboxRunnerBrowserCapabilityProbeReport)
}

export function getSandboxRunnerBrowserCapabilityProbeViolation(result: unknown): string | null {
  const report = parseProbeReport(result)

  if (report === null) {
    return 'The sandbox runner browser-capability probe returned a malformed result.'
  }

  if (report.workerConstructed && !report.workerAvailable) {
    return 'The sandbox runner browser-capability probe returned an inconsistent Worker construction result.'
  }

  if (report.workerStarted && (!report.workerAvailable || !report.workerConstructed)) {
    return 'The sandbox runner browser-capability probe returned an inconsistent Worker execution result.'
  }

  if (report.sharedWorkerConstructed && !report.sharedWorkerAvailable) {
    return 'The sandbox runner browser-capability probe returned an inconsistent SharedWorker construction result.'
  }

  if (
    report.sharedWorkerStarted &&
    (!report.sharedWorkerAvailable || !report.sharedWorkerConstructed)
  ) {
    return 'The sandbox runner browser-capability probe returned an inconsistent SharedWorker execution result.'
  }

  if (report.serviceWorkerRegistered && !report.serviceWorkerAvailable) {
    return 'The sandbox runner browser-capability probe returned an inconsistent ServiceWorker result.'
  }

  if (report.webTransportReady && !report.webTransportAvailable) {
    return 'The sandbox runner browser-capability probe returned an inconsistent WebTransport result.'
  }

  if (report.beaconQueued && !report.beaconAvailable) {
    return 'The sandbox runner browser-capability probe returned an inconsistent beacon result.'
  }

  if (report.workerStarted || report.sharedWorkerStarted) {
    return 'The sandbox runner allowed execution of a prohibited worker.'
  }

  if (report.serviceWorkerRegistered) {
    return 'The sandbox runner allowed registration of a prohibited ServiceWorker.'
  }

  if (
    report.fetchExternalConnected ||
    report.fetchLoopbackConnected ||
    report.xhrConnected ||
    report.webSocketOpened ||
    report.eventSourceOpened ||
    report.webTransportReady
  ) {
    return 'The sandbox runner established a prohibited browser network connection.'
  }

  return null
}

export async function runSandboxRunnerBrowserCapabilityProbe(contents: WebContents): Promise<void> {
  if (contents.isDestroyed()) {
    throw new Error('The sandbox runner WebContents is destroyed.')
  }

  if (contents.isCrashed()) {
    throw new Error('The sandbox runner renderer process has crashed.')
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null

  const executionPromise: Promise<unknown> = Promise.resolve().then(() =>
    contents.executeJavaScriptInIsolatedWorld(
      SANDBOX_RUNNER_ISOLATED_WORLD_ID,
      [
        {
          code: SANDBOX_RUNNER_BROWSER_CAPABILITY_PROBE_SOURCE,
          url: SANDBOX_RUNNER_BROWSER_CAPABILITY_PROBE_SOURCE_URL
        }
      ],
      false
    )
  )

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error('The sandbox runner browser-capability probe timed out.'))
    }, SANDBOX_RUNNER_BROWSER_CAPABILITY_PROBE_TIMEOUT_MS)
  })

  try {
    const result: unknown = await Promise.race([executionPromise, timeoutPromise])

    const violation = getSandboxRunnerBrowserCapabilityProbeViolation(result)

    if (violation !== null) {
      throw new Error(violation)
    }
  } finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle)
    }
  }
}
