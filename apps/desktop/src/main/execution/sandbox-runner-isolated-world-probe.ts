import { Buffer } from 'node:buffer'
import type { WebContents } from 'electron'
import { SANDBOX_RUNNER_DOCUMENT_URL } from './sandbox-runner-document'

export const SANDBOX_RUNNER_ISOLATED_WORLD_ID = 1001 as const

export const SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_SOURCE_URL =
  'afila-sandbox://runner/isolated-world-probe.js' as const

export const SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_TIMEOUT_MS = 2_000 as const

const SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_MARKER = 'afila-sandbox-isolated-world-probe-v1'

const SANDBOX_RUNNER_PAGE_SCRIPT_PROBE_ATTRIBUTE = 'data-afila-page-script-probe'

const SANDBOX_RUNNER_PAGE_SCRIPT_PROBE_CODE =
  `document.documentElement.setAttribute(` +
  `${JSON.stringify(SANDBOX_RUNNER_PAGE_SCRIPT_PROBE_ATTRIBUTE)}, 'executed')`

export const SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_EXPECTED_RESULT = JSON.stringify({
  marker: SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_MARKER,
  documentURL: SANDBOX_RUNNER_DOCUMENT_URL,
  locationURL: SANDBOX_RUNNER_DOCUMENT_URL,
  globalMatchesWindow: true,
  topMatchesWindow: true,
  childFrameCount: 0,
  processType: 'undefined',
  requireType: 'undefined',
  bufferType: 'undefined',
  moduleType: 'undefined',
  pageInlineScriptExecuted: false
})

export const SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_SOURCE = `(() => {
  'use strict'

  const root = document.documentElement

  if (root === null) {
    return 'missing-document-element'
  }

  const probeAttribute =
    ${JSON.stringify(SANDBOX_RUNNER_PAGE_SCRIPT_PROBE_ATTRIBUTE)}

  root.removeAttribute(probeAttribute)

  const pageScript = document.createElement('script')
  pageScript.textContent =
    ${JSON.stringify(SANDBOX_RUNNER_PAGE_SCRIPT_PROBE_CODE)}

  root.appendChild(pageScript)
  pageScript.remove()

  const pageInlineScriptExecuted =
    root.getAttribute(probeAttribute) === 'executed'

  root.removeAttribute(probeAttribute)

  return JSON.stringify({
    marker:
      ${JSON.stringify(SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_MARKER)},
    documentURL: document.URL,
    locationURL: location.href,
    globalMatchesWindow: globalThis === window,
    topMatchesWindow: top === window,
    childFrameCount: window.frames.length,
    processType: typeof process,
    requireType: typeof require,
    bufferType: typeof Buffer,
    moduleType: typeof module,
    pageInlineScriptExecuted
  })
})()`

const MAX_SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_RESULT_BYTES = 1_024

export function getSandboxRunnerIsolatedWorldProbeViolation(result: unknown): string | null {
  if (typeof result !== 'string') {
    return 'The sandbox runner isolated-world probe returned an unsupported value.'
  }

  if (Buffer.byteLength(result, 'utf8') > MAX_SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_RESULT_BYTES) {
    return 'The sandbox runner isolated-world probe result exceeded its byte limit.'
  }

  if (result !== SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_EXPECTED_RESULT) {
    return 'The sandbox runner isolated-world probe returned an unexpected result.'
  }

  return null
}

export async function runSandboxRunnerIsolatedWorldProbe(contents: WebContents): Promise<void> {
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
          code: SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_SOURCE,
          url: SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_SOURCE_URL
        }
      ],
      false
    )
  )

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error('The sandbox runner isolated-world probe timed out.'))
    }, SANDBOX_RUNNER_ISOLATED_WORLD_PROBE_TIMEOUT_MS)
  })

  try {
    const result: unknown = await Promise.race([executionPromise, timeoutPromise])

    const violation = getSandboxRunnerIsolatedWorldProbeViolation(result)

    if (violation !== null) {
      throw new Error(violation)
    }
  } finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle)
    }
  }
}
