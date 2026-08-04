import type { Session } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import {
  assertSandboxRunnerSessionStorageEmpty,
  getSandboxRunnerSessionStorageViolation,
  inspectSandboxRunnerSessionStorage
} from './sandbox-runner-session-storage'

const cleanSnapshot = {
  cookieCount: 0,
  cacheSize: 0,
  runningServiceWorkerCount: 0
}

describe('sandbox runner session storage', () => {
  it('accepts an empty session snapshot', () => {
    expect(getSandboxRunnerSessionStorageViolation(cleanSnapshot)).toBeNull()
  })

  it('rejects every non-empty storage state', () => {
    for (const key of ['cookieCount', 'cacheSize', 'runningServiceWorkerCount'] as const) {
      expect(
        getSandboxRunnerSessionStorageViolation({
          ...cleanSnapshot,
          [key]: 1
        })
      ).not.toBeNull()
    }
  })

  it('rejects malformed and extended snapshots', () => {
    expect(getSandboxRunnerSessionStorageViolation(null)).not.toBeNull()

    expect(
      getSandboxRunnerSessionStorageViolation({
        ...cleanSnapshot,
        unexpected: true
      })
    ).not.toBeNull()

    expect(
      getSandboxRunnerSessionStorageViolation({
        ...cleanSnapshot,
        cacheSize: -1
      })
    ).not.toBeNull()
  })

  it('inspects cookies, cache and ServiceWorkers', async () => {
    const getCookies = vi.fn().mockResolvedValue([])

    const getCacheSize = vi.fn().mockResolvedValue(0)

    const getAllRunning = vi.fn().mockReturnValue({})

    const runnerSession = {
      cookies: {
        get: getCookies
      },
      getCacheSize,
      serviceWorkers: {
        getAllRunning
      }
    } as unknown as Session

    await expect(inspectSandboxRunnerSessionStorage(runnerSession)).resolves.toEqual(cleanSnapshot)

    expect(getCookies).toHaveBeenCalledExactlyOnceWith({})

    expect(getCacheSize).toHaveBeenCalledExactlyOnceWith()

    expect(getAllRunning).toHaveBeenCalledExactlyOnceWith()
  })

  it('rejects a dirty inspected session', async () => {
    const runnerSession = {
      cookies: {
        get: vi.fn().mockResolvedValue([
          {
            name: 'unexpected'
          }
        ])
      },
      getCacheSize: vi.fn().mockResolvedValue(0),
      serviceWorkers: {
        getAllRunning: vi.fn().mockReturnValue({})
      }
    } as unknown as Session

    await expect(assertSandboxRunnerSessionStorageEmpty(runnerSession)).rejects.toThrow(
      'started with cookies'
    )
  })
})
