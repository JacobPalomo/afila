import { Buffer } from 'node:buffer'
import type { WebContents } from 'electron'
import { SANDBOX_RUNNER_ISOLATED_WORLD_ID } from './sandbox-runner-isolated-world-probe'

export const SANDBOX_RUNNER_WEBRTC_LOCKDOWN_SOURCE_URL =
  'afila-sandbox://runner/webrtc-lockdown.js' as const

export const SANDBOX_RUNNER_WEBRTC_LOCKDOWN_TIMEOUT_MS = 2_000 as const

export const SANDBOX_RUNNER_WEBRTC_LOCKDOWN_MARKER = 'afila-sandbox-webrtc-lockdown-v1' as const

export const SANDBOX_RUNNER_WEBRTC_GLOBAL_NAMES = [
  'RTCPeerConnection',
  'webkitRTCPeerConnection',
  'mozRTCPeerConnection',
  'RTCDataChannel'
] as const

const MAX_WEBRTC_LOCKDOWN_RESULT_BYTES = 4_096

const LOCKED_GLOBAL_EXPECTATION = Object.freeze({
  type: 'undefined',
  own: true,
  valueIsUndefined: true,
  writable: false,
  enumerable: false,
  configurable: false,
  prototypeAlias: false,
  constructBlocked: true
})

export const SANDBOX_RUNNER_WEBRTC_LOCKDOWN_EXPECTED_RESULT = JSON.stringify({
  marker: SANDBOX_RUNNER_WEBRTC_LOCKDOWN_MARKER,
  globals: Object.fromEntries(
    SANDBOX_RUNNER_WEBRTC_GLOBAL_NAMES.map((name) => [name, LOCKED_GLOBAL_EXPECTATION])
  )
})

export const SANDBOX_RUNNER_WEBRTC_LOCKDOWN_SOURCE = `(() => {
  'use strict'

  const marker =
    ${JSON.stringify(SANDBOX_RUNNER_WEBRTC_LOCKDOWN_MARKER)}

  const names =
    ${JSON.stringify(SANDBOX_RUNNER_WEBRTC_GLOBAL_NAMES)}

  const hasPrototypeAlias = (name) => {
    let current =
      Object.getPrototypeOf(globalThis)

    while (current !== null) {
      if (
        Object.getOwnPropertyDescriptor(
          current,
          name
        ) !== undefined
      ) {
        return true
      }

      current =
        Object.getPrototypeOf(current)
    }

    return false
  }

  for (const name of names) {
    Object.defineProperty(
      globalThis,
      name,
      {
        value: undefined,
        writable: false,
        enumerable: false,
        configurable: false
      }
    )
  }

  const globals = {}

  for (const name of names) {
    const descriptor =
      Object.getOwnPropertyDescriptor(
        globalThis,
        name
      )

    let constructBlocked = false

    try {
      Reflect.construct(
        globalThis[name],
        []
      )
    } catch {
      constructBlocked = true
    }

    globals[name] = {
      type: typeof globalThis[name],
      own:
        Object.prototype.hasOwnProperty.call(
          globalThis,
          name
        ),
      valueIsUndefined:
        descriptor !== undefined &&
        descriptor.value === undefined,
			writable:
				descriptor?.writable ?? null,
			enumerable:
				descriptor?.enumerable ?? null,
			configurable:
				descriptor?.configurable ?? null,
      prototypeAlias:
        hasPrototypeAlias(name),
      constructBlocked
    }
  }

  return JSON.stringify({
    marker,
    globals
  })
})()`

export function getSandboxRunnerWebRTCLockdownViolation(result: unknown): string | null {
  if (typeof result !== 'string') {
    return 'The sandbox runner WebRTC lockdown returned an unsupported value.'
  }

  if (Buffer.byteLength(result, 'utf8') > MAX_WEBRTC_LOCKDOWN_RESULT_BYTES) {
    return 'The sandbox runner WebRTC lockdown result exceeded its byte limit.'
  }

  if (result !== SANDBOX_RUNNER_WEBRTC_LOCKDOWN_EXPECTED_RESULT) {
    return 'The sandbox runner WebRTC lockdown returned an unexpected result.'
  }

  return null
}

export async function runSandboxRunnerWebRTCLockdown(contents: WebContents): Promise<void> {
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
        code: SANDBOX_RUNNER_WEBRTC_LOCKDOWN_SOURCE,
        url: SANDBOX_RUNNER_WEBRTC_LOCKDOWN_SOURCE_URL
      }
    ],
    false
  )

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error('The sandbox runner WebRTC lockdown timed out.'))
    }, SANDBOX_RUNNER_WEBRTC_LOCKDOWN_TIMEOUT_MS)
  })

  try {
    const result: unknown = await Promise.race([executionPromise, timeoutPromise])

    const violation = getSandboxRunnerWebRTCLockdownViolation(result)

    if (violation !== null) {
      throw new Error(violation)
    }
  } finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle)
    }
  }
}
