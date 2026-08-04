import { describe, expect, it } from 'vitest'
import {
  createSandboxRunnerRequestAudit,
  getSandboxRunnerRequestAuditViolation,
  SANDBOX_RUNNER_REQUEST_AUDIT_MAX_ENTRIES
} from './sandbox-runner-request-audit'
import { SANDBOX_RUNNER_DOCUMENT_URL } from './sandbox-runner-document'

describe('sandbox runner request audit', () => {
  it('accepts one canonical request and bounded denials', () => {
    const audit = createSandboxRunnerRequestAudit()

    audit.record(
      {
        url: SANDBOX_RUNNER_DOCUMENT_URL,
        method: 'GET',
        resourceType: 'mainFrame'
      },
      true
    )

    audit.record(
      {
        url: 'https://example.invalid/afila-probe',
        method: 'GET',
        resourceType: 'xhr'
      },
      false
    )

    const snapshot = audit.snapshot()

    expect(getSandboxRunnerRequestAuditViolation(snapshot)).toBeNull()

    expect(snapshot).toMatchObject({
      totalCount: 2,
      allowedCount: 1,
      deniedCount: 1,
      overflowed: false
    })
  })

  it('rejects an allowed non-canonical request', () => {
    const audit = createSandboxRunnerRequestAudit()

    audit.record(
      {
        url: SANDBOX_RUNNER_DOCUMENT_URL,
        method: 'GET',
        resourceType: 'mainFrame'
      },
      true
    )

    audit.record(
      {
        url: 'https://example.invalid/',
        method: 'GET',
        resourceType: 'xhr'
      },
      true
    )

    expect(getSandboxRunnerRequestAuditViolation(audit.snapshot())).not.toBeNull()
  })

  it('rejects an overflowing audit', () => {
    const audit = createSandboxRunnerRequestAudit()

    audit.record(
      {
        url: SANDBOX_RUNNER_DOCUMENT_URL,
        method: 'GET',
        resourceType: 'mainFrame'
      },
      true
    )

    for (let index = 0; index < SANDBOX_RUNNER_REQUEST_AUDIT_MAX_ENTRIES; index += 1) {
      audit.record(
        {
          url: `https://example.invalid/probe-${index}`,
          method: 'GET',
          resourceType: 'xhr'
        },
        false
      )
    }

    expect(getSandboxRunnerRequestAuditViolation(audit.snapshot())).not.toBeNull()
  })

  it('returns an immutable snapshot', () => {
    const audit = createSandboxRunnerRequestAudit()

    audit.record(
      {
        url: SANDBOX_RUNNER_DOCUMENT_URL,
        method: 'GET',
        resourceType: 'mainFrame'
      },
      true
    )

    const snapshot = audit.snapshot()

    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.entries)).toBe(true)
    expect(Object.isFrozen(snapshot.entries[0])).toBe(true)
  })
})
