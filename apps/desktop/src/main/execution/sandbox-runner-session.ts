import { app, session, type Session } from 'electron'
import {
  createSandboxRunnerDocumentResponse,
  isAllowedSandboxRunnerDocumentRequest,
  SANDBOX_RUNNER_DOCUMENT_URL,
  SANDBOX_RUNNER_SCHEME
} from './sandbox-runner-document'
import {
  createSandboxRunnerRequestAudit,
  type SandboxRunnerRequestAuditSnapshot
} from './sandbox-runner-request-audit'
import { assertSandboxRunnerSessionStorageEmpty } from './sandbox-runner-session-storage'
import { createSandboxRunnerSessionLeaseController } from './sandbox-runner-session-lease'

export interface SandboxRunnerSessionHandle {
  readonly partition: string
  readonly session: Session
  readonly documentURL: typeof SANDBOX_RUNNER_DOCUMENT_URL
  getRequestAuditSnapshot(): SandboxRunnerRequestAuditSnapshot
  dispose(): Promise<void>
  invalidate(): Promise<void>
}

export const SANDBOX_RUNNER_PARTITION = 'afila-sandbox-runner' as const

const sandboxRunnerSessionLeaseController = createSandboxRunnerSessionLeaseController()

function captureCleanupError(errors: unknown[], action: () => void): void {
  try {
    action()
  } catch (error) {
    errors.push(error)
  }
}

async function captureAsyncCleanupError(
  errors: unknown[],
  action: () => Promise<void>
): Promise<void> {
  try {
    await action()
  } catch (error) {
    errors.push(error)
  }
}

export function createSandboxRunnerSession(): SandboxRunnerSessionHandle {
  if (!app.isReady()) {
    throw new Error('The sandbox runner session requires Electron to be ready.')
  }

  const sessionLease = sandboxRunnerSessionLeaseController.acquire()

  let runnerSession: Session

  try {
    runnerSession = session.fromPartition(SANDBOX_RUNNER_PARTITION, {
      cache: false
    })

    if (runnerSession.storagePath !== null) {
      throw new Error('The sandbox runner session must be non-persistent.')
    }
  } catch (error) {
    sessionLease.poison()
    throw error
  }

  const partition = SANDBOX_RUNNER_PARTITION

  const requestAudit = createSandboxRunnerRequestAudit()

  const preventDownload = (event: { preventDefault(): void }): void => {
    event.preventDefault()
  }

  const removeHandlers = (): unknown[] => {
    const errors: unknown[] = []

    captureCleanupError(errors, () => {
      runnerSession.webRequest.onBeforeRequest(null)
    })

    captureCleanupError(errors, () => {
      runnerSession.setPermissionRequestHandler(null)
    })

    captureCleanupError(errors, () => {
      runnerSession.setPermissionCheckHandler(null)
    })

    captureCleanupError(errors, () => {
      runnerSession.setDevicePermissionHandler(null)
    })

    captureCleanupError(errors, () => {
      runnerSession.removeListener('will-download', preventDownload)
    })

    captureCleanupError(errors, () => {
      if (runnerSession.protocol.isProtocolHandled(SANDBOX_RUNNER_SCHEME)) {
        runnerSession.protocol.unhandle(SANDBOX_RUNNER_SCHEME)
      }
    })

    return errors
  }

  try {
    runnerSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false)
    })

    runnerSession.setPermissionCheckHandler(() => false)
    runnerSession.setDevicePermissionHandler(() => false)

    runnerSession.on('will-download', preventDownload)

    runnerSession.webRequest.onBeforeRequest((details, callback) => {
      const request = {
        url: details.url,
        method: details.method,
        resourceType: details.resourceType
      }

      const allowed = isAllowedSandboxRunnerDocumentRequest(request)

      requestAudit.record(request, allowed)

      callback({
        cancel: !allowed
      })
    })

    if (runnerSession.protocol.isProtocolHandled(SANDBOX_RUNNER_SCHEME)) {
      throw new Error('The sandbox runner protocol is already handled.')
    }

    runnerSession.protocol.handle(SANDBOX_RUNNER_SCHEME, (request) =>
      createSandboxRunnerDocumentResponse({
        url: request.url,
        method: request.method
      })
    )
  } catch (error) {
    sessionLease.poison()

    const cleanupErrors = removeHandlers()

    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        'The sandbox runner session could not be initialized or rolled back.'
      )
    }

    throw error
  }

  let cleanupPromise: Promise<void> | null = null

  const cleanup = (reusable: boolean): Promise<void> => {
    if (cleanupPromise !== null) {
      /*
       * Si una limpieza normal ya estaba en curso pero
       * después descubrimos que la sesión debe invalidarse,
       * envenenamos el lease inmediatamente.
       */
      if (!reusable) {
        sessionLease.poison()
      }

      return cleanupPromise
    }

    /*
     * invalidate() debe envenenar el lease antes de comenzar
     * cualquier operación asíncrona de limpieza.
     *
     * Así ningún fallo intermedio podría devolver la sesión
     * accidentalmente al estado disponible.
     */
    if (!reusable) {
      sessionLease.poison()
    }

    cleanupPromise = (async () => {
      const cleanupErrors = removeHandlers()

      await captureAsyncCleanupError(cleanupErrors, () => runnerSession.closeAllConnections())

      await captureAsyncCleanupError(cleanupErrors, () => runnerSession.clearData())

      await captureAsyncCleanupError(cleanupErrors, () => runnerSession.clearAuthCache())

      await captureAsyncCleanupError(cleanupErrors, () => runnerSession.clearHostResolverCache())

      await captureAsyncCleanupError(cleanupErrors, () =>
        assertSandboxRunnerSessionStorageEmpty(runnerSession).then(() => undefined)
      )

      if (cleanupErrors.length > 0) {
        /*
         * Incluso dispose() comenzó como una limpieza
         * reutilizable, cualquier error vuelve insegura
         * la sesión compartida.
         */
        sessionLease.poison()

        throw new AggregateError(
          cleanupErrors,
          'The sandbox runner session could not be cleaned completely.'
        )
      }

      /*
       * Solamente una limpieza normal y completamente
       * exitosa puede devolver el lease.
       *
       * invalidate() nunca llega aquí con reusable === true.
       */
      if (reusable) {
        sessionLease.release()
      }
    })()

    return cleanupPromise
  }

  const dispose = (): Promise<void> => cleanup(true)

  const invalidate = (): Promise<void> => cleanup(false)

  return {
    partition,
    session: runnerSession,
    documentURL: SANDBOX_RUNNER_DOCUMENT_URL,
    getRequestAuditSnapshot: requestAudit.snapshot,
    dispose,
    invalidate
  }
}
