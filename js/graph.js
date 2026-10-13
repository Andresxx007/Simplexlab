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

  if (!region || (!region.ok && !region.lines?.length)) {
    const msg = document.createElement('p');
    msg.className = 'graph-message';
    msg.textContent =
      region?.reason === 'infeasible'
        ? 'No hay región factible que dibujar.'
        : region?.reason || 'Gráfico no disponible.';
    container.appendChild(msg);
    return;
  }

  const width = opts.width || 560;
  const height = opts.height || 440;

  const xs = [];
  const ys = [];
  const framed = (region.vertices && region.vertices.length)
    ? [...region.vertices, ...(opts.unbounded ? (region.polygon || []) : [])]
    : [...(region.polygon || [])];
  framed.forEach((v) => { xs.push(v.x); ys.push(v.y); });
  if (!xs.length) {
    (region.lines || []).forEach((line) => {
      if (Math.abs(line.b) > 1e-9) {
        const y = line.c / line.b;
        if (y > 0 && y < 1e6) ys.push(y);
      }
      if (Math.abs(line.a) > 1e-9) {
        const x = line.c / line.a;
        if (x > 0 && x < 1e6) xs.push(x);
      }
    });
  }
  const grow = opts.unbounded ? 1.05 : 1.18;
  let maxX = Math.max(1, ...xs, 0) * grow;
  let maxY = Math.max(1, ...ys, 0) * grow;

  // Si parece no acotada, ampliar vista
  if (opts.unbounded) {
    maxX *= 1.4;
    maxY *= 1.4;
  }

  const stepX = axisStep(maxX);
  const stepY = axisStep(maxY);
  const xTicks = axisTicks(maxX, stepX);
  const yTicks = axisTicks(maxY, stepY);
  maxX = Math.max(maxX, xTicks[xTicks.length - 1] || stepX);
  maxY = Math.max(maxY, yTicks[yTicks.length - 1] || stepY);

  const padL = 56;
  const padR = 22;
  const padT = 28;
  const padB = 40;
  const sx = (x) => padL + (x / maxX) * (width - padL - padR);
  const sy = (y) => height - padB - (y / maxY) * (height - padT - padB);

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

  const originX = sx(0);
  const originY = sy(0);

  xTicks.forEach((val) => {
    const x = sx(val);
    if (val !== 0) {
      const grid = document.createElementNS(ns, 'line');
      grid.setAttribute('x1', x);
      grid.setAttribute('x2', x);
      grid.setAttribute('y1', sy(maxY));
      grid.setAttribute('y2', originY);
      grid.setAttribute('class', 'graph-grid');
      svg.appendChild(grid);
    }
    const tick = document.createElementNS(ns, 'line');
    tick.setAttribute('x1', x);
    tick.setAttribute('x2', x);
    tick.setAttribute('y1', originY);
    tick.setAttribute('y2', originY + 5);
    tick.setAttribute('class', 'graph-tick');
    svg.appendChild(tick);
    const num = document.createElementNS(ns, 'text');
    num.textContent = tickText(val);
    num.setAttribute('x', x);
    num.setAttribute('y', originY + 18);
    num.setAttribute('text-anchor', 'middle');
    num.setAttribute('class', 'graph-tick-label');
    svg.appendChild(num);
  });

  yTicks.forEach((val) => {
    if (val === 0) return;
    const y = sy(val);
    const grid = document.createElementNS(ns, 'line');
    grid.setAttribute('x1', originX);
    grid.setAttribute('x2', sx(maxX));
    grid.setAttribute('y1', y);
    grid.setAttribute('y2', y);
    grid.setAttribute('class', 'graph-grid');
    svg.appendChild(grid);
    const tick = document.createElementNS(ns, 'line');
    tick.setAttribute('x1', originX - 5);
    tick.setAttribute('x2', originX);
    tick.setAttribute('y1', y);
    tick.setAttribute('y2', y);
    tick.setAttribute('class', 'graph-tick');
    svg.appendChild(tick);
    const num = document.createElementNS(ns, 'text');
    num.textContent = tickText(val);
    num.setAttribute('x', originX - 8);
    num.setAttribute('y', y + 4);
    num.setAttribute('text-anchor', 'end');
    num.setAttribute('class', 'graph-tick-label');
    svg.appendChild(num);
  });

  // Ejes
  const axisX = document.createElementNS(ns, 'line');
  axisX.setAttribute('x1', originX);
  axisX.setAttribute('y1', originY);
  axisX.setAttribute('x2', sx(maxX));
  axisX.setAttribute('y2', originY);
  axisX.setAttribute('class', 'graph-axis');
  svg.appendChild(axisX);

  const axisY = document.createElementNS(ns, 'line');
  axisY.setAttribute('x1', originX);
  axisY.setAttribute('y1', originY);
  axisY.setAttribute('x2', originX);
  axisY.setAttribute('y2', sy(maxY));
  axisY.setAttribute('class', 'graph-axis');
  svg.appendChild(axisY);

  const labelX = document.createElementNS(ns, 'text');
  labelX.textContent = 'X₁';
  labelX.setAttribute('x', sx(maxX) - 2);
  labelX.setAttribute('y', originY - 8);
  labelX.setAttribute('text-anchor', 'end');
  labelX.setAttribute('class', 'graph-axis-label');
  svg.appendChild(labelX);

  const labelY = document.createElementNS(ns, 'text');
  labelY.textContent = 'X₂';
  labelY.setAttribute('x', originX + 8);
  labelY.setAttribute('y', sy(maxY) + 12);
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
      let a = uniq[0];
      let b = uniq[1];
      let best = -1;
      for (let i = 0; i < uniq.length; i++) {
        for (let j = i + 1; j < uniq.length; j++) {
          const d = (uniq[i].x - uniq[j].x) ** 2 + (uniq[i].y - uniq[j].y) ** 2;
          if (d > best) {
            best = d;
            a = uniq[i];
            b = uniq[j];
          }
        }
      }
      const seg = document.createElementNS(ns, 'line');
      seg.setAttribute('x1', sx(a.x));
      seg.setAttribute('y1', sy(a.y));
      seg.setAttribute('x2', sx(b.x));
      seg.setAttribute('y2', sy(b.y));
      seg.setAttribute('class', 'graph-constraint');
      svg.appendChild(seg);

      const midX = (sx(a.x) + sx(b.x)) / 2;
      const midY = (sy(a.y) + sy(b.y)) / 2;
      const vx = sx(b.x) - sx(a.x);
      const vy = sy(b.y) - sy(a.y);
      const vlen = Math.hypot(vx, vy) || 1;
      let nx = -vy / vlen;
      let ny = vx / vlen;
      let nearest = null;
      let nearestD = Infinity;
      (region.vertices || []).forEach((v) => {
        const d = Math.hypot(sx(v.x) - midX, sy(v.y) - midY);
        if (d < nearestD) {
          nearestD = d;
          nearest = v;
        }
      });
      if (nearest && nearestD < 90) {
        const toward = (sx(nearest.x) - midX) * nx + (sy(nearest.y) - midY) * ny;
        if (toward > 0) {
          nx = -nx;
          ny = -ny;
        }
      }
      const t = document.createElementNS(ns, 'text');
      t.textContent = line.label;
      t.setAttribute('x', midX + nx * 16);
      t.setAttribute('y', midY + ny * 16);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('class', 'graph-constraint-label');
      svg.appendChild(t);
    }
  });

  // Polígono factible
  if (region.ok && region.polygon?.length >= 2) {
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
  const optimalPoints = opts.optimalPoints || (opt ? [opt] : []);
  if (opt && region.objective && region.ok) {
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
  (region.vertices || []).forEach((v, i) => {
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('class', 'graph-vertex');
    if (opts.highlightIndex === i) g.classList.add('is-current');
    if (cv && nearly(v.x, cv.x, 1e-4) && nearly(v.y, cv.y, 1e-4)) {
      g.classList.add('is-current');
    }
    if (optimalPoints.some((p) => nearly(v.x, p.x, 1e-4) && nearly(v.y, p.y, 1e-4))) {
      g.classList.add('is-optimal');
    }

    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', sx(v.x));
    circle.setAttribute('cy', sy(v.y));
    circle.setAttribute('r', 7);
    g.appendChild(circle);

    const coord = v.coord || `(${fmtNum(v.x)}, ${fmtNum(v.y)})`;
    const title = document.createElementNS(ns, 'title');
    title.textContent = `${v.tag ? `${v.tag} ` : ''}${coord}  Z=${fmtNum(v.z)}`;
    g.appendChild(title);

    const place = labelPlace(v.x / maxX, v.y / maxY);
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', sx(v.x) + place.dx);
    text.setAttribute('y', sy(v.y) + place.dy);
    text.setAttribute('text-anchor', place.anchor);
    text.setAttribute('class', 'graph-vertex-label');
    text.textContent = v.tag ? `${v.tag}  ${coord}` : coord;
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

function axisStep(span) {
  if (!(span > 0) || !Number.isFinite(span)) return 1;
  const raw = span / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const base = n <= 1.5 ? 1 : n <= 3 ? 2 : n <= 7 ? 5 : 10;
  return base * pow;
}

function axisTicks(max, step) {
  let s = step;
  while (max / s > 8) s *= 2;
  const out = [];
  for (let v = 0; v <= max + s * 1e-9 && out.length < 10; v += s) {
    out.push(Math.abs(v) < 1e-9 ? 0 : Math.round(v * 1000) / 1000);
  }
  if (out[out.length - 1] < max * 0.72 && out.length < 10) out.push(Math.round(max * 1000) / 1000);
  return out.length ? out : [0];
}

function tickText(n) {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 10) / 10);
}

function labelPlace(nx, ny) {
  if (nx < 0.16 && ny < 0.2) return { dx: 14, dy: -14, anchor: 'start' };
  if (nx < 0.16) return { dx: 14, dy: -8, anchor: 'start' };
  if (ny < 0.16) return { dx: 0, dy: -16, anchor: 'middle' };
  if (nx > 0.78) return { dx: -14, dy: -10, anchor: 'end' };
  return { dx: 14, dy: -10, anchor: 'start' };
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
