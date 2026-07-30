import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'

const trustedRendererURLs = new Map<number, string>()

function isTrustedRendererURL(actualURL: string, trustedURL: string): boolean {
  try {
    const actual = new URL(actualURL)
    const trusted = new URL(trustedURL)

    if (actual.protocol !== trusted.protocol) {
      return false
    }

    if (trusted.protocol === 'file:') {
      return actual.host === trusted.host && actual.pathname === trusted.pathname
    }

    return actual.origin === trusted.origin && actual.pathname === trusted.pathname
  } catch {
    return false
  }
}

export function trustRendererWindow(window: BrowserWindow, trustedRendererURL: string): void {
  const webContentsId = window.webContents.id

  trustedRendererURLs.set(webContentsId, trustedRendererURL)

  window.webContents.on('will-navigate', (event, navigationURL) => {
    if (!isTrustedRendererURL(navigationURL, trustedRendererURL)) {
      event.preventDefault()
    }
  })

  window.once('closed', () => {
    trustedRendererURLs.delete(webContentsId)
  })
}

export function isTrustedIpcSender(event: IpcMainInvokeEvent): boolean {
  const trustedRendererURL = trustedRendererURLs.get(event.sender.id)

  return (
    trustedRendererURL !== undefined &&
    event.senderFrame !== null &&
    event.senderFrame === event.sender.mainFrame &&
    isTrustedRendererURL(event.senderFrame.url, trustedRendererURL)
  )
}
