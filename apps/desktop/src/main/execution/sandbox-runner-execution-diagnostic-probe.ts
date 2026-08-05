import type { WebContents } from 'electron'
import { SANDBOX_RUNNER_ISOLATED_WORLD_ID } from './sandbox-runner-isolated-world-probe'
import { SANDBOX_RUNNER_EXECUTION_DIAGNOSTIC_RESULT } from './sandbox-runner-execution-diagnostic-policy'

const COMPLETE_SOURCE_URL = 'afila-sandbox://runner/execution-diagnostic-complete.js'

const TIMEOUT_SOURCE_URL = 'afila-sandbox://runner/execution-diagnostic-timeout.js'

const CRASH_ARM_SOURCE_URL = 'afila-sandbox://runner/execution-diagnostic-crash-arm.js'

const CRASH_ARM_RESULT = 'afila-sandbox-execution-crash-armed-v1'

const COMPLETE_SOURCE = `(() => {
  'use strict'

  return ${JSON.stringify(SANDBOX_RUNNER_EXECUTION_DIAGNOSTIC_RESULT)}
})()`

const TIMEOUT_SOURCE = `(() => {
  'use strict'

  for (;;) {
    // Fixed diagnostic loop. Termination belongs to the main process.
  }
})()`

const CRASH_ARM_SOURCE = `(() => {
  'use strict'

  return ${JSON.stringify(CRASH_ARM_RESULT)}
})()`

function executeFixedDiagnosticSource(
  contents: WebContents,
  code: string,
  url: string
): Promise<unknown> {
  if (contents.isDestroyed()) {
    throw new Error('The sandbox runner WebContents is destroyed.')
  }

  if (contents.isCrashed()) {
    throw new Error('The sandbox runner renderer process has crashed.')
  }

  return contents.executeJavaScriptInIsolatedWorld(
    SANDBOX_RUNNER_ISOLATED_WORLD_ID,
    [
      {
        code,
        url
      }
    ],
    false
  )
}

export async function runSandboxRunnerCompletionDiagnosticProbe(
  contents: WebContents
): Promise<string> {
  const result = await executeFixedDiagnosticSource(contents, COMPLETE_SOURCE, COMPLETE_SOURCE_URL)

  if (result !== SANDBOX_RUNNER_EXECUTION_DIAGNOSTIC_RESULT) {
    throw new Error('The sandbox runner completion probe returned an unexpected result.')
  }

  return result
}

export async function runSandboxRunnerTimeoutDiagnosticProbe(
  contents: WebContents
): Promise<never> {
  await executeFixedDiagnosticSource(contents, TIMEOUT_SOURCE, TIMEOUT_SOURCE_URL)

  throw new Error('The sandbox runner timeout probe completed unexpectedly.')
}

export async function armSandboxRunnerCrashDiagnosticProbe(contents: WebContents): Promise<void> {
  const result = await executeFixedDiagnosticSource(
    contents,
    CRASH_ARM_SOURCE,
    CRASH_ARM_SOURCE_URL
  )

  if (result !== CRASH_ARM_RESULT) {
    throw new Error('The sandbox runner crash probe could not be armed.')
  }
}
