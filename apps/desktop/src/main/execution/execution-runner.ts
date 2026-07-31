import {
  isExecutionRunnerRequestMessage,
  type ExecutionRunnerResponseMessage
} from './runner-protocol'
import { simulateRunSolution } from './simulate-run-solution'

const SIMULATED_EXECUTION_DELAY_MS = 650

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

const parentPort = process.parentPort

if (parentPort === null) {
  throw new Error('The execution runner requires a parent port.')
}

async function handleMessage(value: unknown): Promise<void> {
  if (!isExecutionRunnerRequestMessage(value)) {
    process.exit(1)
  }

  await wait(SIMULATED_EXECUTION_DELAY_MS)

  const message: ExecutionRunnerResponseMessage = {
    type: 'run-solution-result',
    requestId: value.requestId,
    response: simulateRunSolution(value.request)
  }

  parentPort.postMessage(message)
}

parentPort.once('message', (event) => {
  void handleMessage(event.data).catch(() => {
    process.exit(1)
  })
})
