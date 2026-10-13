import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Fraction } from '../js/fractions.js';
import { solveGraphic } from '../js/graphic.js';

function eq(value, text) {
  assert.equal(value.toString(), Fraction.from(text).toString());
}

describe('Método gráfico', () => {
  it('resuelve el ejemplo 40x₁ + 50x₂ por reducción', () => {
    const result = solveGraphic({
      sense: 'max',
      objective: ['40', '50'],
      constraints: [
        { coeffs: ['1', '2'], op: '<=', rhs: '50' },
        { coeffs: ['4', '2'], op: '<=', rhs: '120' },
      ],
    });

    assert.equal(result.status, 'optimal');
    assert.equal(result.vertices.length, 4);
    const opt = result.best[0];
    eq(opt.x, '70/3');
    eq(opt.y, '40/3');
    eq(opt.z, '1600');
    assert.deepEqual(result.active.slice().sort(), ['R1', 'R2']);

    const cross = result.reductions[0];
    assert.equal(cross.kind, 'reduce');
    assert.equal(cross.feasible, true);
    eq(cross.point.x, '70/3');
    eq(cross.point.y, '40/3');

    const zs = result.vertices.map((v) => v.z.toString()).sort();
    assert.deepEqual(zs, ['0', '1200', '1250', '1600']);
  });

  it('detecta región vacía', () => {
    const result = solveGraphic({
      sense: 'max',
      objective: ['1', '1'],
      constraints: [
        { coeffs: ['1', '1'], op: '<=', rhs: '2' },
        { coeffs: ['1', '1'], op: '>=', rhs: '5' },
      ],
    });
    assert.equal(result.status, 'infeasible');
    assert.equal(result.vertices.length, 0);
  });

  it('detecta objetivo no acotado', () => {
    const result = solveGraphic({
      sense: 'max',
      objective: ['1', '1'],
      constraints: [
        { coeffs: ['1', '-1'], op: '<=', rhs: '2' },
        { coeffs: ['-1', '1'], op: '<=', rhs: '3' },
      ],
    });
    assert.equal(result.status, 'unbounded');
    assert.equal(result.improving, true);
  });

  it('detecta óptimos alternativos cuando Z es paralela a una arista', () => {
    const result = solveGraphic({
      sense: 'max',
      objective: ['2', '4'],
      constraints: [
        { coeffs: ['1', '2'], op: '<=', rhs: '8' },
        { coeffs: ['1', '0'], op: '<=', rhs: '6' },
        { coeffs: ['0', '1'], op: '<=', rhs: '3' },
      ],
    });
    assert.equal(result.status, 'alternate');
    assert.equal(result.best.length, 2);
    result.best.forEach((v) => eq(v.z, '16'));
    assert.equal(result.parallelTo, 'R1');
  });
});
