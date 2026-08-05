export const SANDBOX_RUNNER_RELEASE_TIMEOUT_MS = 5_000 as const

export const SANDBOX_RUNNER_RELEASE_POLL_MS = 25 as const

export interface SandboxRunnerProcessReleaseTarget {
  readonly windowId: number
  readonly webContentsId: number
  readonly osProcessId: number
  readonly processCreationTime: number
}

export interface SandboxRunnerProcessReleaseSnapshot {
  readonly windowRegistered: boolean
  readonly webContentsRegistered: boolean
  readonly processRegistered: boolean
}

export interface WaitForSandboxRunnerProcessReleaseOptions {
  readonly readSnapshot: () => SandboxRunnerProcessReleaseSnapshot
  readonly timeoutMs?: number
  readonly pollMs?: number
  readonly now?: () => number
  readonly sleep?: (milliseconds: number) => Promise<void>
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

export function getSandboxRunnerProcessReleaseViolation(
  snapshot: SandboxRunnerProcessReleaseSnapshot
): string | null {
  if (snapshot.windowRegistered) {
    return 'The sandbox runner window ' + 'remains registered.'
  }

  if (snapshot.webContentsRegistered) {
    return 'The sandbox runner WebContents ' + 'remains registered.'
  }

  if (snapshot.processRegistered) {
    return 'The sandbox runner renderer process ' + 'remains registered.'
  }

  return null
}

export async function waitForSandboxRunnerProcessRelease(
  options: WaitForSandboxRunnerProcessReleaseOptions
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? SANDBOX_RUNNER_RELEASE_TIMEOUT_MS

  const pollMs = options.pollMs ?? SANDBOX_RUNNER_RELEASE_POLL_MS

  if (!isPositiveSafeInteger(timeoutMs)) {
    throw new RangeError('The sandbox runner release timeout must be a positive safe integer.')
  }

  if (!isPositiveSafeInteger(pollMs)) {
    throw new RangeError(
      'The sandbox runner release poll interval must be a positive safe integer.'
    )
  }

  const now = options.now ?? Date.now

  const sleep = options.sleep ?? defaultSleep

  const deadline = now() + timeoutMs

  let latestSnapshot = options.readSnapshot()

  while (true) {
    const violation = getSandboxRunnerProcessReleaseViolation(latestSnapshot)

    if (violation === null) {
      return
    }

    if (now() >= deadline) {
      throw new Error(`${violation} ` + `Snapshot: ${JSON.stringify(latestSnapshot)}`)
    }

    await sleep(pollMs)

    latestSnapshot = options.readSnapshot()
  }
}
