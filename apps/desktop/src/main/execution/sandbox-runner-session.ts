import { randomUUID } from 'node:crypto'
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

export interface SandboxRunnerSessionHandle {
  readonly partition: string
  readonly session: Session
  readonly documentURL: typeof SANDBOX_RUNNER_DOCUMENT_URL
  getRequestAuditSnapshot(): SandboxRunnerRequestAuditSnapshot
  dispose(): Promise<void>
}

function createSandboxRunnerPartition(): string {
  return `afila-sandbox-runner-${randomUUID()}`
}

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

  const partition = createSandboxRunnerPartition()

  const runnerSession = session.fromPartition(partition, {
    cache: false
  })

  const requestAudit = createSandboxRunnerRequestAudit()

  if (runnerSession.storagePath !== null) {
    throw new Error('The sandbox runner session must be non-persistent.')
  }

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
    const cleanupErrors = removeHandlers()

    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        'The sandbox runner session could not be initialized or rolled back.'
      )
    }

    throw error
  }

  let disposePromise: Promise<void> | null = null

  const dispose = (): Promise<void> => {
    if (disposePromise !== null) {
      return disposePromise
    }

    disposePromise = (async () => {
      const cleanupErrors = removeHandlers()

      await captureAsyncCleanupError(cleanupErrors, () => runnerSession.closeAllConnections())

      await Promise.all([
        captureAsyncCleanupError(cleanupErrors, () => runnerSession.clearCache()),
        captureAsyncCleanupError(cleanupErrors, () => runnerSession.clearStorageData())
      ])

      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          cleanupErrors,
          'The sandbox runner session could not be cleaned completely.'
        )
      }
    })()

    return disposePromise
  }

  return {
    partition,
    session: runnerSession,
    documentURL: SANDBOX_RUNNER_DOCUMENT_URL,
    getRequestAuditSnapshot: requestAudit.snapshot,
    dispose
  }
}
