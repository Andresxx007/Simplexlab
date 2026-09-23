/**
 * Motor Simplex — método de la M grande.
 * No toca el DOM. Recibe un problema y devuelve pasos + resultado.
 */

import { Fraction, BigCoeff } from './fractions.js';

const MAX_ITERATIONS = 100;
const STAGNATION_LIMIT = 8;

const SUB = {
  1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅',
  6: '₆', 7: '₇', 8: '₈', 9: '₉', 10: '₁₀',
};

export function idxLabel(i) {
  return SUB[i] || String(i);
}

export function varName(prefix, i) {
  return `${prefix}${idxLabel(i)}`;
}

export function cloneTableau(t) {
  return {
    colNames: [...t.colNames],
    basic: [...t.basic],
    matrix: t.matrix.map((row) => row.map((c) => c.clone())),
    zRow: t.zRow.map((c) => c.clone()),
    zRhs: t.zRhs.clone(),
    rhs: t.rhs.map((c) => c.clone()),
  };
}

function parseVarIndex(name) {
  for (const [k, v] of Object.entries(SUB)) {
    if (name.endsWith(v)) return Number(k);
  }
  const m = name.match(/(\d+)/);
  return m ? Number(m[1]) : 999;
}

function cellFrac(coeff) {
  return coeff.m.isZero() ? coeff.c : coeff.c;
}

/**
 * Normaliza: min→max, RHS≥0, auxiliares, fila Z canónica con M grande.
 */
function normalize(problem) {
  const notes = [];
  const numVars = problem.numVars;
  const originalSense = problem.sense;

  let obj = problem.objective.map((c) => Fraction.from(c));
  if (originalSense === 'min') {
    obj = obj.map((c) => c.neg());
    notes.push(
      'El problema de minimización se convirtió a maximización multiplicando la función objetivo por −1. Al final se recupera el valor original de Z.'
    );
  }

  const constraints = problem.constraints.map((con, i) => {
    let coeffs = con.coeffs.map((c) => Fraction.from(c));
    let op = con.op;
    let rhs = Fraction.from(con.rhs);

    if (rhs.isNegative()) {
      coeffs = coeffs.map((c) => c.neg());
      rhs = rhs.neg();
      if (op === '<=') op = '>=';
      else if (op === '>=') op = '<=';
      notes.push(
        `La restricción ${i + 1} tenía lado derecho negativo; se multiplicó por −1 e invirtió el operador.`
      );
    }
    return { coeffs, op, rhs };
  });

  const slackNames = [];
  const excessNames = [];
  const artNames = [];
  let s = 0;
  let e = 0;
  let a = 0;

  constraints.forEach((con) => {
    if (con.op === '<=') {
      s += 1;
      slackNames.push(varName('S', s));
    } else if (con.op === '>=') {
      e += 1;
      a += 1;
      excessNames.push(varName('E', e));
      artNames.push(varName('A', a));
    } else {
      a += 1;
      artNames.push(varName('A', a));
    }
  });

  const colNames = [];
  for (let i = 1; i <= numVars; i++) colNames.push(varName('X', i));
  colNames.push(...slackNames, ...excessNames, ...artNames);

  const nCols = colNames.length;
  const matrix = [];
  const rhs = [];
  const basic = [];

  let sIdx = 0;
  let eIdx = 0;
  let aIdx = 0;

  constraints.forEach((con) => {
    const row = Array.from({ length: nCols }, () => BigCoeff.zero());
    for (let j = 0; j < numVars; j++) {
      row[j] = BigCoeff.fromFraction(con.coeffs[j]);
    }

    if (con.op === '<=') {
      row[numVars + sIdx] = BigCoeff.fromFraction(1);
      basic.push(slackNames[sIdx]);
      sIdx += 1;
    } else if (con.op === '>=') {
      const eCol = numVars + slackNames.length + eIdx;
      const aCol = numVars + slackNames.length + excessNames.length + aIdx;
      row[eCol] = BigCoeff.fromFraction(-1);
      row[aCol] = BigCoeff.fromFraction(1);
      basic.push(artNames[aIdx]);
      eIdx += 1;
      aIdx += 1;
    } else {
      const aCol = numVars + slackNames.length + excessNames.length + aIdx;
      row[aCol] = BigCoeff.fromFraction(1);
      basic.push(artNames[aIdx]);
      aIdx += 1;
    }

    matrix.push(row);
    rhs.push(BigCoeff.fromFraction(con.rhs));
  });

  // Fila Z: maximizar Z = c·x − M·ΣA
  // Ecuación: Z − c·x + M·ΣA = 0  → coeficientes iniciales en fila Z
  const zRow = Array.from({ length: nCols }, () => BigCoeff.zero());
  for (let j = 0; j < numVars; j++) {
    zRow[j] = BigCoeff.fromFraction(obj[j].neg());
  }
  artNames.forEach((name) => {
    zRow[colNames.indexOf(name)] = new BigCoeff(1, 0); // +M
  });
  let zRhs = BigCoeff.zero();

  // Forma canónica: z ← z − M · (fila de cada artificial básica)
  artNames.forEach((aName) => {
    const rowIdx = basic.indexOf(aName);
    if (rowIdx < 0) return;
    for (let j = 0; j < nCols; j++) {
      const c = matrix[rowIdx][j].c;
      zRow[j] = zRow[j].sub(new BigCoeff(c, 0));
    }
    zRhs = zRhs.sub(new BigCoeff(rhs[rowIdx].c, 0));
  });

  if (artNames.length > 0) {
    notes.push(
      'Se usó el método de la M grande. Las artificiales se penalizan con −M en la maximización. La fila Z ya está en forma canónica.'
    );
  }

  const aux = [];
  if (slackNames.length) aux.push(`holguras ${slackNames.join(', ')}`);
  if (excessNames.length) aux.push(`excesos ${excessNames.join(', ')}`);
  if (artNames.length) aux.push(`artificiales ${artNames.join(', ')}`);
  if (aux.length) notes.push(`Variables auxiliares: ${aux.join('; ')}.`);

  return {
    originalSense,
    numVars,
    colNames,
    basic,
    matrix,
    rhs,
    zRow,
    zRhs,
    artNames,
    slackNames,
    excessNames,
    notes,
    objOriginal: problem.objective.map((c) => Fraction.from(c)),
    constraintsOriginal: problem.constraints.map((c) => ({
      coeffs: c.coeffs.map((x) => Fraction.from(x)),
      op: c.op,
      rhs: Fraction.from(c.rhs),
    })),
  };
}

