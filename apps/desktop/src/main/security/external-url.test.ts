import { describe, expect, it } from 'vitest'
import { isAllowedExternalURL } from './external-url'

describe('isAllowedExternalURL', () => {
  it.each([
    'https://example.com',
    'https://docs.example.com/guide?section=1',
    'https://example.com:443/path#section'
  ])('allows %s', (value) => {
    expect(isAllowedExternalURL(value)).toBe(true)
  })

  it.each([
    'http://example.com',
    'file:///etc/hosts',
    'data:text/html,hello',
    'mailto:test@example.com',
    'ftp://example.com',
    'https://user@example.com',
    'https://user:password@example.com',
    '/relative/path',
    'not a url'
  ])('rejects %s', (value) => {
    expect(isAllowedExternalURL(value)).toBe(false)
  })
})
