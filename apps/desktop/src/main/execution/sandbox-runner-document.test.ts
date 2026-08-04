import { describe, expect, it } from 'vitest'
import {
  createSandboxRunnerDocumentResponse,
  isAllowedSandboxRunnerDocumentRequest,
  isSandboxRunnerDocumentURL,
  SANDBOX_RUNNER_CONTENT_SECURITY_POLICY,
  SANDBOX_RUNNER_DOCUMENT,
  SANDBOX_RUNNER_DOCUMENT_URL
} from './sandbox-runner-document'

describe('sandbox runner document', () => {
  it('accepts only the fixed canonical document URL', () => {
    expect(isSandboxRunnerDocumentURL(SANDBOX_RUNNER_DOCUMENT_URL)).toBe(true)
  })

  it.each([
    'https://runner/index.html',
    'afila-sandbox://other/index.html',
    'afila-sandbox://runner/other.html',
    'afila-sandbox://runner/index.html?debug=true',
    'afila-sandbox://runner/index.html#fragment',
    'afila-sandbox://user@runner/index.html'
  ])('rejects unsupported document URL %s', (url) => {
    expect(isSandboxRunnerDocumentURL(url)).toBe(false)
  })

  it('allows only a GET request for the main frame', () => {
    expect(
      isAllowedSandboxRunnerDocumentRequest({
        url: SANDBOX_RUNNER_DOCUMENT_URL,
        method: 'GET',
        resourceType: 'mainFrame'
      })
    ).toBe(true)

    expect(
      isAllowedSandboxRunnerDocumentRequest({
        url: SANDBOX_RUNNER_DOCUMENT_URL,
        method: 'POST',
        resourceType: 'mainFrame'
      })
    ).toBe(false)

    expect(
      isAllowedSandboxRunnerDocumentRequest({
        url: SANDBOX_RUNNER_DOCUMENT_URL,
        method: 'GET',
        resourceType: 'script'
      })
    ).toBe(false)
  })

  it('serves the fixed document with restrictive headers', async () => {
    const response = createSandboxRunnerDocumentResponse({
      url: SANDBOX_RUNNER_DOCUMENT_URL,
      method: 'GET'
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toBe(SANDBOX_RUNNER_DOCUMENT)

    expect(response.headers.get('content-security-policy')).toBe(
      SANDBOX_RUNNER_CONTENT_SECURITY_POLICY
    )

    expect(response.headers.get('cache-control')).toContain('no-store')

    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('returns not found for every other protocol request', async () => {
    const response = createSandboxRunnerDocumentResponse({
      url: 'afila-sandbox://runner/other.html',
      method: 'GET'
    })

    expect(response.status).toBe(404)
    expect(await response.text()).toBe('')
  })

  it('contains no page-created active resources', () => {
    expect(SANDBOX_RUNNER_DOCUMENT).not.toMatch(/<(script|link|style|img|iframe|object|embed)\b/i)

    expect(SANDBOX_RUNNER_DOCUMENT).not.toMatch(/\b(src|href)\s*=/i)
  })

  it('denies active capabilities through the content security policy', () => {
    const directives = SANDBOX_RUNNER_CONTENT_SECURITY_POLICY.split('; ')

    expect(directives).toEqual(
      expect.arrayContaining([
        "default-src 'none'",
        "script-src 'none'",
        "connect-src 'none'",
        "worker-src 'none'",
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'"
      ])
    )
  })

  it('returns not found for a non-GET canonical protocol request', async () => {
    const response = createSandboxRunnerDocumentResponse({
      url: SANDBOX_RUNNER_DOCUMENT_URL,
      method: 'POST'
    })

    expect(response.status).toBe(404)
    expect(await response.text()).toBe('')
  })
})
