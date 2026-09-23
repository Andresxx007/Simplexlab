/**
 * Gráfico de región factible (solo 2 variables) en SVG puro.
 */

import { Fraction } from './fractions.js';

const EPS = 1e-9;

function toNum(f) {
  return typeof f === 'number' ? f : f.toNumber();
}

function nearly(a, b, eps = EPS) {
  return Math.abs(a - b) <= eps;
}

/**
 * Intersección de a1 x + b1 y = c1 y a2 x + b2 y = c2
 */
function lineIntersect(a1, b1, c1, a2, b2, c2) {
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < EPS) return null;
  return {
    x: (c1 * b2 - c2 * b1) / det,
    y: (a1 * c2 - a2 * c1) / det,
  };
}

function satisfies(constraints, x, y) {
  if (x < -EPS || y < -EPS) return false;
  for (const con of constraints) {
    const a = toNum(con.coeffs[0]);
    const b = toNum(con.coeffs[1]);
    const rhs = toNum(con.rhs);
    const lhs = a * x + b * y;
    if (con.op === '<=' && lhs > rhs + 1e-6) return false;
    if (con.op === '>=' && lhs < rhs - 1e-6) return false;
    if (con.op === '=' && Math.abs(lhs - rhs) > 1e-6) return false;
  }
  return true;
}

function uniquePoints(points) {
  const out = [];
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (out.some((q) => nearly(q.x, p.x, 1e-6) && nearly(q.y, p.y, 1e-6))) continue;
    out.push(p);
  }
  return out;
}

function orderPolygon(points) {
  if (points.length < 3) return points;
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  return [...points].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}

/**
 * Calcula vértices de la región factible en R+².
 * @param {object} problem problem con sense, objective, constraints (2 vars)
 */
export function computeFeasibleRegion(problem) {
  if (problem.numVars !== 2) {
    return { ok: false, reason: 'El gráfico solo está disponible con exactamente dos variables.' };
  }

  const constraints = problem.constraints.map((c) => ({
    coeffs: c.coeffs.map((x) => Fraction.from(x)),
    op: c.op,
    rhs: Fraction.from(c.rhs),
  }));

  // Rectas: restricciones + ejes x=0, y=0
  const lines = constraints.map((c, i) => ({
    a: toNum(c.coeffs[0]),
    b: toNum(c.coeffs[1]),
    c: toNum(c.rhs),
    label: `R${i + 1}`,
    op: c.op,
  }));
  lines.push({ a: 1, b: 0, c: 0, label: 'X₁=0', op: '=' });
  lines.push({ a: 0, b: 1, c: 0, label: 'X₂=0', op: '=' });

  const candidates = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const p = lineIntersect(lines[i].a, lines[i].b, lines[i].c, lines[j].a, lines[j].b, lines[j].c);
      if (p) candidates.push(p);
    }
  }

  const vertices = uniquePoints(
    candidates.filter((p) => satisfies(constraints, p.x, p.y))
  );

  if (vertices.length === 0) {
    return { ok: false, reason: 'infeasible', vertices: [], lines };
  }

  const polygon = orderPolygon(vertices);
  const obj = problem.objective.map((c) => toNum(Fraction.from(c)));

  const scored = polygon.map((p) => ({
    ...p,
    z: obj[0] * p.x + obj[1] * p.y,
  }));

  return {
    ok: true,
    vertices: scored,
    polygon,
    lines: lines.filter((l) => l.label.startsWith('R')),
    objective: obj,
    sense: problem.sense,
  };
}

/**
 * Dibuja SVG en un contenedor.
 * @param {HTMLElement} container
 * @param {object} region resultado de computeFeasibleRegion
 * @param {object} [opts]
 */
