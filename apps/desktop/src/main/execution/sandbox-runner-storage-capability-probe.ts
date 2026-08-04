import { Buffer } from 'node:buffer'
import type { WebContents } from 'electron'
import { SANDBOX_RUNNER_ISOLATED_WORLD_ID } from './sandbox-runner-isolated-world-probe'

export const SANDBOX_RUNNER_STORAGE_CAPABILITY_PROBE_SOURCE_URL =
  'afila-sandbox://runner/storage-capability-probe.js' as const

export const SANDBOX_RUNNER_STORAGE_CAPABILITY_PROBE_TIMEOUT_MS = 5_000 as const

export const SANDBOX_RUNNER_STORAGE_CAPABILITY_PROBE_MARKER =
  'afila-sandbox-storage-capability-probe-v1' as const

const MAX_STORAGE_PROBE_RESULT_BYTES = 2_048

const BOOLEAN_REPORT_KEYS = [
  'localStorageWritable',
  'sessionStorageWritable',
  'indexedDBWritable',
  'cacheStorageWritable',
  'documentCookieWritable',
  'originPrivateFileSystemWritable'
] as const

const REPORT_KEYS = ['marker', ...BOOLEAN_REPORT_KEYS] as const

export interface SandboxRunnerStorageCapabilityProbeReport {
  readonly marker: typeof SANDBOX_RUNNER_STORAGE_CAPABILITY_PROBE_MARKER
  readonly localStorageWritable: boolean
  readonly sessionStorageWritable: boolean
  readonly indexedDBWritable: boolean
  readonly cacheStorageWritable: boolean
  readonly documentCookieWritable: boolean
  readonly originPrivateFileSystemWritable: boolean
}

const STORAGE_PROBE_KEY = '__afila_sandbox_storage_probe__'

const STORAGE_PROBE_VALUE = 'afila-storage-probe-v1'

const INDEXED_DB_NAME = 'afila-sandbox-storage-probe'

const CACHE_NAME = 'afila-sandbox-storage-probe'

const OPFS_FILE_NAME = 'afila-sandbox-storage-probe.txt'

