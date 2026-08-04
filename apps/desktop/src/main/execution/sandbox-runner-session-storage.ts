import type { Session } from 'electron'

export interface SandboxRunnerSessionStorageSnapshot {
  readonly cookieCount: number
  readonly cacheSize: number
  readonly runningServiceWorkerCount: number
}

const SNAPSHOT_KEYS = ['cookieCount', 'cacheSize', 'runningServiceWorkerCount'] as const

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value >= 0
}

export function getSandboxRunnerSessionStorageViolation(snapshot: unknown): string | null {
  if (!isPlainRecord(snapshot)) {
    return 'The sandbox runner session storage snapshot is malformed.'
  }

  const keys = Object.keys(snapshot)

  if (
    keys.length !== SNAPSHOT_KEYS.length ||
    !SNAPSHOT_KEYS.every((key) => Object.hasOwn(snapshot, key))
  ) {
    return 'The sandbox runner session storage snapshot has an unexpected shape.'
  }

  if (
    !isSafeNonNegativeInteger(snapshot.cookieCount) ||
    !isSafeNonNegativeInteger(snapshot.cacheSize) ||
    !isSafeNonNegativeInteger(snapshot.runningServiceWorkerCount)
  ) {
    return 'The sandbox runner session storage snapshot contains invalid counters.'
  }

  if (snapshot.cookieCount !== 0) {
    return 'The sandbox runner session started with cookies.'
  }

  if (snapshot.cacheSize !== 0) {
    return 'The sandbox runner session started with cached data.'
  }

  if (snapshot.runningServiceWorkerCount !== 0) {
    return 'The sandbox runner session started with running ServiceWorkers.'
  }

  return null
}

export async function inspectSandboxRunnerSessionStorage(
  runnerSession: Session
): Promise<SandboxRunnerSessionStorageSnapshot> {
  const [cookies, cacheSize] = await Promise.all([
    runnerSession.cookies.get({}),
    runnerSession.getCacheSize()
  ])

  const runningServiceWorkers = runnerSession.serviceWorkers.getAllRunning()

  return Object.freeze({
    cookieCount: cookies.length,
    cacheSize,
    runningServiceWorkerCount: Object.keys(runningServiceWorkers).length
  })
}

export async function assertSandboxRunnerSessionStorageEmpty(
  runnerSession: Session
): Promise<SandboxRunnerSessionStorageSnapshot> {
  const snapshot = await inspectSandboxRunnerSessionStorage(runnerSession)

  const violation = getSandboxRunnerSessionStorageViolation(snapshot)

  if (violation !== null) {
    throw new Error(violation)
  }

  return snapshot
}
