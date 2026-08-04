import { describe, expect, it } from 'vitest'
import { createSandboxRunnerSessionLeaseController } from './sandbox-runner-session-lease'

describe('sandbox runner session lease', () => {
  it('starts available', () => {
    const controller = createSandboxRunnerSessionLeaseController()

    expect(controller.getState()).toBe('available')
  })

  it('rejects concurrent acquisition', () => {
    const controller = createSandboxRunnerSessionLeaseController()

    controller.acquire()

    expect(() => controller.acquire()).toThrow('already in use')

    expect(controller.getState()).toBe('leased')
  })

  it('becomes available after release', () => {
    const controller = createSandboxRunnerSessionLeaseController()

    const lease = controller.acquire()

    lease.release()

    expect(controller.getState()).toBe('available')

    expect(() => controller.acquire()).not.toThrow()
  })

  it('becomes permanently unavailable after poisoning', () => {
    const controller = createSandboxRunnerSessionLeaseController()

    const lease = controller.acquire()

    lease.poison()

    expect(controller.getState()).toBe('poisoned')

    expect(() => controller.acquire()).toThrow('incomplete cleanup')
  })

  it('ignores a stale release', () => {
    const controller = createSandboxRunnerSessionLeaseController()

    const firstLease = controller.acquire()

    firstLease.release()

    const secondLease = controller.acquire()

    firstLease.release()

    expect(controller.getState()).toBe('leased')

    expect(() => controller.acquire()).toThrow('already in use')

    secondLease.release()

    expect(controller.getState()).toBe('available')
  })

  it('ignores stale poisoning after release', () => {
    const controller = createSandboxRunnerSessionLeaseController()

    const firstLease = controller.acquire()

    firstLease.release()

    const secondLease = controller.acquire()

    firstLease.poison()

    expect(controller.getState()).toBe('leased')

    secondLease.release()

    expect(controller.getState()).toBe('available')
  })
})