export const SANDBOX_RUNNER_STORAGE_CAPABILITY_PROBE_SOURCE = `(
  async () => {
    'use strict'

    const storageKey =
      ${JSON.stringify(STORAGE_PROBE_KEY)}

    const storageValue =
      ${JSON.stringify(STORAGE_PROBE_VALUE)}

    const probeWebStorage = (propertyName) => {
      let storage = null

      try {
        storage = globalThis[propertyName]
      } catch {
        return false
      }

      if (
        storage === null ||
        typeof storage !== 'object' ||
        typeof storage.setItem !== 'function' ||
        typeof storage.getItem !== 'function' ||
        typeof storage.removeItem !== 'function'
      ) {
        return false
      }

      try {
        storage.setItem(
          storageKey,
          storageValue
        )

        return (
          storage.getItem(storageKey) ===
          storageValue
        )
      } catch {
        return false
      } finally {
        try {
          storage.removeItem(storageKey)
        } catch {
          // Best-effort cleanup.
        }
      }
    }

    const probeIndexedDB = () =>
      new Promise((resolve) => {
        let factory = null

        try {
          factory = globalThis.indexedDB
        } catch {
          resolve(false)
          return
        }

        if (
          factory === null ||
          typeof factory !== 'object' ||
          typeof factory.open !== 'function'
        ) {
          resolve(false)
          return
        }

        let request

        try {
          request = factory.open(
            ${JSON.stringify(INDEXED_DB_NAME)},
            1
          )
        } catch {
          resolve(false)
          return
        }

        request.onupgradeneeded = () => {
          try {
            const database = request.result

            if (
              !database.objectStoreNames.contains(
                'probe'
              )
            ) {
              database.createObjectStore(
                'probe'
              )
            }
          } catch {
            // The final request outcome remains
            // authoritative.
          }
        }

        request.onerror = () => {
          resolve(false)
        }

        request.onblocked = () => {
          // Do not claim safe completion. The
          // external timeout will destroy the
          // entire runner if this remains blocked.
        }

        request.onsuccess = () => {
          try {
            request.result.close()
          } catch {
            // Best-effort cleanup.
          }

          try {
            const deletion =
              factory.deleteDatabase(
                ${JSON.stringify(INDEXED_DB_NAME)}
              )

            deletion.onerror = () => {}
            deletion.onblocked = () => {}
          } catch {
            // Best-effort cleanup.
          }

          resolve(true)
        }
      })

    const probeCacheStorage = async () => {
      let cacheStorage = null

      try {
        cacheStorage = globalThis.caches
      } catch {
        return false
      }

      if (
        cacheStorage === null ||
        typeof cacheStorage !== 'object' ||
        typeof cacheStorage.open !== 'function'
      ) {
        return false
      }

      try {
        await cacheStorage.open(
          ${JSON.stringify(CACHE_NAME)}
        )

        try {
          await cacheStorage.delete(
            ${JSON.stringify(CACHE_NAME)}
          )
        } catch {
          // Best-effort cleanup.
        }

        return true
      } catch {
        return false
      }
    }

    const probeDocumentCookie = () => {
      const cookie =
        storageKey + '=' +
        encodeURIComponent(storageValue) +
        '; Path=/; SameSite=Strict'

      const expiration =
        storageKey +
        '=; Path=/; Max-Age=0; SameSite=Strict'

      try {
        document.cookie = cookie

        const writable =
          document.cookie
            .split(';')
            .map((entry) => entry.trim())
            .some(
              (entry) =>
                entry.startsWith(
                  storageKey + '='
                )
            )

        try {
          document.cookie = expiration
        } catch {
          // Best-effort cleanup.
        }

        return writable
      } catch {
        return false
      }
    }

    const probeOriginPrivateFileSystem =
      async () => {
        const storage =
          navigator.storage

        if (
          storage === undefined ||
          typeof storage.getDirectory !==
            'function'
        ) {
          return false
        }

        try {
          const root =
            await storage.getDirectory()

          await root.getFileHandle(
            ${JSON.stringify(OPFS_FILE_NAME)},
            {
              create: true
            }
          )

          try {
            await root.removeEntry(
              ${JSON.stringify(OPFS_FILE_NAME)}
            )
          } catch {
            // Best-effort cleanup.
          }

          return true
        } catch {
          return false
        }
      }

    const [
      indexedDBWritable,
      cacheStorageWritable,
      originPrivateFileSystemWritable
    ] = await Promise.all([
      probeIndexedDB(),
      probeCacheStorage(),
      probeOriginPrivateFileSystem()
    ])

    return JSON.stringify({
      marker:
        ${JSON.stringify(SANDBOX_RUNNER_STORAGE_CAPABILITY_PROBE_MARKER)},
      localStorageWritable:
        probeWebStorage('localStorage'),
      sessionStorageWritable:
        probeWebStorage('sessionStorage'),
      indexedDBWritable,
      cacheStorageWritable,
      documentCookieWritable:
        probeDocumentCookie(),
      originPrivateFileSystemWritable
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

function parseStorageCapabilityReport(
  result: unknown
): SandboxRunnerStorageCapabilityProbeReport | null {
  if (typeof result !== 'string') {
    return null
  }

  if (Buffer.byteLength(result, 'utf8') > MAX_STORAGE_PROBE_RESULT_BYTES) {
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

  if (parsed.marker !== SANDBOX_RUNNER_STORAGE_CAPABILITY_PROBE_MARKER) {
    return null
  }

  for (const key of BOOLEAN_REPORT_KEYS) {
    if (typeof parsed[key] !== 'boolean') {
      return null
    }
  }

  return Object.freeze(parsed as unknown as SandboxRunnerStorageCapabilityProbeReport)
}

export function getSandboxRunnerStorageCapabilityProbeViolation(result: unknown): string | null {
  const report = parseStorageCapabilityReport(result)

  if (report === null) {
    return 'The sandbox runner storage-capability probe returned a malformed result.'
  }

  for (const key of BOOLEAN_REPORT_KEYS) {
    if (report[key]) {
      return `The sandbox runner allowed prohibited storage through ${key}.`
    }
  }

  return null
}

export async function runSandboxRunnerStorageCapabilityProbe(contents: WebContents): Promise<void> {
  if (contents.isDestroyed()) {
    throw new Error('The sandbox runner WebContents is destroyed.')
  }

  if (contents.isCrashed()) {
    throw new Error('The sandbox runner renderer process has crashed.')
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null

  const executionPromise: Promise<unknown> = contents.executeJavaScriptInIsolatedWorld(
    SANDBOX_RUNNER_ISOLATED_WORLD_ID,
    [
      {
        code: SANDBOX_RUNNER_STORAGE_CAPABILITY_PROBE_SOURCE,
        url: SANDBOX_RUNNER_STORAGE_CAPABILITY_PROBE_SOURCE_URL
      }
    ],
    false
  )

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error('The sandbox runner storage-capability probe timed out.'))
    }, SANDBOX_RUNNER_STORAGE_CAPABILITY_PROBE_TIMEOUT_MS)
  })

  try {
    const result: unknown = await Promise.race([executionPromise, timeoutPromise])

    const violation = getSandboxRunnerStorageCapabilityProbeViolation(result)

    if (violation !== null) {
      throw new Error(violation)
    }
  } finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle)
    }
  }
}
