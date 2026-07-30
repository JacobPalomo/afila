import type { Problem } from '../types'

export const reverseStringProblem = {
  id: 'reverse-string',
  title: 'Invertir una cadena',
  difficulty: 'easy',
  description:
    'Escribe una función que reciba una cadena y devuelva sus caracteres en orden inverso.',
  examples: ["invertir('hola') // 'aloh'", "invertir('') // ''"],
  constraints: [
    'El argumento siempre será una cadena.',
    'La función debe conservar todos los caracteres, incluidos los espacios.'
  ],
  fileName: 'solution.ts',
  starterCode: `function invertir(texto: string): string {
  return texto
}`,
  testCases: [
    {
      id: 'regular-text',
      label: 'Texto normal',
      args: ['hola'],
      expected: 'aloh'
    },
    {
      id: 'empty-text',
      label: 'Cadena vacía',
      args: [''],
      expected: ''
    },
    {
      id: 'palindrome',
      label: 'Palíndromo',
      args: ['reconocer'],
      expected: 'reconocer'
    },
    {
      id: 'text-with-space',
      label: 'Texto con espacio',
      args: ['punto afila'],
      expected: 'alifa otnup'
    }
  ]
} as const satisfies Problem
