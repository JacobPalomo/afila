import { utilityProcess } from 'electron'
import { randomUUID } from 'node:crypto'
import type { RunSolutionRequest, RunSolutionResponse } from '../../shared/execution'
import runnerPath from './execution-runner?modulePath'
import {
  isExecutionRunnerResponseMessageForRequest,
  type ExecutionRunnerRequestMessage
} from './runner-protocol'

const RUNNER_TIMEOUT_MS = 3_000
const RUNNER_HEAP_LIMIT_MB = 128

function createExecutionFailure(message: string): RunSolutionResponse {
  return {
    ok: false,
    error: {
      code: 'execution-failed',
      message
    }
  }
}

export function runSolutionInUtilityProcess(
  request: RunSolutionRequest
): Promise<RunSolutionResponse> {
  return new Promise((resolve) => {
    const requestId = randomUUID()

    const requestMessage: ExecutionRunnerRequestMessage = {
      type: 'run-solution',
      requestId,
      request
    }

    let child: ReturnType<typeof utilityProcess.fork>

    try {
      child = utilityProcess.fork(runnerPath, [], {
        execArgv: [`--max-old-space-size=${RUNNER_HEAP_LIMIT_MB}`],
        stdio: 'ignore',
        serviceName: 'Afila Execution Runner'
      })
    } catch {
      resolve(createExecutionFailure('No se pudo iniciar el proceso de ejecución.'))

      return
    }

    let settled = false

    const finish = (response: RunSolutionResponse, terminateProcess = true): void => {
      if (settled) {
        return
      }

      settled = true

      clearTimeout(timeout)

      if (terminateProcess && child.pid !== undefined) {
        child.kill()
      }

      resolve(response)
    }

    const timeout = setTimeout(() => {
      finish(createExecutionFailure('La ejecución excedió el tiempo permitido.'))
    }, RUNNER_TIMEOUT_MS)

    child.once('spawn', () => {
      if (settled) {
        child.kill()
        return
      }

      try {
        child.postMessage(requestMessage)
      } catch {
        finish(createExecutionFailure('No se pudo enviar la solicitud al proceso de ejecución.'))
      }
    })

    child.once('message', (message) => {
      if (!isExecutionRunnerResponseMessageForRequest(message, requestMessage)) {
        finish(createExecutionFailure('El proceso devolvió una respuesta no válida.'))

        return
      }

      finish(message.response)
    })

    child.once('error', () => {
      finish(createExecutionFailure('El proceso de ejecución encontró un error fatal.'))
    })

    child.once('exit', (code) => {
      if (settled) {
        return
      }

      finish(
        createExecutionFailure(
          `El proceso de ejecución terminó inesperadamente con el código ${code}.`
        ),
        false
      )
    })
  })
}
