const INDENTATION = '  '

export interface CodeSelectionEdit {
  readonly code: string
  readonly selectionStart: number
  readonly selectionEnd: number
}

export function indentCodeSelection(
  code: string,
  selectionStart: number,
  selectionEnd: number
): CodeSelectionEdit {
  if (selectionStart === selectionEnd) {
    return {
      code: code.slice(0, selectionStart) + INDENTATION + code.slice(selectionEnd),
      selectionStart: selectionStart + INDENTATION.length,
      selectionEnd: selectionEnd + INDENTATION.length
    }
  }

  const lineStart = code.lastIndexOf('\n', selectionStart - 1) + 1

  const selectionEndsAtLineStart = selectionEnd > selectionStart && code[selectionEnd - 1] === '\n'

  const blockEnd = selectionEndsAtLineStart ? selectionEnd - 1 : selectionEnd

  const selectedBlock = code.slice(lineStart, blockEnd)

  const selectedLines = selectedBlock.split('\n')

  const indentedBlock = selectedLines.map((line) => `${INDENTATION}${line}`).join('\n')

  return {
    code: code.slice(0, lineStart) + indentedBlock + code.slice(blockEnd),
    selectionStart: selectionStart + INDENTATION.length,
    selectionEnd: selectionEnd + INDENTATION.length * selectedLines.length
  }
}
