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
  starterCode: `function sumar(a: number, b: number): number {
  return a + b
}`
} as const satisfies Problem