function isDegenerate(tableau) {
  return tableau.rhs.some((r) => r.isZero());
}

function findEntering(zRow, useBland) {
  if (useBland) {
    for (let j = 0; j < zRow.length; j++) {
      if (zRow[j].isNegative()) return j;
    }
    return -1;
  }

  let best = -1;
  let bestVal = null;
  for (let j = 0; j < zRow.length; j++) {
    if (!zRow[j].isNegative()) continue;
    if (
      best === -1 ||
      zRow[j].compare(bestVal) < 0 ||
      (zRow[j].equals(bestVal) && j < best)
    ) {
      best = j;
      bestVal = zRow[j];
    }
  }
  return best;
}

function findLeaving(tableau, pivotCol, useBland) {
  const ratios = [];
  let bestRow = -1;
  let bestRatio = null;
  let bestBasicIndex = Infinity;

  for (let i = 0; i < tableau.matrix.length; i++) {
    const a = cellFrac(tableau.matrix[i][pivotCol]);
    if (!a.isPositive()) {
      ratios.push({
        row: i,
        basic: tableau.basic[i],
        ratio: null,
        eligible: false,
        note: a.isZero()
          ? 'Coeficiente cero: no participa'
          : 'Coeficiente negativo: no participa',
      });
      continue;
    }

    const b = cellFrac(tableau.rhs[i]);
    const ratio = b.div(a);
    ratios.push({
      row: i,
      basic: tableau.basic[i],
      ratio,
      eligible: true,
      note: `${b.toString()} / ${a.toString()} = ${ratio.toString()}`,
    });

    const basicIdx = parseVarIndex(tableau.basic[i]);
    if (bestRow === -1 || ratio.lt(bestRatio)) {
      bestRow = i;
      bestRatio = ratio;
      bestBasicIndex = basicIdx;
    } else if (ratio.equals(bestRatio)) {
      if (useBland || basicIdx < bestBasicIndex) {
        bestRow = i;
        bestBasicIndex = basicIdx;
      }
    }
  }

  const tied =
    bestRatio !== null &&
    ratios.filter((r) => r.eligible && r.ratio.equals(bestRatio)).length > 1;

  return { bestRow, ratios, tied, bestRatio };
}

