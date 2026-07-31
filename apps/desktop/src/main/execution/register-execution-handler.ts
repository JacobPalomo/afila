import { ipcMain } from 'electron'
import { isTrustedIpcSender } from '../security/trusted-renderer'
import { RUN_SOLUTION_CHANNEL, type RunSolutionResponse } from '../../shared/execution'
import { isRunSolutionRequest } from './validate-run-solution-request'

const SIMULATED_EXECUTION_DELAY_MS = 650

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

export function registerExecutionHandler(): void {
  ipcMain.handle(
    RUN_SOLUTION_CHANNEL,
    async (event, request: unknown): Promise<RunSolutionResponse> => {
      if (!isTrustedIpcSender(event)) {
        return {
          ok: false,
          error: {
            code: 'invalid-request',
            message: 'El remitente de la solicitud no está autorizado.'
          }
        }
      }

      if (!isRunSolutionRequest(request)) {
        return {
          ok: false,
          error: {
            code: 'invalid-request',
            message: 'La solicitud de ejecución no es válida.'
          }
        }
      }

      await wait(SIMULATED_EXECUTION_DELAY_MS)

      return {
        ok: true,
        results: request.testCases.map((testCase, index) => ({
          status: 'passed',
          testCaseId: testCase.id,
          actual: testCase.expected,
          durationMs: index + 1
        }))
      }
    }
  )
}