export function renderGraph(container, region, opts = {}) {
  container.innerHTML = '';

  if (!region || !region.ok) {
    const msg = document.createElement('p');
    msg.className = 'graph-message';
    msg.textContent =
      region?.reason === 'infeasible'
        ? 'No hay región factible que dibujar.'
        : region?.reason || 'Gráfico no disponible.';
    container.appendChild(msg);
    return;
  }

  const width = opts.width || 520;
  const height = opts.height || 420;
  const pad = 48;

  const xs = region.vertices.map((v) => v.x);
  const ys = region.vertices.map((v) => v.y);
  let maxX = Math.max(1, ...xs) * 1.25;
  let maxY = Math.max(1, ...ys) * 1.25;

  // Si parece no acotada, ampliar vista
  if (opts.unbounded) {
    maxX *= 1.4;
    maxY *= 1.4;
  }

  const sx = (x) => pad + (x / maxX) * (width - 2 * pad);
  const sy = (y) => height - pad - (y / maxY) * (height - 2 * pad);

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Región factible del problema de dos variables');
  svg.classList.add('feasible-svg');

  // Fondo
  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('width', width);
  bg.setAttribute('height', height);
  bg.setAttribute('class', 'graph-bg');
  svg.appendChild(bg);

  // Grid suave
  for (let i = 0; i <= 4; i++) {
    const gx = pad + ((width - 2 * pad) * i) / 4;
    const gy = pad + ((height - 2 * pad) * i) / 4;
    const v = document.createElementNS(ns, 'line');
    v.setAttribute('x1', gx);
    v.setAttribute('x2', gx);
    v.setAttribute('y1', pad);
    v.setAttribute('y2', height - pad);
    v.setAttribute('class', 'graph-grid');
    svg.appendChild(v);
    const h = document.createElementNS(ns, 'line');
    h.setAttribute('x1', pad);
    h.setAttribute('x2', width - pad);
    h.setAttribute('y1', gy);
    h.setAttribute('y2', gy);
    h.setAttribute('class', 'graph-grid');
    svg.appendChild(h);
  }

  // Ejes
  const axisX = document.createElementNS(ns, 'line');
  axisX.setAttribute('x1', pad);
  axisX.setAttribute('y1', height - pad);
  axisX.setAttribute('x2', width - pad);
  axisX.setAttribute('y2', height - pad);
  axisX.setAttribute('class', 'graph-axis');
  svg.appendChild(axisX);

  const axisY = document.createElementNS(ns, 'line');
  axisY.setAttribute('x1', pad);
  axisY.setAttribute('y1', height - pad);
  axisY.setAttribute('x2', pad);
  axisY.setAttribute('y2', pad);
  axisY.setAttribute('class', 'graph-axis');
  svg.appendChild(axisY);

  const labelX = document.createElementNS(ns, 'text');
  labelX.textContent = 'X₁';
  labelX.setAttribute('x', width - pad + 8);
  labelX.setAttribute('y', height - pad + 4);
  labelX.setAttribute('class', 'graph-axis-label');
  svg.appendChild(labelX);

  const labelY = document.createElementNS(ns, 'text');
  labelY.textContent = 'X₂';
  labelY.setAttribute('x', pad - 8);
  labelY.setAttribute('y', pad - 8);
  labelY.setAttribute('class', 'graph-axis-label');
  svg.appendChild(labelY);

  // Restricciones como segmentos visibles
  region.lines.forEach((line) => {
    const pts = [];
    // Intersecciones con borde del viewport [0,maxX] x [0,maxY]
    const borders = [
      { a: 1, b: 0, c: 0 },
      { a: 0, b: 1, c: 0 },
      { a: 1, b: 0, c: maxX },
      { a: 0, b: 1, c: maxY },
    ];
    borders.forEach((b) => {
      const p = lineIntersect(line.a, line.b, line.c, b.a, b.b, b.c);
      if (
        p &&
        p.x >= -EPS &&
        p.y >= -EPS &&
        p.x <= maxX + EPS &&
        p.y <= maxY + EPS
      ) {
        pts.push(p);
      }
    });
    const uniq = uniquePoints(pts);
    if (uniq.length >= 2) {
      const seg = document.createElementNS(ns, 'line');
      seg.setAttribute('x1', sx(uniq[0].x));
      seg.setAttribute('y1', sy(uniq[0].y));
      seg.setAttribute('x2', sx(uniq[1].x));
      seg.setAttribute('y2', sy(uniq[1].y));
      seg.setAttribute('class', 'graph-constraint');
      svg.appendChild(seg);

      const midX = (uniq[0].x + uniq[1].x) / 2;
      const midY = (uniq[0].y + uniq[1].y) / 2;
      const t = document.createElementNS(ns, 'text');
      t.textContent = line.label;
      t.setAttribute('x', sx(midX) + 4);
      t.setAttribute('y', sy(midY) - 4);
      t.setAttribute('class', 'graph-constraint-label');
      svg.appendChild(t);
    }
  });

  // Polígono factible
  if (region.polygon.length >= 2) {
    const poly = document.createElementNS(ns, 'polygon');
    poly.setAttribute(
      'points',
      region.polygon.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')
    );
    poly.setAttribute('class', 'graph-feasible');
    svg.appendChild(poly);
  }

  // Recta de Z óptima
  const opt = opts.optimalPoint;
  if (opt && region.objective) {
    const z = region.objective[0] * opt.x + region.objective[1] * opt.y;
    const [c1, c2] = region.objective;
    // c1 x + c2 y = z
    const zPts = [];
    const borders = [
      { a: 1, b: 0, c: 0 },
      { a: 0, b: 1, c: 0 },
      { a: 1, b: 0, c: maxX },
      { a: 0, b: 1, c: maxY },
    ];
    borders.forEach((b) => {
      const p = lineIntersect(c1, c2, z, b.a, b.b, b.c);
      if (p && p.x >= -EPS && p.y >= -EPS && p.x <= maxX + EPS && p.y <= maxY + EPS) {
        zPts.push(p);
      }
    });
    const zu = uniquePoints(zPts);
    if (zu.length >= 2) {
      const zl = document.createElementNS(ns, 'line');
      zl.setAttribute('x1', sx(zu[0].x));
      zl.setAttribute('y1', sy(zu[0].y));
      zl.setAttribute('x2', sx(zu[1].x));
      zl.setAttribute('y2', sy(zu[1].y));
      zl.setAttribute('class', 'graph-z-line');
      svg.appendChild(zl);
    }
  }

  // Camino Simplex (vértices ya visitados + tramo actual)
  const path = opts.path || [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', sx(a.x));
    line.setAttribute('y1', sy(a.y));
    line.setAttribute('x2', sx(b.x));
    line.setAttribute('y2', sy(b.y));
    line.setAttribute('class', 'graph-path');
    line.setAttribute('marker-end', 'url(#arrow)');
    svg.appendChild(line);
  }

  // Marker
  const defs = document.createElementNS(ns, 'defs');
  defs.innerHTML = `
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" class="graph-arrow" />
    </marker>`;
  svg.insertBefore(defs, svg.firstChild);

  // Vértices visitados del camino (antes del polígono labels)
  path.forEach((p, i) => {
    const visited = document.createElementNS(ns, 'circle');
    visited.setAttribute('cx', sx(p.x));
    visited.setAttribute('cy', sy(p.y));
    visited.setAttribute('r', i === path.length - 1 ? 7 : 5);
    visited.setAttribute(
      'class',
      i === path.length - 1 ? 'graph-path-node is-current' : 'graph-path-node'
    );
    svg.appendChild(visited);
  });

  // Vértices
  const cv = opts.currentVertex || (path.length ? path[path.length - 1] : null);
  region.vertices.forEach((v, i) => {
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('class', 'graph-vertex');
    if (opts.highlightIndex === i) g.classList.add('is-current');
    if (cv && nearly(v.x, cv.x, 1e-4) && nearly(v.y, cv.y, 1e-4)) {
      g.classList.add('is-current');
    }
    if (
      opt &&
      nearly(v.x, opt.x, 1e-4) &&
      nearly(v.y, opt.y, 1e-4)
    ) {
      g.classList.add('is-optimal');
    }

    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', sx(v.x));
    circle.setAttribute('cy', sy(v.y));
    circle.setAttribute('r', 6);
    g.appendChild(circle);

    const title = document.createElementNS(ns, 'title');
    title.textContent = `(${fmtNum(v.x)}, ${fmtNum(v.y)})  Z=${fmtNum(v.z)}`;
    g.appendChild(title);

    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', sx(v.x) + 8);
    text.setAttribute('y', sy(v.y) - 8);
    text.setAttribute('class', 'graph-vertex-label');
    text.textContent = `(${fmtNum(v.x)}, ${fmtNum(v.y)})`;
    g.appendChild(text);

    svg.appendChild(g);
  });

  if (opts.unbounded) {
    const note = document.createElementNS(ns, 'text');
    note.setAttribute('x', width / 2);
    note.setAttribute('y', 24);
    note.setAttribute('text-anchor', 'middle');
    note.setAttribute('class', 'graph-unbounded-note');
    note.textContent = 'Región no acotada (vista parcial)';
    svg.appendChild(note);
  }

  container.appendChild(svg);
}

