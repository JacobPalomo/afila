export const SANDBOX_RUNNER_SCHEME = 'afila-sandbox' as const

export const SANDBOX_RUNNER_DOCUMENT_URL = `${SANDBOX_RUNNER_SCHEME}://runner/index.html` as const

export const SANDBOX_RUNNER_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'none'",
  "connect-src 'none'",
  "img-src 'none'",
  "media-src 'none'",
  "font-src 'none'",
  "style-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
  "manifest-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ')

export const SANDBOX_RUNNER_DOCUMENT = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="referrer" content="no-referrer">
    <title>Afila Sandbox Runner</title>
  </head>
  <body></body>
</html>
`

export interface SandboxRunnerRequestDescriptor {
  readonly url: string
  readonly method: string
  readonly resourceType: string
}

interface SandboxRunnerProtocolRequest {
  readonly url: string
  readonly method: string
}

export function isSandboxRunnerDocumentURL(value: string): boolean {
  try {
    const url = new URL(value)

    return (
      url.protocol === `${SANDBOX_RUNNER_SCHEME}:` &&
      url.username === '' &&
      url.password === '' &&
      url.hostname === 'runner' &&
      url.port === '' &&
      url.pathname === '/index.html' &&
      url.search === '' &&
      url.hash === ''
    )
  } catch {
    return false
  }
}

export function isAllowedSandboxRunnerDocumentRequest(
  request: SandboxRunnerRequestDescriptor
): boolean {
  return (
    request.method === 'GET' &&
    request.resourceType === 'mainFrame' &&
    isSandboxRunnerDocumentURL(request.url)
  )
}

export function createSandboxRunnerDocumentResponse(
  request: SandboxRunnerProtocolRequest
): Response {
  const allowed = request.method === 'GET' && isSandboxRunnerDocumentURL(request.url)

  return new Response(allowed ? SANDBOX_RUNNER_DOCUMENT : null, {
    status: allowed ? 200 : 404,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Content-Security-Policy': SANDBOX_RUNNER_CONTENT_SECURITY_POLICY,
      'Content-Type': allowed ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff'
    }
  })
}