function pivot(tableau, pivotRow, pivotCol) {
  const t = cloneTableau(tableau);
  const ops = [];
  const p = cellFrac(t.matrix[pivotRow][pivotCol]);

  for (let j = 0; j < t.colNames.length; j++) {
    t.matrix[pivotRow][j] = t.matrix[pivotRow][j].div(p);
  }
  t.rhs[pivotRow] = t.rhs[pivotRow].div(p);
  ops.push(`F${pivotRow + 1} ← F${pivotRow + 1} ÷ ${p.toString()}`);

  for (let i = 0; i < t.matrix.length; i++) {
    if (i === pivotRow) continue;
    const factor = cellFrac(t.matrix[i][pivotCol]);
    if (factor.isZero()) continue;
    for (let j = 0; j < t.colNames.length; j++) {
      t.matrix[i][j] = t.matrix[i][j].sub(t.matrix[pivotRow][j].mul(factor));
    }
    t.rhs[i] = t.rhs[i].sub(t.rhs[pivotRow].mul(factor));
    const sign = factor.isNegative() ? '+' : '−';
    ops.push(`F${i + 1} ← F${i + 1} ${sign} (${factor.abs().toString()}) · F${pivotRow + 1}`);
  }

  const zFactor = t.zRow[pivotCol];
  if (!zFactor.isZero()) {
    for (let j = 0; j < t.colNames.length; j++) {
      const pr = cellFrac(t.matrix[pivotRow][j]);
      const prod = new BigCoeff(zFactor.m.mul(pr), zFactor.c.mul(pr));
      t.zRow[j] = t.zRow[j].sub(prod);
    }
    const prRhs = cellFrac(t.rhs[pivotRow]);
    t.zRhs = t.zRhs.sub(new BigCoeff(zFactor.m.mul(prRhs), zFactor.c.mul(prRhs)));
    ops.push(`Fila Z ← Fila Z − (${zFactor.toString()}) · F${pivotRow + 1}`);
  }

  t.basic[pivotRow] = t.colNames[pivotCol];
  return { tableau: t, ops };
}

function artificialsInBasisPositive(tableau, artNames) {
  for (let i = 0; i < tableau.basic.length; i++) {
    if (!artNames.includes(tableau.basic[i])) continue;
    const r = tableau.rhs[i];
    if (!r.isZero()) return true;
  }
  // Parte M negativa en Z también indica artificiales activas
  if (tableau.zRhs.m.isNegative()) return true;
  return false;
}

function extractValues(tableau, numVars) {
  const values = Array.from({ length: numVars }, () => Fraction.zero());
  const allValues = {};
  tableau.colNames.forEach((name) => {
    allValues[name] = Fraction.zero();
  });
  for (let i = 0; i < tableau.basic.length; i++) {
    const name = tableau.basic[i];
    const v = cellFrac(tableau.rhs[i]);
    allValues[name] = v;
    const xi = tableau.colNames.indexOf(name);
    if (xi >= 0 && xi < numVars) values[xi] = v;
  }
  return { values, allValues };
}

function hasAlternateOptima(tableau) {
  for (let j = 0; j < tableau.zRow.length; j++) {
    if (tableau.basic.includes(tableau.colNames[j])) continue;
    if (tableau.zRow[j].isZero()) return true;
  }
  return false;
}

function computeShadowPrices(tableau, slackNames) {
  const prices = {};
  slackNames.forEach((s) => {
    const j = tableau.colNames.indexOf(s);
    if (j >= 0) prices[s] = cellFrac(tableau.zRow[j]).clone();
  });
  return prices;
}

function verifyConstraints(constraintsOriginal, values) {
  return constraintsOriginal.map((con, i) => {
    let lhs = Fraction.zero();
    for (let j = 0; j < con.coeffs.length; j++) {
      lhs = lhs.add(con.coeffs[j].mul(values[j] || Fraction.zero()));
    }
    let satisfied = false;
    let active = false;
    if (con.op === '<=') {
      satisfied = lhs.lte(con.rhs);
      active = lhs.equals(con.rhs);
    } else if (con.op === '>=') {
      satisfied = lhs.gte(con.rhs);
      active = lhs.equals(con.rhs);
    } else {
      satisfied = lhs.equals(con.rhs);
      active = true;
    }
    return { index: i + 1, lhs, rhs: con.rhs, op: con.op, satisfied, active };
  });
}

