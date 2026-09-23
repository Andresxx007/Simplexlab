/**
 * Ejemplos precargados (sección 11 de la especificación).
 * Cada uno incluye resultado esperado para pruebas.
 */

export const EXAMPLES = [
  {
    id: 'basico',
    title: 'Básico',
    level: 'Introducción',
    illustrates: 'Maximización con tres restricciones ≤ y región factible en 2D',
    statement:
      'Maximizar 3X₁ + 5X₂ sujeto a X₁ ≤ 4, 2X₂ ≤ 12 y 3X₁ + 2X₂ ≤ 18, X ≥ 0.',
    problem: {
      sense: 'max',
      numVars: 2,
      objective: ['3', '5'],
      constraints: [
        { coeffs: ['1', '0'], op: '<=', rhs: '4' },
        { coeffs: ['0', '2'], op: '<=', rhs: '12' },
        { coeffs: ['3', '2'], op: '<=', rhs: '18' },
      ],
    },
    expected: {
      status: 'optimal',
      values: ['2', '6'],
      z: '36',
    },
  },
  {
    id: 'intermedio',
    title: 'Intermedio',
    level: 'Intermedio',
    illustrates: 'Dos iteraciones y camino de Simplex sobre el gráfico',
    statement:
      'Maximizar 40X₁ + 30X₂ sujeto a 2X₁ + X₂ ≤ 40, X₁ + 2X₂ ≤ 50 y X₁ + X₂ ≤ 35.',
    problem: {
      sense: 'max',
      numVars: 2,
      objective: ['40', '30'],
      constraints: [
        { coeffs: ['2', '1'], op: '<=', rhs: '40' },
        { coeffs: ['1', '2'], op: '<=', rhs: '50' },
        { coeffs: ['1', '1'], op: '<=', rhs: '35' },
      ],
    },
    expected: {
      status: 'optimal',
      values: ['10', '20'],
      z: '1000',
    },
  },
  {
    id: 'tres-vars',
    title: 'Tres variables',
    level: 'Intermedio',
    illustrates: 'Más de dos variables y precios sombra',
    statement:
      'Maximizar 5X₁ + 4X₂ + 3X₃ sujeto a 2X₁ + 3X₂ + X₃ ≤ 5, 4X₁ + X₂ + 2X₃ ≤ 11 y 3X₁ + 4X₂ + 2X₃ ≤ 8.',
    problem: {
      sense: 'max',
      numVars: 3,
      objective: ['5', '4', '3'],
      constraints: [
        { coeffs: ['2', '3', '1'], op: '<=', rhs: '5' },
        { coeffs: ['4', '1', '2'], op: '<=', rhs: '11' },
        { coeffs: ['3', '4', '2'], op: '<=', rhs: '8' },
      ],
    },
    expected: {
      status: 'optimal',
      values: ['2', '0', '1'],
      z: '13',
      shadow: ['1', '0', '1'],
    },
  },
  {
    id: 'minimizacion',
    title: 'Minimización ≥',
    level: 'Intermedio',
    illustrates: 'Minimización con restricciones de mayor o igual',
    statement: 'Minimizar 2X₁ + 3X₂ sujeto a X₁ + X₂ ≥ 4 y X₁ + 3X₂ ≥ 6.',
    problem: {
      sense: 'min',
      numVars: 2,
      objective: ['2', '3'],
      constraints: [
        { coeffs: ['1', '1'], op: '>=', rhs: '4' },
        { coeffs: ['1', '3'], op: '>=', rhs: '6' },
      ],
    },
    expected: {
      status: 'optimal',
      values: ['3', '1'],
      z: '9',
    },
  },
  {
    id: 'mixtas',
    title: 'Restricciones mixtas',
    level: 'Avanzado',
    illustrates: 'M grande, igualdades y fracciones exactas',
    statement:
      'Minimizar 4X₁ + X₂ sujeto a 3X₁ + X₂ = 3, 4X₁ + 3X₂ ≥ 6 y X₁ + 2X₂ ≤ 4.',
    problem: {
      sense: 'min',
      numVars: 2,
      objective: ['4', '1'],
      constraints: [
        { coeffs: ['3', '1'], op: '=', rhs: '3' },
        { coeffs: ['4', '3'], op: '>=', rhs: '6' },
        { coeffs: ['1', '2'], op: '<=', rhs: '4' },
      ],
    },
    expected: {
      status: 'optimal',
      values: ['2/5', '9/5'],
      z: '17/5',
    },
  },
  {
    id: 'no-acotado',
    title: 'No acotado',
    level: 'Caso especial',
    illustrates: 'Detección de problema no acotado',
    statement: 'Maximizar X₁ + X₂ sujeto a X₁ − X₂ ≤ 2 y −X₁ + X₂ ≤ 3.',
    problem: {
      sense: 'max',
      numVars: 2,
      objective: ['1', '1'],
      constraints: [
        { coeffs: ['1', '-1'], op: '<=', rhs: '2' },
        { coeffs: ['-1', '1'], op: '<=', rhs: '3' },
      ],
    },
    expected: {
      status: 'unbounded',
    },
  },
  {
    id: 'infactible',
    title: 'Infactible',
    level: 'Caso especial',
    illustrates: 'Detección de región factible vacía',
    statement: 'Maximizar X₁ + X₂ sujeto a X₁ + X₂ ≤ 2 y X₁ + X₂ ≥ 5.',
    problem: {
      sense: 'max',
      numVars: 2,
      objective: ['1', '1'],
      constraints: [
        { coeffs: ['1', '1'], op: '<=', rhs: '2' },
        { coeffs: ['1', '1'], op: '>=', rhs: '5' },
      ],
    },
    expected: {
      status: 'infeasible',
    },
  },
  {
    id: 'alternativos',
    title: 'Óptimos alternativos',
    level: 'Caso especial',
    illustrates: 'Múltiples soluciones óptimas sobre un segmento',
    statement:
      'Maximizar 2X₁ + 4X₂ sujeto a X₁ + 2X₂ ≤ 8, X₁ ≤ 6 y X₂ ≤ 3.',
    problem: {
      sense: 'max',
      numVars: 2,
      objective: ['2', '4'],
      constraints: [
        { coeffs: ['1', '2'], op: '<=', rhs: '8' },
        { coeffs: ['1', '0'], op: '<=', rhs: '6' },
        { coeffs: ['0', '1'], op: '<=', rhs: '3' },
      ],
    },
    expected: {
      status: 'alternate',
      z: '16',
      // Una de las óptimas básicas
      altPoints: [
        ['2', '3'],
        ['6', '1'],
      ],
    },
  },
  {
    id: 'degenerado',
    title: 'Degenerado',
    level: 'Caso especial',
    illustrates: 'Empate en la prueba de razón',
    statement: 'Maximizar 3X₁ + 9X₂ sujeto a X₁ + 4X₂ ≤ 8 y X₁ + 2X₂ ≤ 4.',
    problem: {
      sense: 'max',
      numVars: 2,
      objective: ['3', '9'],
      constraints: [
        { coeffs: ['1', '4'], op: '<=', rhs: '8' },
        { coeffs: ['1', '2'], op: '<=', rhs: '4' },
      ],
    },
    expected: {
      status: 'optimal',
      values: ['0', '2'],
      z: '18',
    },
  },
];

export function getExample(id) {
  return EXAMPLES.find((e) => e.id === id) || null;
}
