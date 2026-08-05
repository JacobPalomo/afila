import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerExecutionHandler } from './execution/register-execution-handler'
import { trustRendererWindow } from './security/trusted-renderer'
import { pathToFileURL } from 'url'
import { isAllowedExternalURL } from './security/external-url'
import { parseSandboxRunnerExecutionDiagnosticScenario } from './execution/sandbox-runner-execution-diagnostic-policy'
import { runSandboxRunnerExecutionDiagnostic } from './execution/sandbox-runner-execution-diagnostic'

function createWindow(): void {
  const developmentRendererURL = process.env['ELECTRON_RENDERER_URL']

  const trustedRendererURL =
    is.dev && developmentRendererURL
      ? developmentRendererURL
      : pathToFileURL(join(__dirname, '../renderer/index.html')).toString()

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    minWidth: 720,
    minHeight: 540,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  trustRendererWindow(mainWindow, trustedRendererURL)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isAllowedExternalURL(details.url)) {
      void shell.openExternal(details.url).catch((error: unknown) => {
        console.error('Failed to open external URL', error)
      })
    }

    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && developmentRendererURL) {
    mainWindow.loadURL(developmentRendererURL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
async function startApplication(): Promise<void> {
  const diagnosticScenario = parseSandboxRunnerExecutionDiagnosticScenario(
    process.env['AFILA_SANDBOX_EXECUTION_DIAGNOSTIC']
  )

  if (diagnosticScenario !== null) {
    if (app.isPackaged) {
      throw new Error('Sandbox execution diagnostics are disabled in packaged applications.')
    }

    const report = await runSandboxRunnerExecutionDiagnostic(diagnosticScenario)

    console.info('AFILA_SANDBOX_EXECUTION_DIAGNOSTIC', JSON.stringify(report))

    app.exit(0)

    return
  }

  registerExecutionHandler()

  electronApp.setAppUserModelId('com.jacobpalomo.afila')

  app.on('browser-window-created', (_event, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
}

void app
  .whenReady()
  .then(startApplication)
  .catch((error: unknown) => {
    console.error('Failed to start Afila.', error)

    app.exit(1)
  })

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