/**
 * @param {object} problem
 * @param {{ findAlternate?: boolean }} [options]
 */
export function solve(problem, options = {}) {
  const norm = normalize(problem);
  const steps = [];

  let tableau = {
    colNames: norm.colNames,
    basic: [...norm.basic],
    matrix: norm.matrix,
    rhs: norm.rhs,
    zRow: norm.zRow,
    zRhs: norm.zRhs,
  };

  steps.push({
    title: 'Tabla inicial',
    tableau: cloneTableau(tableau),
    status: 'continue',
    pivotCol: null,
    pivotRow: null,
    entering: null,
    leaving: null,
    pivotValue: null,
    ratios: null,
    rowOps: [],
    degeneracy: isDegenerate(tableau),
    notes: [...norm.notes],
    meta: { phase: 'init' },
  });

  let useBland = false;
  let lastZ = tableau.zRhs.clone();
  let stagnant = 0;
  let finalStatus = 'continue';

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const enteringCol = findEntering(tableau.zRow, useBland);

    if (enteringCol === -1) {
      if (artificialsInBasisPositive(tableau, norm.artNames)) {
        finalStatus = 'infeasible';
        steps[steps.length - 1].status = 'infeasible';
        steps[steps.length - 1].notes.push(
          'El problema es infactible: una variable artificial permanece en la base con valor positivo.'
        );
      } else {
        const alternate = hasAlternateOptima(tableau);
        finalStatus = alternate ? 'alternate' : 'optimal';
        steps[steps.length - 1].status = finalStatus;
        if (alternate) {
          steps[steps.length - 1].notes.push(
            'Óptimos alternativos: hay una variable no básica con coeficiente 0 en la fila Z. Toda combinación convexa entre soluciones óptimas básicas también es óptima.'
          );
        } else {
          steps[steps.length - 1].notes.push(
            'Optimalidad alcanzada: no quedan coeficientes negativos en la fila Z.'
          );
        }
      }
      break;
    }

    const before = cloneTableau(tableau);
    const { bestRow, ratios, tied } = findLeaving(tableau, enteringCol, useBland);

    if (bestRow === -1) {
      // Sin razón positiva: si aún hay artificial básica > 0, es infactible
      // (no se pudo expulsar A). Solo es no acotado si la base es factible.
      if (artificialsInBasisPositive(tableau, norm.artNames)) {
        finalStatus = 'infeasible';
        steps.push({
          title: `Iteración ${iter + 1}: infactible`,
          tableau: cloneTableau(tableau),
          status: 'infeasible',
          pivotCol: enteringCol,
          pivotRow: null,
          entering: tableau.colNames[enteringCol],
          leaving: null,
          pivotValue: null,
          ratios,
          rowOps: [],
          degeneracy: false,
          notes: [
            `La variable ${tableau.colNames[enteringCol]} podría entrar, pero ninguna fila tiene coeficiente positivo en esa columna y aún hay una variable artificial en la base con valor positivo. El problema es infactible (región factible vacía), no no acotado.`,
          ],
          meta: { iteration: iter + 1, before },
        });
      } else {
        finalStatus = 'unbounded';
        steps.push({
          title: `Iteración ${iter + 1}: no acotado`,
          tableau: cloneTableau(tableau),
          status: 'unbounded',
          pivotCol: enteringCol,
          pivotRow: null,
          entering: tableau.colNames[enteringCol],
          leaving: null,
          pivotValue: null,
          ratios,
          rowOps: [],
          degeneracy: false,
          notes: [
            `La variable ${tableau.colNames[enteringCol]} puede entrar, pero ninguna fila tiene coeficiente positivo en esa columna. La región factible no está acotada y Z crece sin límite.`,
          ],
          meta: { iteration: iter + 1, before },
        });
      }
      break;
    }

    const pivotVal = tableau.matrix[bestRow][enteringCol].clone();
    const entering = tableau.colNames[enteringCol];
    const leaving = tableau.basic[bestRow];
    const bestRatio = ratios.find((r) => r.row === bestRow)?.ratio;

    const preNotes = [
      `Entra ${entering} (coeficiente más negativo en Z: ${tableau.zRow[enteringCol].toString()}).`,
      `Sale ${leaving} (menor razón = ${bestRatio ? bestRatio.toString() : '?'}).`,
      `Elemento pivote: ${pivotVal.toString()}.`,
    ];
    if (tied) {
      preNotes.push(
        'Empate en la prueba de razón (degeneración). Se elige la variable de menor índice; una básica quedará en cero.'
      );
    }
    if (useBland) {
      preNotes.push('Regla de Bland activa (anticiclos): menor índice al entrar y al salir.');
    }

    const { tableau: next, ops } = pivot(tableau, bestRow, enteringCol);

    if (next.zRhs.equals(lastZ)) {
      stagnant += 1;
      if (stagnant >= STAGNATION_LIMIT) useBland = true;
    } else {
      stagnant = 0;
      lastZ = next.zRhs.clone();
    }

    steps.push({
      title: `Iteración ${iter + 1}`,
      tableau: cloneTableau(next),
      status: 'continue',
      pivotCol: enteringCol,
      pivotRow: bestRow,
      entering,
      leaving,
      pivotValue: pivotVal,
      ratios,
      rowOps: ops,
      degeneracy: tied || isDegenerate(next),
      notes: preNotes,
      meta: { iteration: iter + 1, before },
    });

    tableau = next;
  }

  if (finalStatus === 'continue' && steps[steps.length - 1].status === 'continue') {
    steps[steps.length - 1].notes.push(
      `Se alcanzó el máximo de ${MAX_ITERATIONS} iteraciones sin concluir.`
    );
  }

  const finalTableau = steps[steps.length - 1].tableau;
  const { values, allValues } = extractValues(finalTableau, norm.numVars);

  let z = Fraction.zero();
  for (let j = 0; j < norm.numVars; j++) {
    z = z.add(norm.objOriginal[j].mul(values[j]));
  }

  const shadowPrices = computeShadowPrices(finalTableau, norm.slackNames);
  const verification = verifyConstraints(norm.constraintsOriginal, values);

  const slacks = {};
  norm.slackNames.forEach((s) => {
    slacks[s] = allValues[s] || Fraction.zero();
  });
  const excesses = {};
  norm.excessNames.forEach((e) => {
    excesses[e] = allValues[e] || Fraction.zero();
  });

  let alternateValues = null;
  if (options.findAlternate && finalStatus === 'alternate') {
    let altCol = -1;
    for (let j = 0; j < finalTableau.zRow.length; j++) {
      if (finalTableau.basic.includes(finalTableau.colNames[j])) continue;
      if (finalTableau.zRow[j].isZero()) {
        altCol = j;
        break;
      }
    }
    if (altCol >= 0) {
      const { bestRow, ratios, tied } = findLeaving(finalTableau, altCol, false);
      if (bestRow >= 0) {
        const { tableau: altTab, ops } = pivot(finalTableau, bestRow, altCol);
        const alt = extractValues(altTab, norm.numVars);
        alternateValues = alt.values;
        steps.push({
          title: 'Solución óptima alternativa',
          tableau: altTab,
          status: 'alternate',
          pivotCol: altCol,
          pivotRow: bestRow,
          entering: finalTableau.colNames[altCol],
          leaving: finalTableau.basic[bestRow],
          pivotValue: finalTableau.matrix[bestRow][altCol].clone(),
          ratios,
          rowOps: ops,
          degeneracy: tied,
          notes: [
            'Iteración adicional sobre una no básica con coeficiente 0 en Z para obtener otra solución óptima básica.',
          ],
          meta: { alternate: true },
        });
      }
    }
  }

  return {
    status: finalStatus,
    steps,
    values,
    alternateValues,
    z,
    originalSense: norm.originalSense,
    shadowPrices,
    slacks,
    excesses,
    verification,
    artNames: norm.artNames,
    slackNames: norm.slackNames,
    excessNames: norm.excessNames,
    numVars: norm.numVars,
    colNames: norm.colNames,
    constraintsOriginal: norm.constraintsOriginal,
    objOriginal: norm.objOriginal,
  };
}
