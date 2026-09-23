/**
 * Pruebas del motor con Node (node --test).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Fraction } from '../js/fractions.js';
import { solve } from '../js/engine.js';
import { EXAMPLES } from '../js/examples.js';
import { validateProblem } from '../js/validator.js';

function eqFrac(a, b) {
  return Fraction.from(a).equals(Fraction.from(b));
}

describe('Fraction', () => {
  it('parsea coma decimal boliviana', () => {
    assert.equal(Fraction.parse('0,1').toString(), '1/10');
  });
  it('simplifica', () => {
    assert.equal(new Fraction(2, 4).toString(), '1/2');
  });
  it('suma exacta', () => {
    assert.equal(Fraction.parse('1/3').add('1/6').toString(), '1/2');
  });
});

describe('Ejemplos de aceptación', () => {
  for (const ex of EXAMPLES) {
    it(ex.title, () => {
      const result = solve(ex.problem);
      if (ex.expected.status) {
        if (ex.expected.status === 'alternate') {
          assert.ok(
            result.status === 'alternate' || result.status === 'optimal',
            `status=${result.status}`
          );
          if (ex.expected.z) {
            assert.ok(eqFrac(result.z, ex.expected.z), `Z=${result.z} vs ${ex.expected.z}`);
          }
          if (ex.expected.altPoints) {
            const point = result.values.map((v) => v.toString());
            const match = ex.expected.altPoints.some((p) =>
              p.every((val, i) => eqFrac(point[i], val))
            );
            assert.ok(match, `punto ${point} no está en óptimas esperadas`);
          }
        } else {
          assert.equal(result.status, ex.expected.status);
        }
      }
      if (ex.expected.values) {
        ex.expected.values.forEach((v, i) => {
          assert.ok(
            eqFrac(result.values[i], v),
            `X${i + 1}=${result.values[i]} vs ${v}`
          );
        });
      }
      if (ex.expected.z && ex.expected.status !== 'alternate') {
        assert.ok(eqFrac(result.z, ex.expected.z), `Z=${result.z} vs ${ex.expected.z}`);
      }
      if (ex.expected.shadow) {
        const keys = Object.keys(result.shadowPrices);
        ex.expected.shadow.forEach((v, i) => {
          assert.ok(
            eqFrac(result.shadowPrices[keys[i]], v),
            `shadow ${keys[i]}=${result.shadowPrices[keys[i]]} vs ${v}`
          );
        });
      }
    });
  }
});

describe('Validador', () => {
  it('rechaza RHS vacío', () => {
    const r = validateProblem({
      sense: 'max',
      numVars: 1,
      objective: ['1'],
      constraints: [{ coeffs: ['1'], op: '<=', rhs: '' }],
    });
    assert.equal(r.ok, false);
  });

  it('acepta coeficientes vacíos como 0', () => {
    const r = validateProblem({
      sense: 'max',
      numVars: 2,
      objective: ['3', ''],
      constraints: [{ coeffs: ['1', ''], op: '<=', rhs: '4' }],
    });
    assert.equal(r.ok, true);
    assert.equal(r.problem.objective[1], '0');
  });
});

describe('Clasificación infactible vs no acotado', () => {
  it('RHS negativo en ≤ que vuelve el modelo infactible', () => {
    const result = solve({
      sense: 'max',
      numVars: 1,
      objective: ['1'],
      constraints: [{ coeffs: ['4'], op: '<=', rhs: '-3' }],
    });
    assert.equal(result.status, 'infeasible');
  });

  it('restricciones ≤ y ≥ contradictorias', () => {
    const result = solve({
      sense: 'max',
      numVars: 2,
      objective: ['1', '1'],
      constraints: [
        { coeffs: ['1', '1'], op: '<=', rhs: '2' },
        { coeffs: ['1', '1'], op: '>=', rhs: '5' },
      ],
    });
    assert.equal(result.status, 'infeasible');
  });

  it('sin razón positiva pero artificial básica > 0 → infactible (no no-acotado)', () => {
    const result = solve({
      sense: 'max',
      numVars: 2,
      objective: ['-5', '4/3'],
      constraints: [
        { coeffs: ['2', '0'], op: '<=', rhs: '-4' },
        { coeffs: ['2', '-2'], op: '<=', rhs: '2' },
      ],
    });
    assert.equal(result.status, 'infeasible');
  });
});

describe('Problemas con 3 o más variables', () => {
  it('ejemplo 3: Max 5X₁+4X₂+3X₃ → X=(2,0,1), Z=13', () => {
    const result = solve({
      sense: 'max',
      numVars: 3,
      objective: ['5', '4', '3'],
      constraints: [
        { coeffs: ['2', '3', '1'], op: '<=', rhs: '5' },
        { coeffs: ['4', '1', '2'], op: '<=', rhs: '11' },
        { coeffs: ['3', '4', '2'], op: '<=', rhs: '8' },
      ],
    });

    assert.equal(result.status, 'optimal');
    assert.ok(eqFrac(result.values[0], '2'));
    assert.ok(eqFrac(result.values[1], '0'));
    assert.ok(eqFrac(result.values[2], '1'));
    assert.ok(eqFrac(result.z, '13'));

    // Comprobación independiente de factibilidad (no depende del motor)
    const x = [2, 0, 1];
    assert.ok(2 * x[0] + 3 * x[1] + 1 * x[2] <= 5);
    assert.ok(4 * x[0] + 1 * x[1] + 2 * x[2] <= 11);
    assert.ok(3 * x[0] + 4 * x[1] + 2 * x[2] <= 8);
    assert.equal(5 * x[0] + 4 * x[1] + 3 * x[2], 13);

    result.verification.forEach((v) => {
      assert.equal(v.satisfied, true);
    });
    assert.ok(eqFrac(result.shadowPrices['S₁'], '1'));
    assert.ok(eqFrac(result.shadowPrices['S₂'], '0'));
    assert.ok(eqFrac(result.shadowPrices['S₃'], '1'));
  });
});
