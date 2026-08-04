export type SandboxRunnerSessionLeaseState = 'available' | 'leased' | 'poisoned'

export interface SandboxRunnerSessionLease {
  release(): void
  poison(): void
}

export interface SandboxRunnerSessionLeaseController {
  acquire(): SandboxRunnerSessionLease
  getState(): SandboxRunnerSessionLeaseState
}

export function createSandboxRunnerSessionLeaseController(): SandboxRunnerSessionLeaseController {
  let state: SandboxRunnerSessionLeaseState = 'available'

  let activeToken: symbol | null = null

  const acquire = (): SandboxRunnerSessionLease => {
    if (state === 'poisoned') {
      throw new Error('The sandbox runner session is unavailable after an incomplete cleanup.')
    }

    if (state === 'leased') {
      throw new Error('The sandbox runner session is already in use.')
    }

    const token = Symbol('sandbox-runner-session-lease')

    state = 'leased'
    activeToken = token

    let settled = false

    const settle = (nextState: 'available' | 'poisoned'): void => {
      if (settled) {
        return
      }

      settled = true

      if (state !== 'leased' || activeToken !== token) {
        activeToken = null
        state = 'poisoned'
        return
      }

      activeToken = null
      state = nextState
    }

    return Object.freeze({
      release: (): void => {
        settle('available')
      },

      poison: (): void => {
        settle('poisoned')
      }
    })
  }

  return Object.freeze({
    acquire,

    getState: (): SandboxRunnerSessionLeaseState => state
  })
}
