import { describe, expect, it, vi } from 'vitest'
import {
  getSandboxRunnerProcessReleaseViolation,
  waitForSandboxRunnerProcessRelease,
  type SandboxRunnerProcessReleaseSnapshot
} from './sandbox-runner-process-release-policy'

const RELEASED_SNAPSHOT: SandboxRunnerProcessReleaseSnapshot = {
  windowRegistered: false,
  webContentsRegistered: false,
  processRegistered: false
}

describe('sandbox runner process release policy', () => {
  it('accepts a fully released runner', () => {
    expect(getSandboxRunnerProcessReleaseViolation(RELEASED_SNAPSHOT)).toBeNull()
  })

  it('rejects a registered window', () => {
    expect(
      getSandboxRunnerProcessReleaseViolation({
        ...RELEASED_SNAPSHOT,
        windowRegistered: true
      })
    ).toBe('The sandbox runner window remains registered.')
  })

  it('rejects registered WebContents', () => {
    expect(
      getSandboxRunnerProcessReleaseViolation({
        ...RELEASED_SNAPSHOT,
        webContentsRegistered: true
      })
    ).toBe('The sandbox runner WebContents remains registered.')
  })

  it('rejects a registered renderer process', () => {
    expect(
      getSandboxRunnerProcessReleaseViolation({
        ...RELEASED_SNAPSHOT,
        processRegistered: true
      })
    ).toBe('The sandbox runner renderer process remains registered.')
  })

  it('waits until every runner resource is released', async () => {
    const snapshots: SandboxRunnerProcessReleaseSnapshot[] = [
      {
        windowRegistered: true,
        webContentsRegistered: true,
        processRegistered: true
      },
      {
        windowRegistered: false,
        webContentsRegistered: false,
        processRegistered: true
      },
      RELEASED_SNAPSHOT
    ]

    let elapsed = 0

    const readSnapshot = vi.fn(() => snapshots.shift() ?? RELEASED_SNAPSHOT)

    const sleep = vi.fn(async (milliseconds: number): Promise<void> => {
      elapsed += milliseconds
    })

    await expect(
      waitForSandboxRunnerProcessRelease({
        readSnapshot,
        timeoutMs: 100,
        pollMs: 10,
        now: () => elapsed,
        sleep
      })
    ).resolves.toBeUndefined()

    expect(readSnapshot).toHaveBeenCalledTimes(3)

    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('fails when a runner remains registered', async () => {
    let elapsed = 0

    const readSnapshot = vi.fn((): SandboxRunnerProcessReleaseSnapshot => ({
      windowRegistered: false,
      webContentsRegistered: false,
      processRegistered: true
    }))

    const sleep = vi.fn(async (milliseconds: number): Promise<void> => {
      elapsed += milliseconds
    })

    await expect(
      waitForSandboxRunnerProcessRelease({
        readSnapshot,
        timeoutMs: 30,
        pollMs: 10,
        now: () => elapsed,
        sleep
      })
    ).rejects.toThrow('renderer process remains registered')

    expect(sleep).toHaveBeenCalledTimes(3)
  })

  it('rejects invalid timing options', async () => {
    await expect(
      waitForSandboxRunnerProcessRelease({
        readSnapshot: () => RELEASED_SNAPSHOT,
        timeoutMs: 0
      })
    ).rejects.toThrow('release timeout')

    await expect(
      waitForSandboxRunnerProcessRelease({
        readSnapshot: () => RELEASED_SNAPSHOT,
        pollMs: -1
      })
    ).rejects.toThrow('poll interval')
  })
})
