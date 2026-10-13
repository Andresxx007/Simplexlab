/**
 * Método gráfico en dos variables, con vértices por reducción.
 * Aritmética exacta (Fraction). No toca el DOM.
 */

import { Fraction } from './fractions.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a || 1n;
}

function F(value) {
  return Fraction.from(value);
}

function lin(a, b, c, op) {
  return { a: F(a), b: F(b), c: F(c), op };
}

function scaleEq(eq, factor) {
  return { a: eq.a.mul(factor), b: eq.b.mul(factor), c: eq.c.mul(factor), label: eq.label, op: eq.op };
}

function satisfiesOne(con, x, y) {
  const lhs = con.a.mul(x).add(con.b.mul(y));
  if (con.op === '<=') return lhs.lte(con.c);
  if (con.op === '>=') return lhs.gte(con.c);
  return lhs.equals(con.c);
}

function pointChecks(x, y, constraints) {
  const rows = [
    { label: 'x₁ ≥ 0', ok: !x.isNegative(), lhs: x, op: '>=', rhs: Fraction.zero() },
    { label: 'x₂ ≥ 0', ok: !y.isNegative(), lhs: y, op: '>=', rhs: Fraction.zero() },
  ];
  constraints.forEach((con) => {
    const lhs = con.a.mul(x).add(con.b.mul(y));
    rows.push({
      label: con.label,
      ok: satisfiesOne(con, x, y),
      lhs,
      op: con.op,
      rhs: con.c,
    });
  });
  return { rows, feasible: rows.every((row) => row.ok) };
}

function samePoint(p, q) {
  return p.x.equals(q.x) && p.y.equals(q.y);
}

function eliminate(r1, r2, axis) {
  const coef = (eq) => (axis === 1 ? eq.b : eq.a);
  let m1 = coef(r2).abs();
  let m2 = coef(r1).abs();
  if (m1.d === 1n && m2.d === 1n) {
    const g = gcd(m1.n, m2.n);
    m1 = new Fraction(m1.n / g);
    m2 = new Fraction(m2.n / g);
  }
  const s1 = scaleEq(r1, m1);
  const s2 = scaleEq(r2, m2);
  const c1 = coef(s1);
  const c2 = coef(s2);
  const combine = c1.isNegative() === c2.isNegative() ? 'sub' : 'add';
  const mix = (u, v) => (combine === 'add' ? u.add(v) : u.sub(v));
  const comb = { a: mix(s1.a, s2.a), b: mix(s1.b, s2.b), c: mix(s1.c, s2.c) };
  const left = axis === 1 ? comb.a : comb.b;
  if (left.isZero()) {
    return { kind: 'parallel', labels: [r1.label, r2.label], eqs: [r1, r2] };
  }
  const firstValue = comb.c.div(left);
  const firstIndex = axis === 1 ? 0 : 1;
  const host = [r1, r2].find((eq) => !(firstIndex === 0 ? eq.b : eq.a).isZero()) || r1;
  let x;
  let y;
  let moved;
  if (firstIndex === 0) {
    x = firstValue;
    moved = host.c.sub(host.a.mul(x));
    y = moved.div(host.b);
  } else {
    y = firstValue;
    moved = host.c.sub(host.b.mul(y));
    x = moved.div(host.a);
  }
  return {
    kind: 'reduce',
    labels: [r1.label, r2.label],
    eqs: [r1, r2],
    eliminate: axis,
    factors: [m1, m2],
    scaled: [s1, s2],
    combine,
    reduced: comb,
    firstIndex,
    firstValue,
    host,
    moved,
    point: { x, y },
  };
}

