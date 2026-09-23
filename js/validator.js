/**
 * Validador de entradas del usuario.
 */

import { Fraction, tryParseFraction } from './fractions.js';

const MAX_VARS = 10;
const MAX_CONS = 10;
const LARGE_ABS = 1_000_000n;

/**
 * @typedef {object} ValidationIssue
 * @property {'error'|'warning'} level
 * @property {string} message
 * @property {string} [field]
 */

/**
 * @param {object} raw
 * @returns {{ ok: boolean, problem: object|null, issues: ValidationIssue[] }}
 */
export function validateProblem(raw) {
  const issues = [];

  const sense = raw.sense === 'min' ? 'min' : 'max';
  let numVars = Number(raw.numVars);
  let numCons = Number(raw.numConstraints ?? raw.constraints?.length);

  if (!Number.isInteger(numVars) || numVars < 1 || numVars > MAX_VARS) {
    issues.push({
      level: 'error',
      message: `La cantidad de variables debe estar entre 1 y ${MAX_VARS}.`,
      field: 'numVars',
    });
  }

  if (!Array.isArray(raw.constraints)) {
    issues.push({
      level: 'error',
      message: 'Debe indicar al menos una restricción.',
      field: 'constraints',
    });
    return { ok: false, problem: null, issues };
  }

  numCons = raw.constraints.length;
  if (numCons < 1 || numCons > MAX_CONS) {
    issues.push({
      level: 'error',
      message: `La cantidad de restricciones debe estar entre 1 y ${MAX_CONS}.`,
      field: 'constraints',
    });
  }

  if (issues.some((i) => i.level === 'error')) {
    return { ok: false, problem: null, issues };
  }

  const objective = [];
  let objAllZero = true;

  for (let j = 0; j < numVars; j++) {
    const rawCoef = raw.objective?.[j];
    const filled = rawCoef === '' || rawCoef === null || rawCoef === undefined ? '0' : rawCoef;
    const parsed = tryParseFraction(filled);
    if (!parsed.ok) {
      issues.push({
        level: 'error',
        message: `El coeficiente de X${j + 1} en la función objetivo no es un número válido. Use enteros, decimales o fracciones como 1/3.`,
        field: `objective.${j}`,
      });
      objective.push(Fraction.zero());
    } else {
      objective.push(parsed.value);
      if (!parsed.value.isZero()) objAllZero = false;
      if (parsed.value.n > LARGE_ABS || parsed.value.n < -LARGE_ABS || parsed.value.d > LARGE_ABS) {
        issues.push({
          level: 'warning',
          message: `El coeficiente de X${j + 1} en la objetivo es muy grande; las fracciones pueden crecer rápido.`,
          field: `objective.${j}`,
        });
      }
    }
  }

  if (objAllZero) {
    issues.push({
      level: 'warning',
      message: 'Todos los coeficientes de la función objetivo son cero: el problema es trivial.',
      field: 'objective',
    });
  }

  const constraints = [];

  raw.constraints.forEach((con, i) => {
    const op = con.op;
    if (op !== '<=' && op !== '>=' && op !== '=') {
      issues.push({
        level: 'error',
        message: `La restricción ${i + 1} tiene un operador no válido.`,
        field: `constraints.${i}.op`,
      });
    }

    const coeffs = [];
    let allZero = true;
    for (let j = 0; j < numVars; j++) {
      const rawCoef = con.coeffs?.[j];
      const filled = rawCoef === '' || rawCoef === null || rawCoef === undefined ? '0' : rawCoef;
      const parsed = tryParseFraction(filled);
      if (!parsed.ok) {
        issues.push({
          level: 'error',
          message: `En la restricción ${i + 1}, el coeficiente de X${j + 1} no es válido.`,
          field: `constraints.${i}.coeffs.${j}`,
        });
        coeffs.push(Fraction.zero());
      } else {
        coeffs.push(parsed.value);
        if (!parsed.value.isZero()) allZero = false;
      }
    }

    const rhsRaw = con.rhs;
    if (rhsRaw === '' || rhsRaw === null || rhsRaw === undefined) {
      issues.push({
        level: 'error',
        message: `La restricción ${i + 1} necesita un valor en el lado derecho.`,
        field: `constraints.${i}.rhs`,
      });
      constraints.push({ coeffs, op: op || '<=', rhs: Fraction.zero() });
      return;
    }

    const rhsParsed = tryParseFraction(rhsRaw);
    if (!rhsParsed.ok) {
      issues.push({
        level: 'error',
        message: `El lado derecho de la restricción ${i + 1} no es un número válido.`,
        field: `constraints.${i}.rhs`,
      });
      constraints.push({ coeffs, op: op || '<=', rhs: Fraction.zero() });
      return;
    }

    if (allZero) {
      const rhs = rhsParsed.value;
      let feasible = true;
      if (op === '<=' && rhs.isNegative()) feasible = false;
      if (op === '>=' && rhs.isPositive()) feasible = false;
      if (op === '=' && !rhs.isZero()) feasible = false;

      if (!feasible) {
        issues.push({
          level: 'error',
          message: `La restricción ${i + 1} tiene todos los coeficientes en cero y no se puede cumplir: el problema es infactible.`,
          field: `constraints.${i}`,
        });
      } else {
        issues.push({
          level: 'warning',
          message: `La restricción ${i + 1} tiene todos los coeficientes en cero y es redundante.`,
          field: `constraints.${i}`,
        });
      }
    }

    constraints.push({ coeffs, op, rhs: rhsParsed.value });
  });

  const hasError = issues.some((i) => i.level === 'error');
  if (hasError) return { ok: false, problem: null, issues };

  return {
    ok: true,
    problem: {
      sense,
      numVars,
      objective: objective.map((f) => f.toString()),
      constraints: constraints.map((c) => ({
        coeffs: c.coeffs.map((f) => f.toString()),
        op: c.op,
        rhs: c.rhs.toString(),
      })),
    },
    issues,
  };
}

/**
 * Valida un campo individual mientras se escribe.
 * @param {string} raw
 * @param {{ allowEmptyAsZero?: boolean }} [opts]
 */
export function validateField(raw, opts = {}) {
  const s = String(raw ?? '').trim();
  if (s === '') {
    if (opts.allowEmptyAsZero) return { ok: true, value: '0', filled: true };
    return { ok: false, error: 'Complete este campo' };
  }
  const parsed = tryParseFraction(s);
  if (!parsed.ok) return { ok: false, error: 'Use un entero, decimal o fracción (ej. 1/3)' };
  return { ok: true, value: parsed.value.toString(), filled: false };
}
