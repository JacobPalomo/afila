import { Buffer } from 'node:buffer'
import {
  SANDBOX_RUNNER_DOCUMENT_URL,
  type SandboxRunnerRequestDescriptor
} from './sandbox-runner-document'

export const SANDBOX_RUNNER_REQUEST_AUDIT_MAX_ENTRIES = 64 as const

const MAX_REQUEST_URL_BYTES = 2_048
const MAX_REQUEST_METHOD_BYTES = 16
const MAX_REQUEST_RESOURCE_TYPE_BYTES = 32

export interface SandboxRunnerRequestAuditEntry extends SandboxRunnerRequestDescriptor {
  readonly allowed: boolean
}

export interface SandboxRunnerRequestAuditSnapshot {
  readonly totalCount: number
  readonly allowedCount: number
  readonly deniedCount: number
  readonly overflowed: boolean
  readonly entries: readonly SandboxRunnerRequestAuditEntry[]
}

export interface SandboxRunnerRequestAudit {
  record(request: SandboxRunnerRequestDescriptor, allowed: boolean): void
  snapshot(): SandboxRunnerRequestAuditSnapshot
}

function isBoundedString(value: string, maximumBytes: number): boolean {
  return value.length > 0 && Buffer.byteLength(value, 'utf8') <= maximumBytes
}

function isCanonicalAllowedRequest(entry: SandboxRunnerRequestAuditEntry): boolean {
  return (
    entry.allowed &&
    entry.url === SANDBOX_RUNNER_DOCUMENT_URL &&
    entry.method === 'GET' &&
    entry.resourceType === 'mainFrame'
  )
}

export function createSandboxRunnerRequestAudit(): SandboxRunnerRequestAudit {
  let totalCount = 0
  let allowedCount = 0
  let deniedCount = 0
  let overflowed = false

  const entries: SandboxRunnerRequestAuditEntry[] = []

  const record = (request: SandboxRunnerRequestDescriptor, allowed: boolean): void => {
    totalCount += 1

    if (allowed) {
      allowedCount += 1
    } else {
      deniedCount += 1
    }

    const isBounded =
      isBoundedString(request.url, MAX_REQUEST_URL_BYTES) &&
      isBoundedString(request.method, MAX_REQUEST_METHOD_BYTES) &&
      isBoundedString(request.resourceType, MAX_REQUEST_RESOURCE_TYPE_BYTES)

    if (!isBounded || entries.length >= SANDBOX_RUNNER_REQUEST_AUDIT_MAX_ENTRIES) {
      overflowed = true
      return
    }

    entries.push(
      Object.freeze({
        url: request.url,
        method: request.method,
        resourceType: request.resourceType,
        allowed
      })
    )
  }

  const snapshot = (): SandboxRunnerRequestAuditSnapshot =>
    Object.freeze({
      totalCount,
      allowedCount,
      deniedCount,
      overflowed,
      entries: Object.freeze([...entries])
    })

  return Object.freeze({
    record,
    snapshot
  })
}

export function getSandboxRunnerRequestAuditViolation(
  snapshot: SandboxRunnerRequestAuditSnapshot
): string | null {
  if (
    !Number.isInteger(snapshot.totalCount) ||
    !Number.isInteger(snapshot.allowedCount) ||
    !Number.isInteger(snapshot.deniedCount) ||
    snapshot.totalCount <= 0 ||
    snapshot.allowedCount < 0 ||
    snapshot.deniedCount < 0
  ) {
    return 'The sandbox runner request audit contains invalid counters.'
  }

  if (snapshot.totalCount !== snapshot.allowedCount + snapshot.deniedCount) {
    return 'The sandbox runner request audit counters do not balance.'
  }

  if (snapshot.overflowed) {
    return 'The sandbox runner request audit exceeded its bounded capacity.'
  }

  if (snapshot.entries.length !== snapshot.totalCount) {
    return 'The sandbox runner request audit is incomplete.'
  }

  let observedAllowedCount = 0

  for (const entry of snapshot.entries) {
    if (
      !isBoundedString(entry.url, MAX_REQUEST_URL_BYTES) ||
      !isBoundedString(entry.method, MAX_REQUEST_METHOD_BYTES) ||
      !isBoundedString(entry.resourceType, MAX_REQUEST_RESOURCE_TYPE_BYTES)
    ) {
      return 'The sandbox runner request audit contains an invalid entry.'
    }

    if (entry.allowed) {
      observedAllowedCount += 1

      if (!isCanonicalAllowedRequest(entry)) {
        return 'The sandbox runner allowed a non-canonical request.'
      }
    } else if (
      entry.url === SANDBOX_RUNNER_DOCUMENT_URL &&
      entry.method === 'GET' &&
      entry.resourceType === 'mainFrame'
    ) {
      return 'The sandbox runner denied its canonical document unexpectedly.'
    }
  }

  if (snapshot.allowedCount !== 1 || observedAllowedCount !== 1) {
    return 'The sandbox runner must allow exactly one canonical document request.'
  }

  return null
}
