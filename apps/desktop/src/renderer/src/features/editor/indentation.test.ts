import { describe, expect, it } from 'vitest'
import { indentCodeSelection } from './indentation'

describe('indentCodeSelection', () => {
  it('inserts indentation at the caret', () => {
    expect(indentCodeSelection('abc', 1, 1)).toEqual({
      code: 'a  bc',
      selectionStart: 3,
      selectionEnd: 3
    })
  })

  it('indents every selected line', () => {
    const code = 'first\nsecond\nthird'

    expect(indentCodeSelection(code, 0, code.length)).toEqual({
      code: '  first\n  second\n  third',
      selectionStart: 2,
      selectionEnd: 24
    })
  })

  it('indents from the beginning of the first line', () => {
    const code = 'first\nsecond'

    expect(indentCodeSelection(code, 2, code.length)).toEqual({
      code: '  first\n  second',
      selectionStart: 4,
      selectionEnd: 16
    })
  })

  it('does not indent the line after a trailing newline', () => {
    const code = 'first\nsecond\nthird'

    expect(indentCodeSelection(code, 0, 13)).toEqual({
      code: '  first\n  second\nthird',
      selectionStart: 2,
      selectionEnd: 17
    })
  })
})
