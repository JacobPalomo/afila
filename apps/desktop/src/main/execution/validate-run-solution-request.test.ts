import { describe, expect, it } from 'vitest'
import type { ExecutionTestCase, RunSolutionRequest, TestValue } from '../../shared/execution'
import { isRunSolutionRequest } from './validate-run-solution-request'

function createValidTestCase(overrides: Partial<ExecutionTestCase> = {}): ExecutionTestCase {
  return {
    id: 'case-1',
    args: [2, 3],
    expected: 5,
    ...overrides
  }
}

function createValidRequest(overrides: Partial<RunSolutionRequest> = {}): RunSolutionRequest {
  return {
    problemId: 'sum-two-numbers',
    entryPoint: 'sumar',
    sourceCode: 'function sumar(a: number, b: number) { return a + b }',
    testCases: [createValidTestCase()],
    ...overrides
  }
}

function createNestedValue(depth: number): TestValue {
  let value: TestValue = 0

  for (let index = 0; index < depth; index += 1) {
    value = [value]
  }

  return value
}

describe('isRunSolutionRequest', () => {
  it('accepts a valid request', () => {
    expect(isRunSolutionRequest(createValidRequest())).toBe(true)
  })

  it('accepts supported recursive test values', () => {
    const request = createValidRequest({
      testCases: [
        createValidTestCase({
          args: [
            {
              numbers: [1, 2, 3],
              enabled: true,
              note: null
            }
          ],
          expected: {
            result: 'ok'
          }
        })
      ]
    })

    expect(isRunSolutionRequest(request)).toBe(true)
  })

  it('accepts values at every maximum boundary', () => {
    const testCases = Array.from({ length: 100 }, (_, index) =>
      createValidTestCase({
        id: `case-${index}`
      })
    )

    const request = createValidRequest({
      problemId: 'p'.repeat(120),
      entryPoint: `f${'a'.repeat(119)}`,
      sourceCode: 'x'.repeat(100_000),
      testCases
    })

    expect(isRunSolutionRequest(request)).toBe(true)
  })

  it.each([null, undefined, true, 42, 'request', [], new Date()])(
    'rejects invalid top-level value %p',
    (value) => {
      expect(isRunSolutionRequest(value)).toBe(false)
    }
  )

  it('rejects invalid problem ids', () => {
    expect(
      isRunSolutionRequest({
        ...createValidRequest(),
        problemId: ''
      })
    ).toBe(false)

    expect(
      isRunSolutionRequest({
        ...createValidRequest(),
        problemId: 'p'.repeat(121)
      })
    ).toBe(false)
  })

  it.each(['', 'sumar()', 'objeto.sumar', 'mi función', '1sumar', 'a'.repeat(121)])(
    'rejects invalid entry point %s',
    (entryPoint) => {
      expect(
        isRunSolutionRequest({
          ...createValidRequest(),
          entryPoint
        })
      ).toBe(false)
    }
  )

  it('rejects invalid source code', () => {
    expect(
      isRunSolutionRequest({
        ...createValidRequest(),
        sourceCode: 42
      })
    ).toBe(false)

    expect(
      isRunSolutionRequest({
        ...createValidRequest(),
        sourceCode: 'x'.repeat(100_001)
      })
    ).toBe(false)
  })

  it('rejects an empty test list', () => {
    expect(
      isRunSolutionRequest(
        createValidRequest({
          testCases: []
        })
      )
    ).toBe(false)
  })

  it('rejects more than 100 test cases', () => {
    const testCases = Array.from({ length: 101 }, (_, index) =>
      createValidTestCase({
        id: `case-${index}`
      })
    )

    expect(
      isRunSolutionRequest(
        createValidRequest({
          testCases
        })
      )
    ).toBe(false)
  })

  it('rejects duplicate test ids', () => {
    expect(
      isRunSolutionRequest(
        createValidRequest({
          testCases: [createValidTestCase(), createValidTestCase()]
        })
      )
    ).toBe(false)
  })

  it('rejects invalid test ids', () => {
    expect(
      isRunSolutionRequest({
        ...createValidRequest(),
        testCases: [
          {
            ...createValidTestCase(),
            id: ''
          }
        ]
      })
    ).toBe(false)

    expect(
      isRunSolutionRequest({
        ...createValidRequest(),
        testCases: [
          {
            ...createValidTestCase(),
            id: 'c'.repeat(121)
          }
        ]
      })
    ).toBe(false)
  })

  it('rejects non-array arguments', () => {
    expect(
      isRunSolutionRequest({
        ...createValidRequest(),
        testCases: [
          {
            ...createValidTestCase(),
            args: {
              first: 2,
              second: 3
            }
          }
        ]
      })
    ).toBe(false)
  })

  it('rejects sparse argument arrays', () => {
    const sparseArgs: unknown[] = new Array(1)

    expect(
      isRunSolutionRequest({
        ...createValidRequest(),
        testCases: [
          {
            ...createValidTestCase(),
            args: sparseArgs
          }
        ]
      })
    ).toBe(false)
  })

  it('rejects sparse nested arrays', () => {
    const sparseValue: unknown[] = new Array(1)

    expect(
      isRunSolutionRequest({
        ...createValidRequest(),
        testCases: [
          {
            ...createValidTestCase(),
            args: [sparseValue]
          }
        ]
      })
    ).toBe(false)
  })

  it.each([
    ['NaN', Number.NaN],
    ['positive infinity', Infinity],
    ['negative infinity', -Infinity],
    ['undefined', undefined],
    ['bigint', 1n],
    ['symbol', Symbol('value')],
    ['function', () => 1],
    ['date', new Date()],
    ['map', new Map()],
    ['object containing undefined', { valid: 1, invalid: undefined }]
  ])('rejects %s as a test value', (_, invalidValue) => {
    expect(
      isRunSolutionRequest({
        ...createValidRequest(),
        testCases: [
          {
            ...createValidTestCase(),
            expected: invalidValue
          }
        ]
      })
    ).toBe(false)
  })

  it('accepts the maximum value depth', () => {
    expect(
      isRunSolutionRequest({
        ...createValidRequest(),
        testCases: [
          {
            ...createValidTestCase(),
            expected: createNestedValue(20)
          }
        ]
      })
    ).toBe(true)
  })

  it('rejects values beyond the maximum depth', () => {
    expect(
      isRunSolutionRequest({
        ...createValidRequest(),
        testCases: [
          {
            ...createValidTestCase(),
            expected: createNestedValue(21)
          }
        ]
      })
    ).toBe(false)
  })

  it('rejects sparse test lists', () => {
    const sparseTestCases: unknown[] = new Array(1)

    expect(
      isRunSolutionRequest({
        ...createValidRequest(),
        testCases: sparseTestCases
      })
    ).toBe(false)
  })
})
