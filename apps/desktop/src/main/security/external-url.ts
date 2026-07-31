const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:'])

export function isAllowedExternalURL(value: string): boolean {
  try {
    const url = new URL(value)

    return (
      ALLOWED_EXTERNAL_PROTOCOLS.has(url.protocol) && url.username === '' && url.password === ''
    )
  } catch {
    return false
  }
}
