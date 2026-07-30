import type { RunSolutionRequest, RunSolutionResponse } from './execution'

export interface ExecutionAPI {
  readonly run: (request: RunSolutionRequest) => Promise<RunSolutionResponse>
}

export interface AfilaAPI {
  readonly execution: ExecutionAPI
}
