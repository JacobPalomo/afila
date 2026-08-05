import type { Event, RenderProcessGoneDetails, WebContents } from 'electron'
import type { SandboxRunnerRendererGoneDetails } from './sandbox-runner-execution-supervisor'

export interface SandboxRunnerRendererGoneMonitor {
  wait(): Promise<SandboxRunnerRendererGoneDetails>
  dispose(): void
}

export function createSandboxRunnerRendererGoneMonitor(
  contents: WebContents
): SandboxRunnerRendererGoneMonitor {
  if (contents.isDestroyed()) {
    throw new Error('The sandbox runner WebContents is destroyed.')
  }

  if (contents.isCrashed()) {
    throw new Error('The sandbox runner renderer process has already crashed.')
  }

  let disposed = false

  let resolveRendererGone: (details: SandboxRunnerRendererGoneDetails) => void = () => undefined

  const rendererGonePromise = new Promise<SandboxRunnerRendererGoneDetails>((resolve) => {
    resolveRendererGone = resolve
  })

  const onRendererGone = (event: Event, details: RenderProcessGoneDetails): void => {
    void event

    if (disposed) {
      return
    }

    disposed = true

    contents.removeListener('render-process-gone', onRendererGone)

    resolveRendererGone({
      reason: details.reason,
      exitCode: details.exitCode
    })
  }

  contents.once('render-process-gone', onRendererGone)

  const dispose = (): void => {
    if (disposed) {
      return
    }

    disposed = true

    contents.removeListener('render-process-gone', onRendererGone)
  }

  return {
    wait: () => rendererGonePromise,
    dispose
  }
}
