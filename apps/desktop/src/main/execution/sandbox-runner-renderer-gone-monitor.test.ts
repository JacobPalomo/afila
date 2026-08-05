import { EventEmitter } from 'node:events'
import type { WebContents } from 'electron'
import { describe, expect, it } from 'vitest'
import { createSandboxRunnerRendererGoneMonitor } from './sandbox-runner-renderer-gone-monitor'

class FakeWebContents extends EventEmitter {
  destroyed = false
  crashed = false

  isDestroyed(): boolean {
    return this.destroyed
  }

  isCrashed(): boolean {
    return this.crashed
  }
}

function asWebContents(contents: FakeWebContents): WebContents {
  return contents as unknown as WebContents
}

describe('sandbox runner renderer-gone monitor', () => {
  it('resolves when the renderer process disappears', async () => {
    const contents = new FakeWebContents()

    const monitor = createSandboxRunnerRendererGoneMonitor(asWebContents(contents))

    expect(contents.listenerCount('render-process-gone')).toBe(1)

    contents.emit(
      'render-process-gone',
      {},
      {
        reason: 'crashed',
        exitCode: 9
      }
    )

    await expect(monitor.wait()).resolves.toEqual({
      reason: 'crashed',
      exitCode: 9
    })

    expect(contents.listenerCount('render-process-gone')).toBe(0)
  })

  it('removes its listener when disposed', () => {
    const contents = new FakeWebContents()

    const monitor = createSandboxRunnerRendererGoneMonitor(asWebContents(contents))

    monitor.dispose()
    monitor.dispose()

    expect(contents.listenerCount('render-process-gone')).toBe(0)
  })

  it('rejects destroyed WebContents', () => {
    const contents = new FakeWebContents()

    contents.destroyed = true

    expect(() => createSandboxRunnerRendererGoneMonitor(asWebContents(contents))).toThrow(
      'WebContents is destroyed'
    )
  })

  it('rejects an already crashed renderer', () => {
    const contents = new FakeWebContents()

    contents.crashed = true

    expect(() => createSandboxRunnerRendererGoneMonitor(asWebContents(contents))).toThrow(
      'already crashed'
    )
  })
})