function fmtNum(n) {
  if (Number.isInteger(n)) return String(n);
  const s = n.toFixed(3).replace(/\.?0+$/, '');
  return s;
}

/**
 * Extrae camino de vértices desde pasos del Simplex (valores de X1,X2 básicos).
 */
export function extractSimplexPath(result) {
  if (result.numVars !== 2) return [];
  const path = [];
  result.steps.forEach((step) => {
    const vals = [0, 0];
    const t = step.tableau;
    for (let i = 0; i < t.basic.length; i++) {
      const name = t.basic[i];
      const idx = t.colNames.indexOf(name);
      if (idx === 0 || idx === 1) {
        vals[idx] = t.rhs[i].c.toNumber();
      }
    }
    // Skip if artificials in basis with value
    const hasArt = t.basic.some((b) => b.startsWith('A'));
    if (hasArt) {
      // Still record if arts are zero
      let artPos = false;
      for (let i = 0; i < t.basic.length; i++) {
        if (t.basic[i].startsWith('A') && !t.rhs[i].isZero()) artPos = true;
      }
      if (artPos) return;
    }
    const last = path[path.length - 1];
    if (!last || !nearly(last.x, vals[0]) || !nearly(last.y, vals[1])) {
      path.push({ x: vals[0], y: vals[1] });
    }
  });
  return path;
}
