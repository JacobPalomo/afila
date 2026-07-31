import { ipcMain } from 'electron'
import { isTrustedIpcSender } from '../security/trusted-renderer'
import { RUN_SOLUTION_CHANNEL, type RunSolutionResponse } from '../../shared/execution'
import { isRunSolutionRequest } from './validate-run-solution-request'
import { runSolutionInUtilityProcess } from './run-solution-in-utility-process'

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

      return runSolutionInUtilityProcess(request)
    }
  )
}