function reducePair(r1, r2) {
  const det = r1.a.mul(r2.b).sub(r2.a.mul(r1.b));
  if (det.isZero()) {
    return { kind: 'parallel', labels: [r1.label, r2.label], eqs: [r1, r2] };
  }
  if (!r1.b.isZero() && !r2.b.isZero()) return eliminate(r1, r2, 1);
  if (!r1.a.isZero() && !r2.a.isZero()) return eliminate(r1, r2, 0);

  const vertical = [r1, r2].find((eq) => eq.b.isZero());
  const horizontal = [r1, r2].find((eq) => eq.a.isZero());
  const x = vertical.c.div(vertical.a);
  const y = horizontal.c.div(horizontal.b);
  return {
    kind: 'direct',
    labels: [r1.label, r2.label],
    eqs: [r1, r2],
    vertical,
    horizontal,
    point: { x, y },
  };
}

function isRecession(dx, dy, constraints) {
  if (dx.isNegative() || dy.isNegative()) return false;
  if (dx.isZero() && dy.isZero()) return false;
  return constraints.every((con) => {
    const dot = con.a.mul(dx).add(con.b.mul(dy));
    if (con.op === '<=') return !dot.isPositive();
    if (con.op === '>=') return !dot.isNegative();
    return dot.isZero();
  });
}

function canonicalDir(dx, dy) {
  const n1 = dx.n * dy.d;
  const n2 = dy.n * dx.d;
  const g = gcd(n1, n2);
  return [new Fraction(n1 / g), new Fraction(n2 / g)];
}

function sameDir(a, b) {
  return a[0].equals(b[0]) && a[1].equals(b[1]);
}

function recessionDirections(constraints) {
  const raw = [
    [Fraction.one(), Fraction.zero()],
    [Fraction.zero(), Fraction.one()],
  ];
  constraints.forEach((con) => {
    raw.push([con.b.neg(), con.a]);
    raw.push([con.b, con.a.neg()]);
  });
  const out = [];
  raw.forEach(([dx, dy]) => {
    if (!isRecession(dx, dy, constraints)) return;
    const dir = canonicalDir(dx, dy);
    if (out.some((have) => sameDir(have, dir))) return;
    out.push(dir);
  });
  return out;
}

function orderVertices(points) {
  if (points.length < 2) return points;
  const n = new Fraction(points.length);
  const cx = points.reduce((sum, p) => sum.add(p.x), Fraction.zero()).div(n);
  const cy = points.reduce((sum, p) => sum.add(p.y), Fraction.zero()).div(n);
  const ordered = [...points].sort((a, b) => {
    const aa = Math.atan2(a.y.sub(cy).toNumber(), a.x.sub(cx).toNumber());
    const bb = Math.atan2(b.y.sub(cy).toNumber(), b.x.sub(cx).toNumber());
    return aa - bb;
  });
  let start = 0;
  ordered.forEach((p, i) => {
    const score = p.x.add(p.y);
    const best = ordered[start].x.add(ordered[start].y);
    if (score.lt(best) || (score.equals(best) && p.x.lt(ordered[start].x))) start = i;
  });
  return ordered.slice(start).concat(ordered.slice(0, start));
}

/**
 * @param {{ sense: 'max'|'min', objective: any[], constraints: {coeffs: any[], op: string, rhs: any}[] }} problem
 */
