import type { Problem } from '../types'

export const sumTwoNumbersProblem = {
  id: 'sum-two-numbers',
  title: 'Suma de dos números',
  difficulty: 'easy',
  description: 'Escribe una función que reciba dos números y devuelva la suma de ambos.',
  examples: ['sumar(2, 3) // 5', 'sumar(-4, 7) // 3'],
  constraints: [
    'Los argumentos siempre serán números enteros.',
    'La función debe devolver un número.'
  ],
  fileName: 'solution.ts',
  entryPoint: 'sumar',
  starterCode: `function sumar(a: number, b: number): number {
  return a + b
}`,
  testCases: [
    {
      id: 'positive-numbers',
      label: 'Números positivos',
      args: [2, 3],
      expected: 5
    },
    {
      id: 'mixed-signs',
      label: 'Signos diferentes',
      args: [-4, 7],
      expected: 3
    },
    {
      id: 'zeros',
      label: 'Valores en cero',
      args: [0, 0],
      expected: 0
    },
    {
      id: 'negative-numbers',
      label: 'Números negativos',
      args: [-5, -8],
      expected: -13
    }
  ]
} as const satisfies Problem
