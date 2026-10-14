/**
 * Pantalla del método gráfico: formulario de 2 variables, procedimiento y gráfica.
 */

import { Fraction } from './fractions.js';
import { validateProblem } from './validator.js';
import { solveGraphic } from './graphic.js';
import { renderGraph } from './graph.js';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  });
  children.forEach((child) => { if (child != null) node.append(child); });
  return node;
}

function opSymbol(op) {
  if (op === '<=') return '≤';
  if (op === '>=') return '≥';
  return '=';
}

function lin(fmt, a, b) {
  const bits = [];
  const push = (coef, name) => {
    if (coef.isZero()) return;
    const neg = coef.isNegative();
    const abs = coef.abs();
    const body = abs.equals(Fraction.one()) ? name : `${fmt(abs)}${name}`;
    if (!bits.length) bits.push(neg ? `−${body}` : body);
    else bits.push(neg ? `− ${body}` : `+ ${body}`);
  };
  push(a, 'x₁');
  push(b, 'x₂');
  return bits.join(' ') || '0';
}

function eqText(fmt, a, b, c) {
  return `${lin(fmt, a, b)} = ${fmt(c)}`;
}

function point(fmt, x, y) {
  return `(${fmt(x)}, ${fmt(y)})`;
}

function convexHull(points) {
  const pts = points
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const build = (source) => {
    const out = [];
    source.forEach((p) => {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    });
    return out;
  };
  const lower = build(pts);
  const upper = build(pts.slice().reverse());
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

export function mountGraphic({ getMode, setMode }) {
  const api = {
    result: null,
    rerender() {
      if (this.result) paint(this.result);
    },
  };

  let numCons = 2;
  let sense = 'max';

  const fmt = (value) => {
    if (!value || typeof value.toString !== 'function') return String(value ?? '0');
    const mode = getMode();
    let text;
    if (mode === 'decimal2') text = value.toString('decimal', 2);
    else if (mode === 'decimal3') text = value.toString('decimal', 3);
    else text = value.toString('fraction');
    return text.replace(/-/g, '−');
  };

  function showMessages(issues, okMsg) {
    const box = document.getElementById('g-messages');
    box.innerHTML = '';
    if (okMsg) box.append(el('div', { className: 'msg msg-ok', text: okMsg }));
    issues.forEach((issue) => {
      box.append(el('div', {
        className: `msg msg-${issue.level === 'error' ? 'error' : 'warning'}`,
        text: issue.message,
      }));
    });
  }

  function collectRaw() {
    const objective = [0, 1].map((j) => document.getElementById(`g-obj-${j}`)?.value.trim() ?? '');
    const constraints = [];
    for (let i = 0; i < numCons; i++) {
      constraints.push({
        coeffs: [0, 1].map((j) => document.getElementById(`g-con-${i}-${j}`)?.value.trim() ?? ''),
        op: document.getElementById(`g-op-${i}`)?.value || '<=',
        rhs: document.getElementById(`g-rhs-${i}`)?.value.trim() || '',
      });
    }
    return { sense, numVars: 2, objective, constraints };
  }

  function updatePreview() {
    const raw = collectRaw();
    const term = (coeffs) => coeffs
      .map((c, j) => `${c === '' ? '0' : c}x${j === 0 ? '₁' : '₂'}`)
      .join(' + ')
      .replace(/\+ -/g, '− ');
    let text = `${raw.sense === 'min' ? 'Minimizar' : 'Maximizar'}\nZ = ${term(raw.objective)}\n\nsujeto a\n`;
    raw.constraints.forEach((con) => {
      text += `${term(con.coeffs)} ${opSymbol(con.op)} ${con.rhs || '?'}\n`;
    });
    text += 'x₁, x₂ ≥ 0';
    document.getElementById('g-preview').textContent = text;
  }

  function buildForm(prev) {
    const root = document.getElementById('g-problem-form');
    root.innerHTML = '';
    const objRow = el('div', { className: 'obj-row' });
    objRow.append(el('div', { className: 'row-badge', text: sense === 'min' ? 'Minimizar Z =' : 'Maximizar Z =' }));
    ['x₁', 'x₂'].forEach((name, j) => {
      const field = el('label', { className: 'coef-field' });
      field.append(el('span', { className: 'coef-label', text: name }));
      const inp = el('input', {
        id: `g-obj-${j}`,
        type: 'text',
        inputmode: 'decimal',
        autocomplete: 'off',
        className: 'coef-input',
        'aria-label': `Coeficiente de ${name} en Z`,
      });
      inp.value = prev?.objective[j] ?? '';
      inp.addEventListener('input', updatePreview);
      field.append(inp);
      objRow.append(field);
    });
    root.append(objRow);

    for (let i = 0; i < numCons; i++) {
      const row = el('div', { className: 'con-row' });
      row.append(el('div', { className: 'row-index', text: `R${i + 1}` }));
      ['x₁', 'x₂'].forEach((name, j) => {
        const field = el('label', { className: 'coef-field' });
        field.append(el('span', { className: 'coef-label', text: name }));
        const inp = el('input', {
          id: `g-con-${i}-${j}`,
          type: 'text',
          inputmode: 'decimal',
          autocomplete: 'off',
          className: 'coef-input',
          'aria-label': `R${i + 1} coeficiente de ${name}`,
        });
        inp.value = prev?.constraints[i]?.coeffs[j] ?? '';
        inp.addEventListener('input', updatePreview);
        field.append(inp);
        row.append(field);
      });
      const op = el('select', { id: `g-op-${i}`, className: 'op-select', 'aria-label': `Operador R${i + 1}` });
      [['<=', '≤'], ['>=', '≥'], ['=', '=']].forEach(([value, label]) => op.append(el('option', { value, text: label })));
      op.value = prev?.constraints[i]?.op || '<=';
      op.addEventListener('change', updatePreview);
      row.append(op);
      const rhsField = el('label', { className: 'rhs-field' });
      rhsField.append(el('span', { className: 'rhs-label', text: 'L.D.' }));
      const rhs = el('input', {
        id: `g-rhs-${i}`,
        type: 'text',
        inputmode: 'decimal',
        autocomplete: 'off',
        className: 'coef-input',
        'aria-label': `Lado derecho R${i + 1}`,
      });
      rhs.value = prev?.constraints[i]?.rhs ?? '';
      rhs.addEventListener('input', updatePreview);
      rhsField.append(rhs);
      row.append(rhsField);
      root.append(row);
    }
    updatePreview();
  }

  function syncCons() {
    document.getElementById('g-cons-display').textContent = String(numCons);
  }

  function beat(n, kicker, title, text) {
    const card = el('div', { className: 'beat-card' });
    const head = el('div', { className: 'beat-head' });
    head.append(el('span', { className: 'beat-index', text: String(n), 'aria-hidden': 'true' }));
    const titles = el('div', { className: 'beat-head-text' });
    titles.append(el('p', { className: 'beat-kicker', text: kicker }));
    titles.append(el('p', { className: 'beat-title', text: title }));
    head.append(titles);
    card.append(head);
    if (text) card.append(el('p', { className: 'beat-text', text }));
    const row = el('section', { className: 'beat' });
    row.append(card);
    return { row, card };
  }

  function failLine(row) {
    return `${row.label}: ${fmt(row.lhs)} no cumple ${opSymbol(row.op)} ${fmt(row.rhs)}.`;
  }

  function reduceStep(n, title, nodes) {
    const row = el('div', { className: 'reduce-step' });
    row.append(el('span', { className: 'reduce-num', text: String(n), 'aria-hidden': 'true' }));
    const body = el('div', { className: 'reduce-step-body' });
    body.append(el('p', { className: 'reduce-step-title', text: title }));
    nodes.forEach((node) => body.append(node));
    row.append(body);
    return row;
  }

  function note(text) {
    return el('p', { className: 'beat-text', text });
  }

  function alg(text, kind) {
    return el('p', { className: kind ? `alg is-${kind}` : 'alg', text });
  }

  function joinTerms(parts) {
    const kept = parts.filter(Boolean);
    if (!kept.length) return '0';
    return kept.map((part, i) => {
      if (i === 0) return part.neg ? `−${part.body}` : part.body;
      return part.neg ? ` − ${part.body}` : ` + ${part.body}`;
    }).join('');
  }

  function plainTerm(coef, name) {
    if (!coef || coef.isZero()) return null;
    const abs = coef.abs();
    return {
      neg: coef.isNegative(),
      body: abs.equals(Fraction.one()) ? name : `${fmt(abs)}${name}`,
    };
  }

  function pluggedTerm(coef, name, known, value) {
    if (!coef || coef.isZero()) return null;
    const abs = coef.abs();
    return {
      neg: coef.isNegative(),
      body: known
        ? (abs.equals(Fraction.one()) ? fmt(value) : `${fmt(abs)}(${fmt(value)})`)
        : (abs.equals(Fraction.one()) ? name : `${fmt(abs)}${name}`),
    };
  }

  function replacedTerm(coef, name, known, value) {
    if (!coef || coef.isZero()) return null;
    if (known) {
      const product = coef.mul(value);
      if (product.isZero()) return null;
      return { neg: product.isNegative(), body: fmt(product.abs()) };
    }
    return plainTerm(coef, name);
  }

  function zTerm(coef, value) {
    if (!coef || coef.isZero()) return '0';
    if (coef.abs().equals(Fraction.one())) return fmt(value);
    return `${fmt(coef.abs())}(${fmt(value)})`;
  }

  function zPlug(c1, c2, x, y) {
    const left = c1.isNegative() ? `−${zTerm(c1, x)}` : zTerm(c1, x);
    const right = zTerm(c2, y);
    if (c2.isNegative()) return `${left} − ${right}`;
    return `${left} + ${right}`;
  }

  function zSum(a, b) {
    if (b.isZero()) return `${fmt(a)} + 0`;
    if (b.isNegative()) return `${fmt(a)} − ${fmt(b.abs())}`;
    return `${fmt(a)} + ${fmt(b)}`;
  }

  function zChain(c1, c2, x, y, z) {
    const plugged = zPlug(c1, c2, x, y);
    const added = zSum(c1.mul(x), c2.mul(y));
    if (added === plugged || added === fmt(z)) return `Z = ${plugged} = ${fmt(z)}`;
    return `Z = ${plugged} = ${added} = ${fmt(z)}`;
  }

  function renderZ(v, c1, c2, isBest) {
    const card = el('article', { className: isBest ? 'z-card is-best' : 'z-card' });
    card.append(el('p', { className: 'z-kicker', text: `Vértice ${v.letter}: ${point(fmt, v.x, v.y)}` }));
    const plugged = zPlug(c1, c2, v.x, v.y);
    const added = zSum(c1.mul(v.x), c2.mul(v.y));
    card.append(alg(`Z = ${plugged}`));
    if (added !== plugged) card.append(alg(`Z = ${added}`));
    card.append(alg(`Z = ${fmt(v.z)}`, isBest ? 'answer' : ''));
    return card;
  }

  function verifyBlock(eqs, x, y) {
    const box = el('div', { className: 'g-eqs' });
    eqs.forEach((eq) => {
      const expr = joinTerms([
        pluggedTerm(eq.a, 'x₁', true, x),
        pluggedTerm(eq.b, 'x₂', true, y),
      ]);
      const sum = eq.a.mul(x).add(eq.b.mul(y));
      const ok = sum.equals(eq.c);
      box.append(note(`${eq.label}: se reemplazan x₁ y x₂.`));
      box.append(alg(`${expr} = ${fmt(eq.c)}`));
      box.append(alg(
        ok ? `${fmt(sum)} = ${fmt(eq.c)}. Cumple.` : `El lado izquierdo da ${fmt(sum)}, y la ecuación pide ${fmt(eq.c)}.`,
        ok ? 'ok' : 'bad',
      ));
    });
    return box;
  }

  function renderReduction(solved) {
    const card = el('article', { className: 'reduce-card' });
    card.append(el('p', { className: 'reduce-kicker', text: `${solved.labels[0]} con ${solved.labels[1]}` }));
    if (solved.kind === 'parallel') {
      card.append(note('Estas dos rectas no se cruzan en un punto: son paralelas o son la misma recta. No definen un vértice.'));
      solved.eqs.forEach((eq) => card.append(alg(`${eq.label}:  ${eqText(fmt, eq.a, eq.b, eq.c)}`)));
      return card;
    }

    const steps = el('div', { className: 'reduce-steps' });
    const eqs = el('div', { className: 'g-eqs' });
    solved.eqs.forEach((eq) => eqs.append(alg(`${eq.label}:  ${eqText(fmt, eq.a, eq.b, eq.c)}`)));
    steps.append(reduceStep(1, 'Las dos rectas', [
      note('El cruce se busca con las igualdades, aunque la restricción original sea ≤ o ≥.'),
      eqs,
    ]));

    if (solved.kind === 'direct') {
      const x = solved.point.x;
      const y = solved.point.y;
      steps.append(reduceStep(2, 'Cada recta ya da una variable', [
        note(`${solved.vertical.label} es vertical: no tiene x₂.`),
        alg(`x₁ = ${fmt(solved.vertical.c)} ÷ ${fmt(solved.vertical.a)} = ${fmt(x)}`, 'answer'),
        note(`${solved.horizontal.label} es horizontal: no tiene x₁.`),
        alg(`x₂ = ${fmt(solved.horizontal.c)} ÷ ${fmt(solved.horizontal.b)} = ${fmt(y)}`, 'answer'),
      ]));
      steps.append(reduceStep(3, 'Comprobar en las dos rectas', [
        note('Se vuelven a colocar los dos valores en cada ecuación. Los dos lados deben coincidir.'),
        verifyBlock(solved.eqs, x, y),
      ]));
    } else {
      const varName = solved.eliminate === 1 ? 'x₂' : 'x₁';
      const other = solved.eliminate === 1 ? 'x₁' : 'x₂';
      const [m1, m2] = solved.factors;
      const [e1, e2] = solved.eqs;
      const [s1, s2] = solved.scaled;
      const coef = (eq) => (solved.eliminate === 1 ? eq.b : eq.a);
      const multiplyNodes = [
        note(`En ${e1.label} el coeficiente de ${varName} es ${fmt(coef(e1))}. En ${e2.label} es ${fmt(coef(e2))}.`),
      ];
      if (m1.equals(Fraction.one()) && m2.equals(Fraction.one())) {
        multiplyNodes.push(note(`Ya son iguales. No hace falta multiplicar.`));
        multiplyNodes.push(alg(`${eqText(fmt, s1.a, s1.b, s1.c)}`));
        multiplyNodes.push(alg(`${eqText(fmt, s2.a, s2.b, s2.c)}`));
      } else {
        [[e1, s1, m1], [e2, s2, m2]].forEach(([src, scaled, factor]) => {
          if (factor.equals(Fraction.one())) {
            multiplyNodes.push(note(`${src.label} se deja igual, porque su coeficiente de ${varName} ya sirve.`));
            multiplyNodes.push(alg(eqText(fmt, scaled.a, scaled.b, scaled.c)));
          } else {
            multiplyNodes.push(note(`${src.label} se multiplica por ${fmt(factor)}, para que ${varName} quede con el mismo coeficiente en las dos.`));
            multiplyNodes.push(alg(`${fmt(factor)}(${eqText(fmt, src.a, src.b, src.c)})`));
            multiplyNodes.push(alg(eqText(fmt, scaled.a, scaled.b, scaled.c), 'answer'));
          }
        });
      }
      steps.append(reduceStep(2, `Igualar ${varName}`, multiplyNodes));

      const sign = solved.combine === 'add' ? '+' : '−';
      const rhsOp = solved.combine === 'add'
        ? `${fmt(s1.c)} + ${fmt(s2.c)}`
        : `${fmt(s1.c)} − ${fmt(s2.c)}`;
      const flip = (coef) => (solved.combine === 'add' ? coef : coef.neg());
      const expanded = `${joinTerms([
        plainTerm(s1.a, 'x₁'),
        plainTerm(s1.b, 'x₂'),
        plainTerm(flip(s2.a), 'x₁'),
        plainTerm(flip(s2.b), 'x₂'),
      ])} = ${fmt(solved.combine === 'add' ? s1.c.add(s2.c) : s1.c.sub(s2.c))}`;
      const leftCoef = solved.eliminate === 1 ? solved.reduced.a : solved.reduced.b;
      const divide = leftCoef.equals(Fraction.one())
        ? `${other} = ${fmt(solved.firstValue)}`
        : `${other} = ${fmt(solved.reduced.c)} ÷ ${fmt(leftCoef)} = ${fmt(solved.firstValue)}`;
      steps.append(reduceStep(3, solved.combine === 'add' ? 'Sumar y despejar' : 'Restar y despejar', [
        note(solved.combine === 'add'
          ? `Los coeficientes de ${varName} tienen signo contrario. Se suman las dos ecuaciones y ${varName} desaparece.`
          : `Ahora las dos tienen el mismo ${varName}. Se resta la segunda de la primera y ${varName} desaparece.`),
        alg(`(${lin(fmt, s1.a, s1.b)}) ${sign} (${lin(fmt, s2.a, s2.b)}) = ${rhsOp}`),
        note('Se quitan los paréntesis y se juntan los términos parecidos.'),
        alg(expanded),
        alg(eqText(fmt, solved.reduced.a, solved.reduced.b, solved.reduced.c), leftCoef.equals(Fraction.one()) ? 'answer' : ''),
        ...(leftCoef.isNegative() ? [note('El número salió negativo. Se divide igual: negativo entre negativo da positivo.')] : []),
        ...(leftCoef.equals(Fraction.one()) ? [] : [alg(divide, 'answer')]),
      ]));

      const host = solved.host;
      const knownName = solved.firstIndex === 0 ? 'x₁' : 'x₂';
      const otherName = solved.firstIndex === 0 ? 'x₂' : 'x₁';
      const knownCoef = solved.firstIndex === 0 ? host.a : host.b;
      const otherCoef = solved.firstIndex === 0 ? host.b : host.a;
      const knownValue = solved.firstValue;
      const found = solved.point[otherName === 'x₁' ? 'x' : 'y'];
      const product = knownCoef.mul(knownValue);
      const productShown = product.isNegative() ? `(${fmt(product)})` : fmt(product);
      const aside = `${fmt(host.c)} − ${productShown}`;
      const otherLeft = otherCoef.equals(Fraction.one())
        ? otherName
        : (otherCoef.equals(Fraction.one().neg()) ? `−${otherName}` : `${fmt(otherCoef)}${otherName}`);
      const pluggedLine = joinTerms([
        pluggedTerm(host.a, 'x₁', solved.firstIndex === 0, knownValue),
        pluggedTerm(host.b, 'x₂', solved.firstIndex === 1, knownValue),
      ]) + ` = ${fmt(host.c)}`;
      const replacedLine = joinTerms([
        replacedTerm(host.a, 'x₁', solved.firstIndex === 0, knownValue),
        replacedTerm(host.b, 'x₂', solved.firstIndex === 1, knownValue),
      ]) + ` = ${fmt(host.c)}`;
      const subNodes = [
        note(`Ya se conoce ${knownName} = ${fmt(knownValue)}. Se pone ese valor en ${host.label}, que es una de las ecuaciones originales.`),
        alg(eqText(fmt, host.a, host.b, host.c)),
        alg(pluggedLine),
      ];
      if (replacedLine !== pluggedLine) subNodes.push(alg(replacedLine));
      if (otherCoef.equals(Fraction.one())) {
        subNodes.push(alg(`${otherName} = ${aside} = ${fmt(found)}`, 'answer'));
      } else {
        subNodes.push(note('El número que ya se calculó pasa al otro lado y cambia de signo.'));
        subNodes.push(alg(`${otherLeft} = ${aside}`));
        if (fmt(solved.moved) !== aside) subNodes.push(alg(`${otherLeft} = ${fmt(solved.moved)}`));
        subNodes.push(alg(`${otherName} = ${fmt(solved.moved)} ÷ ${fmt(otherCoef)} = ${fmt(found)}`, 'answer'));
      }
      steps.append(reduceStep(4, `Sustituir para hallar ${otherName}`, subNodes));
      steps.append(reduceStep(5, 'Comprobar en las dos rectas', [
        note('Se reemplazan los dos valores en cada ecuación. Si los dos lados coinciden, el cruce está bien calculado.'),
        verifyBlock(solved.eqs, solved.point.x, solved.point.y),
      ]));
    }
    card.append(steps);

    const badge = el('p', {
      className: `reduce-point ${solved.feasible ? 'is-ok' : 'is-no'}`,
      text: solved.feasible
        ? `Punto ${point(fmt, solved.point.x, solved.point.y)}. Cumple todas las restricciones: es un vértice.`
        : `Punto ${point(fmt, solved.point.x, solved.point.y)}. No entra. ${solved.checks.filter((row) => !row.ok).map(failLine).join(' ')}`,
    });
    card.append(badge);
    return card;
  }

  function paint(result) {
    const root = document.getElementById('g-results');
    root.classList.remove('is-hidden');
    root.innerHTML = '';
    const walk = el('div', { className: 'walk' });

    const model = beat(1, 'Planteamiento', 'Función objetivo y restricciones', 'El método gráfico usa solo x₁ y x₂. Las dos son mayores o iguales que cero.');
    const modelText = el('div', { className: 'model-block' });
    const senseWord = result.sense === 'min' ? 'Minimizar' : 'Maximizar';
    modelText.append(el('p', { text: `${senseWord} Z = ${lin(fmt, result.objective[0], result.objective[1])}` }));
    modelText.append(el('p', { className: 'model-kicker', text: 'sujeto a' }));
    result.constraints.forEach((con) => {
      modelText.append(el('p', { text: `${con.label}: ${lin(fmt, con.a, con.b)} ${opSymbol(con.op)} ${fmt(con.c)}` }));
    });
    modelText.append(el('p', { text: 'x₁ ≥ 0, x₂ ≥ 0' }));
    model.card.append(modelText);
    walk.append(model.row);

    const cuts = beat(2, 'Rectas', 'Cortes con los ejes', 'Cada restricción se dibuja como igualdad. Un corte negativo no se usa: cae fuera de x₁ ≥ 0 y x₂ ≥ 0.');
    result.intercepts.forEach((cut) => {
      const box = el('div', { className: 'cut-card' });
      box.append(el('p', { className: 'reduce-kicker', text: cut.label }));
      box.append(el('p', { className: 'g-eq', text: eqText(fmt, cut.a, cut.b, cut.c) }));
      if (cut.yCut && cut.xCut) {
        const yNote = cut.yCut.isNegative() ? ' Queda fuera del primer cuadrante.' : '';
        const xNote = cut.xCut.isNegative() ? ' Queda fuera del primer cuadrante.' : '';
        box.append(el('p', { className: 'beat-text', text: `Si x₁ = 0, x₂ = ${fmt(cut.c)} ÷ ${fmt(cut.b)} = ${fmt(cut.yCut)}. Punto ${point(fmt, Fraction.zero(), cut.yCut)}.${yNote}` }));
        box.append(el('p', { className: 'beat-text', text: `Si x₂ = 0, x₁ = ${fmt(cut.c)} ÷ ${fmt(cut.a)} = ${fmt(cut.xCut)}. Punto ${point(fmt, cut.xCut, Fraction.zero())}.${xNote}` }));
      } else if (cut.xCut) {
        box.append(el('p', { className: 'beat-text', text: `No corta el eje x₂, porque el coeficiente de x₂ es 0. Es una recta vertical: x₁ = ${fmt(cut.xCut)}.` }));
      } else if (cut.yCut) {
        box.append(el('p', { className: 'beat-text', text: `No corta el eje x₁, porque el coeficiente de x₁ es 0. Es una recta horizontal: x₂ = ${fmt(cut.yCut)}.` }));
      } else {
        box.append(el('p', { className: 'beat-text', text: 'Esta restricción no tiene x₁ ni x₂, así que no se dibuja.' }));
      }
      cuts.card.append(box);
    });
    walk.append(cuts.row);

    const region = beat(3, 'Semiplanos', 'De qué lado queda la región', 'Se prueba el origen en cada restricción. Si cumple, ese semiplano incluye el origen. La región factible es el cruce de todos.');
    result.originTests.forEach((test) => {
      let text;
      if (test.op === '=') {
        text = test.ok
          ? `${test.label} pasa por el origen. Una igualdad no es un área: es solo la recta.`
          : `${test.label}: el origen no está en la recta. La región de esta restricción es únicamente la recta.`;
      } else if (test.ok) {
        text = `${test.label}: 0 ${opSymbol(test.op)} ${fmt(test.rhs)}. El origen cumple, así que el semiplano incluye el origen.`;
      } else {
        text = `${test.label}: 0 no cumple ${opSymbol(test.op)} ${fmt(test.rhs)}. El semiplano útil es el lado contrario al origen.`;
      }
      region.card.append(el('p', { className: 'beat-text', text }));
    });
    walk.append(region.row);

    const verts = beat(4, 'Vértices', 'Qué puntos entran', 'Primero se miran el origen y los cortes con los ejes. Después, cada cruce de dos rectas se resuelve por reducción.');
    const axis = result.candidates.filter((p) => p.sources.every((s) => !s.startsWith('Reducción')));
    if (axis.length) {
      const board = el('table', { className: 'vertex-board' });
      const head = el('thead');
      const hr = el('tr');
      ['Punto', 'De dónde sale', '¿Entra?'].forEach((name) => hr.append(el('th', { text: name })));
      head.append(hr);
      board.append(head);
      const body = el('tbody');
      axis.forEach((p) => {
        const tr = el('tr', { className: p.feasible ? 'is-in' : 'is-out' });
        tr.append(el('td', { text: point(fmt, p.x, p.y) }));
        tr.append(el('td', { text: p.sources.join(', ') }));
        const decision = el('td');
        decision.append(el('span', { className: p.feasible ? 'yn yn-yes' : 'yn yn-no', text: p.feasible ? 'Sí' : 'No' }));
        if (!p.feasible) {
          decision.append(el('span', { className: 'yn-why', text: p.rows.filter((row) => !row.ok).map(failLine).join(' ') }));
        }
        tr.append(decision);
        body.append(tr);
      });
      board.append(body);
      verts.card.append(board);
    }
    if (result.reductions.length) {
      verts.card.append(el('p', { className: 'reduce-kicker reduce-kicker-gap', text: 'Cruces por reducción' }));
    }
    result.reductions.forEach((solved) => verts.card.append(renderReduction(solved)));
    if (result.vertices.length) {
      const chips = el('div', { className: 'vertex-chips' });
      chips.append(el('p', { className: 'reduce-kicker', text: 'Vértices que quedan' }));
      const row = el('div', { className: 'vertex-chip-row' });
      result.vertices.forEach((v) => {
        row.append(el('span', { className: 'vchip', text: `${v.letter}  ${point(fmt, v.x, v.y)}` }));
      });
      chips.append(row);
      verts.card.append(chips);
    } else {
      verts.card.append(el('p', { className: 'beat-text', text: 'No quedó ningún punto que cumpla todas las restricciones.' }));
    }
    walk.append(verts.row);

    if (result.vertices.length) {
      const c1 = result.objective[0];
      const c2 = result.objective[1];
      const pick = result.sense === 'min' ? 'menor' : 'mayor';
      const evalBeat = beat(5, 'Evaluación', 'Z en cada vértice', `Z = ${lin(fmt, c1, c2)}. En cada vértice se reemplazan x₁ y x₂. Primero se multiplica y después se suma. El óptimo es el valor ${pick}.`);
      result.vertices.forEach((v) => {
        const isBest = result.best.includes(v) && result.status !== 'unbounded';
        evalBeat.card.append(renderZ(v, c1, c2, isBest));
      });
      if (result.status !== 'unbounded' && result.best.length) {
        const names = result.best.map((v) => `${v.letter} ${point(fmt, v.x, v.y)}`).join(' y ');
        evalBeat.card.append(el('p', {
          className: 'reduce-point is-ok',
          text: result.best.length > 1
            ? `Empatan en Z = ${fmt(result.bestZ)}: ${names}. Esos vértices son óptimos.`
            : `El ${pick} es Z = ${fmt(result.bestZ)}, en ${names}. Por eso ese vértice es el óptimo.`,
        }));
      }
      walk.append(evalBeat.row);
    }

    const done = el('div', { className: 'checkpoint' });
    let title = 'Solución óptima';
    let text = '';
    if (result.status === 'infeasible') {
      done.classList.add('is-stop');
      title = 'No hay región factible';
      text = 'Ningún punto cumple todas las restricciones al mismo tiempo. El problema no tiene solución.';
    } else if (result.status === 'unbounded') {
      done.classList.add('is-stop');
      title = result.sense === 'min' ? 'Z puede bajar sin límite' : 'Z puede crecer sin límite';
      const where = result.best.map((v) => `${v.letter} ${point(fmt, v.x, v.y)}`).join(' y ');
      text = `La región no está cerrada y, en esa dirección, Z sigue ${result.sense === 'min' ? 'disminuyendo' : 'aumentando'}. No hay un óptimo finito. Entre los vértices, el valor ${result.sense === 'min' ? 'menor' : 'mayor'} es Z = ${fmt(result.bestZ)} en ${where}, pero ese punto no resuelve el problema.`;
    } else if (result.status === 'alternate') {
      done.classList.add('is-done');
      title = 'Hay infinitas soluciones óptimas';
      const where = result.best.map((v) => `${v.letter} ${point(fmt, v.x, v.y)}`).join(' y ');
      text = `Z = ${fmt(result.bestZ)} en ${where}.`;
      if (result.best.length > 1) text += ' Todo el segmento que los une también es óptimo.';
      else text += ' Desde ese vértice, Z se mantiene igual al alejarse por la región abierta.';
      if (result.parallelTo) text += ` Ocurre porque Z es paralela a ${result.parallelTo}.`;
    } else {
      done.classList.add('is-done');
      const v = result.best[0];
      const pick = result.sense === 'min' ? 'menor' : 'mayor';
      title = result.sense === 'min' ? 'Este es el mínimo' : 'Este es el máximo';
      text = `${v.letter} ${point(fmt, v.x, v.y)}: ${zChain(result.objective[0], result.objective[1], v.x, v.y, v.z)}. Es el ${pick}, así que es el óptimo.`;
      if (result.regionUnbounded) text += ' La región sigue abierta, pero Z no mejora al alejarse de este punto.';
      if (result.active.length) text += ` Pasan por el óptimo: ${result.active.join(', ')}.`;
      if (result.inactive.length) text += ` No pasan por el óptimo: ${result.inactive.join(', ')}.`;
    }
    done.append(el('p', { className: 'checkpoint-title', text: title }));
    done.append(el('p', { className: 'beat-text', text }));
    walk.append(done);

    root.append(walk);

    const graphCard = el('section', { className: 'beat-card graph-final' });
    graphCard.append(el('p', { className: 'beat-kicker', text: 'Gráfica final' }));
    graphCard.append(el('p', { className: 'beat-title', text: 'Región factible' }));
    graphCard.append(el('p', {
      className: 'beat-text',
      text: result.status === 'infeasible'
        ? 'Las rectas están dibujadas. No hay un área común que cumplir.'
        : result.status === 'unbounded'
          ? 'El área es la parte visible de la región. Sigue abierta, así que Z no se detiene en un punto.'
          : 'El área sombreada es la región factible. Los números de los ejes permiten leer cada punto. La letra es el vértice y, debajo, sus coordenadas. La recta punteada es el nivel de Z en el óptimo.',
    }));
    const wrap = el('div', { className: 'graph-wrap' });
    graphCard.append(wrap);
    const legend = el('ul', { className: 'graph-legend' });
    result.vertices.forEach((v) => {
      const best = result.best.includes(v) && result.status !== 'unbounded';
      const li = el('li', { className: best ? 'is-best' : '' });
      li.append(el('p', {
        className: 'z-legend-title',
        text: `${v.letter} ${point(fmt, v.x, v.y)}${best ? ' · óptimo' : ''}`,
      }));
      const plugged = zPlug(result.objective[0], result.objective[1], v.x, v.y);
      const added = zSum(result.objective[0].mul(v.x), result.objective[1].mul(v.y));
      li.append(el('p', { className: 'z-line', text: `Z = ${plugged}` }));
      if (added !== plugged) li.append(el('p', { className: 'z-line', text: `Z = ${added}` }));
      li.append(el('p', { className: best ? 'z-line is-answer' : 'z-line', text: `Z = ${fmt(v.z)}` }));
      legend.append(li);
    });
    if (legend.childNodes.length) graphCard.append(legend);
    root.append(graphCard);

    const nums = result.vertices.map((v) => ({
      x: v.x.toNumber(),
      y: v.y.toNumber(),
      z: v.z.toNumber(),
      tag: v.letter,
      coord: point(fmt, v.x, v.y),
    }));
    let polygon = nums.map((v) => ({ x: v.x, y: v.y }));
    if (result.regionUnbounded && nums.length) {
      const far = Math.max(1, ...nums.flatMap((v) => [v.x, v.y])) * 1.35;
      result.rays.forEach((ray) => {
        const dx = ray.dx.toNumber();
        const dy = ray.dy.toNumber();
        nums.forEach((v) => polygon.push({ x: v.x + far * dx, y: v.y + far * dy }));
      });
    }
    polygon = convexHull(polygon);
    const bestNums = result.status === 'unbounded' ? [] : result.best.map((v) => ({ x: v.x.toNumber(), y: v.y.toNumber() }));
    renderGraph(wrap, {
      ok: result.status !== 'infeasible',
      reason: result.status === 'infeasible' ? 'infeasible' : '',
      vertices: nums,
      polygon: result.status === 'infeasible' ? [] : polygon,
      lines: result.constraints.map((con) => ({
        a: con.a.toNumber(),
        b: con.b.toNumber(),
        c: con.c.toNumber(),
        label: con.label,
      })),
      objective: result.objective.map((c) => c.toNumber()),
    }, {
      unbounded: result.regionUnbounded,
      optimalPoint: bestNums[0] || null,
      optimalPoints: bestNums,
    });
  }

  document.querySelectorAll('#g-sense-toggle .toggle-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#g-sense-toggle .toggle-opt').forEach((b) => {
        b.classList.remove('is-active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-checked', 'true');
      sense = btn.dataset.val;
      const prev = collectRaw();
      prev.sense = sense;
      buildForm(prev);
    });
  });

  document.getElementById('g-cons-up').addEventListener('click', () => {
    if (numCons >= 8) return;
    const prev = collectRaw();
    numCons += 1;
    syncCons();
    buildForm(prev);
  });
  document.getElementById('g-cons-down').addEventListener('click', () => {
    if (numCons <= 1) return;
    const prev = collectRaw();
    numCons -= 1;
    prev.constraints = prev.constraints.slice(0, numCons);
    syncCons();
    buildForm(prev);
  });

  document.getElementById('g-displayMode').addEventListener('change', (e) => {
    setMode(e.target.value);
    if (api.result) paint(api.result);
  });

  document.getElementById('g-btn-example').addEventListener('click', () => {
    loadProblem({
      sense: 'max',
      objective: ['40', '50'],
      constraints: [
        { coeffs: ['1', '2'], op: '<=', rhs: '50' },
        { coeffs: ['4', '2'], op: '<=', rhs: '120' },
      ],
    });
  });

  document.getElementById('g-btn-clear').addEventListener('click', () => {
    sense = 'max';
    numCons = 2;
    document.querySelectorAll('#g-sense-toggle .toggle-opt').forEach((b) => {
      const active = b.dataset.val === 'max';
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    syncCons();
    buildForm(null);
    showMessages([]);
    document.getElementById('g-results').classList.add('is-hidden');
    api.result = null;
  });

  document.getElementById('g-btn-solve').addEventListener('click', () => {
    const raw = collectRaw();
    const checked = validateProblem(raw);
    if (!checked.ok) {
      showMessages(checked.issues);
      document.getElementById('g-results').classList.add('is-hidden');
      api.result = null;
      return;
    }
    showMessages(checked.issues);
    api.result = solveGraphic(checked.problem);
    paint(api.result);
    const box = document.getElementById('g-results');
    document.documentElement.style.scrollBehavior = 'auto';
    const header = document.querySelector('.site-header');
    const offset = header ? header.getBoundingClientRect().height + 12 : 12;
    window.scrollTo(0, box.getBoundingClientRect().top + window.scrollY - offset);
  });

  function loadProblem(problem) {
    sense = problem.sense === 'min' ? 'min' : 'max';
    const cons = (problem.constraints || []).slice(0, 8);
    numCons = Math.max(1, cons.length);
    document.querySelectorAll('#g-sense-toggle .toggle-opt').forEach((b) => {
      const active = b.dataset.val === sense;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    syncCons();
    buildForm({
      objective: (problem.objective || []).slice(0, 2),
      constraints: cons.map((c) => ({
        coeffs: (c.coeffs || []).slice(0, 2),
        op: c.op || '<=',
        rhs: c.rhs == null ? '' : String(c.rhs),
      })),
    });
    showMessages([], 'Modelo cargado. Pulse Resolver para ver cortes, reducción y la región.');
    document.getElementById('g-results').classList.add('is-hidden');
    api.result = null;
  }

  api.load = loadProblem;

  buildForm(null);
  return api;
}