export function solveGraphic(problem) {
  const sense = problem.sense === 'min' ? 'min' : 'max';
  const objective = [F(problem.objective[0] || 0), F(problem.objective[1] || 0)];
  const constraints = problem.constraints.map((con, i) => lin(
    con.coeffs[0] || 0,
    con.coeffs[1] || 0,
    con.rhs,
    con.op,
  )).map((eq, i) => ({ ...eq, label: `R${i + 1}` }));

  const intercepts = constraints.map((con) => ({
    label: con.label,
    a: con.a,
    b: con.b,
    c: con.c,
    op: con.op,
    xCut: con.a.isZero() ? null : con.c.div(con.a),
    yCut: con.b.isZero() ? null : con.c.div(con.b),
  }));

  const originTests = constraints.map((con) => {
    const ok = satisfiesOne(con, Fraction.zero(), Fraction.zero());
    return { label: con.label, op: con.op, rhs: con.c, ok };
  });

  const bag = [];
  const addPoint = (x, y, source) => {
    const found = bag.find((p) => p.x.equals(x) && p.y.equals(y));
    if (found) found.sources.push(source);
    else bag.push({ x, y, sources: [source] });
  };

  addPoint(Fraction.zero(), Fraction.zero(), 'Origen');
  intercepts.forEach((cut) => {
    if (cut.yCut && !cut.yCut.isNegative()) addPoint(Fraction.zero(), cut.yCut, `${cut.label} con x₁ = 0`);
    if (cut.xCut && !cut.xCut.isNegative()) addPoint(cut.xCut, Fraction.zero(), `${cut.label} con x₂ = 0`);
  });

  const reductions = [];
  for (let i = 0; i < constraints.length; i++) {
    for (let j = i + 1; j < constraints.length; j++) {
      const solved = reducePair(constraints[i], constraints[j]);
      if (solved.point) {
        const check = pointChecks(solved.point.x, solved.point.y, constraints);
        solved.feasible = check.feasible;
        solved.checks = check.rows;
        if (check.feasible) {
          addPoint(solved.point.x, solved.point.y, `Reducción de ${solved.labels[0]} y ${solved.labels[1]}`);
        }
      }
      reductions.push(solved);
    }
  }

  const candidates = bag.map((p) => {
    const check = pointChecks(p.x, p.y, constraints);
    return { ...p, ...check };
  });

  const feasible = orderVertices(candidates.filter((p) => p.feasible));
  const vertices = feasible.map((p, i) => ({
    ...p,
    letter: LETTERS[i] || `P${i + 1}`,
    z: objective[0].mul(p.x).add(objective[1].mul(p.y)),
  }));

  const rays = recessionDirections(constraints).map(([dx, dy]) => {
    const slope = objective[0].mul(dx).add(objective[1].mul(dy));
    return { dx, dy, slope };
  });
  const improving = rays.some((ray) => (sense === 'max' ? ray.slope.isPositive() : ray.slope.isNegative()));
  const neutral = rays.some((ray) => ray.slope.isZero());
  const regionUnbounded = rays.length > 0;

  let status = 'optimal';
  let best = [];
  let bestZ = null;
  if (!vertices.length) {
    status = 'infeasible';
  } else if (improving) {
    status = 'unbounded';
    bestZ = vertices.reduce((acc, v) => {
      if (!acc) return v.z;
      return sense === 'max' ? (v.z.gt(acc) ? v.z : acc) : (v.z.lt(acc) ? v.z : acc);
    }, null);
    best = vertices.filter((v) => v.z.equals(bestZ));
  } else {
    bestZ = vertices.reduce((acc, v) => {
      if (!acc) return v.z;
      return sense === 'max' ? (v.z.gt(acc) ? v.z : acc) : (v.z.lt(acc) ? v.z : acc);
    }, null);
    best = vertices.filter((v) => v.z.equals(bestZ));
    status = best.length > 1 || neutral ? 'alternate' : 'optimal';
  }

  const chosen = best[0] || null;
  const active = [];
  const inactive = [];
  if (chosen) {
    constraints.forEach((con) => {
      const lhs = con.a.mul(chosen.x).add(con.b.mul(chosen.y));
      if (lhs.equals(con.c)) active.push(con.label);
      else inactive.push(con.label);
    });
  }

  let parallelTo = null;
  if (status === 'alternate') {
    const hit = constraints.find((con) => objective[0].mul(con.b).sub(objective[1].mul(con.a)).isZero());
    parallelTo = hit ? hit.label : null;
  }

  return {
    sense,
    objective,
    constraints,
    intercepts,
    originTests,
    reductions,
    candidates,
    vertices,
    rays,
    improving,
    neutral,
    regionUnbounded,
    status,
    best,
    bestZ,
    active,
    inactive,
    parallelTo,
  };
}
