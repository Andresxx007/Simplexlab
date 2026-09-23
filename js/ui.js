/**
 * Interfaz: formularios, tablas, navegación de pasos. Único módulo que toca el DOM.
 */

import { solve, varName } from './engine.js';
import { validateProblem } from './validator.js';
import { explainStep, statusCopy, GLOSSARY } from './explainer.js';
import { EXAMPLES } from './examples.js';
import {
  loadHistory, saveHistoryItem, removeHistoryItem, clearHistory, storageAvailable,
} from './storage.js';
import { computeFeasibleRegion, renderGraph, extractSimplexPath } from './graph.js';
import { startHeroCanvas, startDemoCanvas } from './motion.js';

const SUB = ['', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉', '₁₀'];

function $(sel, root = document) { return root.querySelector(sel); }

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function')
      node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  });
  children.forEach((c) => { if (c != null) node.append(c); });
  return node;
}

function opSymbol(op) {
  if (op === '<=') return '≤';
  if (op === '>=') return '≥';
  return '=';
}

export class AppUI {
  constructor() {
    this.state = {
      numVars: 2,
      numCons: 3,
      sense: 'max',
      displayMode: 'fraction',
      result: null,
      stepIndex: 0,
      viewMode: 'auto',
      problemSnapshot: null,
    };
    this.storageWarned = false;
    this.bindShell();
    this.buildForm();
    this.renderExamples();
    this.renderGlossary();
    this.updatePreview();
    // Start on landing
    this.showView('inicio');
  }

  // ── Navigation ──────────────────────────────────────────

  showView(name) {
    const ids = {
      inicio:    'view-inicio',
      resolver:  'view-resolver',
      ejemplos:  'view-ejemplos',
      teoria:    'view-teoria',
    };
    Object.entries(ids).forEach(([key, id]) => {
      const sec = document.getElementById(id);
      if (!sec) return;
      const active = key === name;
      sec.hidden = !active;
      sec.classList.toggle('is-active', active);
    });
    document.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.nav === name);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Shell binding ────────────────────────────────────────

  bindShell() {
    document.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => this.showView(btn.dataset.nav));
    });

    // CTA buttons on landing page (data-nav attribute, same handler)
    // They are already caught by the querySelectorAll above.

    // Footer nav links
    document.querySelectorAll('.footer-link[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => this.showView(btn.dataset.nav));
    });

    // Counter animation for hero stats
    this._animateCounters();
    this._initReveal();
    this._initHeroParallax();
    this._initMotionCanvases();

    // Sense toggle
    document.querySelectorAll('#sense-toggle .toggle-opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#sense-toggle .toggle-opt').forEach((b) => {
          b.classList.remove('is-active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-checked', 'true');
        this.state.sense = btn.dataset.val;
        $('#sense').value = this.state.sense;
        this.updatePreview();
      });
    });

    // Steppers — variables
    $('#vars-up').addEventListener('click', () => {
      if (this.state.numVars < 10) {
        this.state.numVars += 1;
        this.syncSteppers();
        this.buildForm(true);
      }
    });
    $('#vars-down').addEventListener('click', () => {
      if (this.state.numVars > 1) {
        this.state.numVars -= 1;
        this.syncSteppers();
        this.buildForm(true);
      }
    });

    // Steppers — constraints
    $('#cons-up').addEventListener('click', () => {
      if (this.state.numCons < 10) {
        this.state.numCons += 1;
        this.syncSteppers();
        this.buildForm(true);
      }
    });
    $('#cons-down').addEventListener('click', () => {
      if (this.state.numCons > 1) {
        this.state.numCons -= 1;
        this.syncSteppers();
        this.buildForm(true);
      }
    });

    $('#displayMode').addEventListener('change', (e) => {
      this.state.displayMode = e.target.value;
      if (this.state.result) this.renderResults();
    });

    $('#btn-validate').addEventListener('click', () => this.validateOnly());
    $('#btn-clear').addEventListener('click', () => this.clearForm());
    $('#btn-load-example').addEventListener('click', () => this.showView('ejemplos'));
    $('#btn-solve').addEventListener('click', () => this.runSolve('auto'));
    $('#btn-step').addEventListener('click', () => this.runSolve('step'));
    // historial eliminado — no hay btn-clear-history

    document.addEventListener('keydown', (e) => {
      if (!$('#results') || $('#results').classList.contains('is-hidden')) return;
      if (this.state.viewMode !== 'step') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); this.gotoStep(this.state.stepIndex + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); this.gotoStep(this.state.stepIndex - 1); }
      else if (e.key === 'Home') { e.preventDefault(); this.gotoStep(0); }
      else if (e.key === 'End') { e.preventDefault(); this.gotoStep(this.state.result.steps.length - 1); }
    });
  }

  _animateCounters() {
    const els = document.querySelectorAll('[data-count]');
    if (!els.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        const target = parseInt(entry.target.dataset.count, 10);
        const duration = 1200;
        const start = performance.now();
        const tick = (now) => {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 3);
          entry.target.textContent = Math.round(ease * target);
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.2 });
    els.forEach((el) => observer.observe(el));
  }

  _initReveal() {
    const nodes = document.querySelectorAll(
      '.ls-inner, .howto-card, .explainer-card, .var-card, .case-card, .feature-item, .landing-cta'
    );
    if (!nodes.length) return;
    nodes.forEach((n) => n.classList.add('reveal'));

    const show = (el) => el.classList.add('is-visible');

    if (!('IntersectionObserver' in window)) {
      nodes.forEach(show);
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        show(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });

    nodes.forEach((n) => io.observe(n));

    // Seguridad: si algo quedó oculto, mostrarlo a los 1.2s
    setTimeout(() => {
      nodes.forEach((n) => {
        if (!n.classList.contains('is-visible')) show(n);
      });
    }, 1200);
  }

  _initHeroParallax() {
    const visual = document.querySelector('.hero-visual');
    const hero = document.querySelector('.landing-hero');
    if (!visual || !hero) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    let raf = 0;
    hero.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = hero.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width - 0.5) * 12;
        const y = ((e.clientY - r.top) / r.height - 0.5) * 10;
        visual.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    });
    hero.addEventListener('pointerleave', () => {
      visual.style.transform = 'translate3d(0,0,0)';
    });
  }

  _initMotionCanvases() {
    const heroCanvas = document.getElementById('hero-canvas');
    const demoCanvas = document.getElementById('demo-canvas');
    this._stopHeroMotion = startHeroCanvas(heroCanvas);
    this._stopDemoMotion = startDemoCanvas(demoCanvas);
  }

  syncSteppers() {
    $('#vars-display').textContent = this.state.numVars;
    $('#cons-display').textContent = this.state.numCons;
    $('#numVars').value = this.state.numVars;
    $('#numCons').value = this.state.numCons;
    // Button disabled states
    $('#vars-down').disabled = this.state.numVars <= 1;
    $('#cons-down').disabled = this.state.numCons <= 1;
    $('#vars-up').disabled   = this.state.numVars >= 10;
    $('#cons-up').disabled   = this.state.numCons >= 10;
  }

  // ── Form ────────────────────────────────────────────────

  preservedValues() {
    const data = { objective: [], constraints: [] };
    for (let j = 0; j < 10; j++) {
      const inp = document.getElementById(`obj-${j}`);
      data.objective[j] = inp ? inp.value : '';
    }
    for (let i = 0; i < 10; i++) {
      const coeffs = [];
      for (let j = 0; j < 10; j++) {
        const inp = document.getElementById(`con-${i}-${j}`);
        coeffs[j] = inp ? inp.value : '';
      }
      data.constraints[i] = {
        coeffs,
        op: document.getElementById(`op-${i}`)?.value || '<=',
        rhs: document.getElementById(`rhs-${i}`)?.value || '',
      };
    }
    return data;
  }

  buildForm(preserve = false) {
    const prev = preserve ? this.preservedValues() : null;
    const root = $('#problem-form');
    root.innerHTML = '';

    // Default values for first load
    const defObj = ['3', '5'];
    const defCons = [
      { coeffs: ['1', '0'], op: '<=', rhs: '4' },
      { coeffs: ['0', '2'], op: '<=', rhs: '12' },
      { coeffs: ['3', '2'], op: '<=', rhs: '18' },
    ];

    const sense = this.state.sense;

    // Objective row
    const objRow = el('div', { className: 'obj-row' });
    const badgeLabel = sense === 'min' ? 'Minimizar Z =' : 'Maximizar Z =';
    objRow.append(el('div', { className: 'row-badge', text: badgeLabel }));

    for (let j = 0; j < this.state.numVars; j++) {
      const field = el('label', { className: 'coef-field' });
      field.append(el('span', { className: 'coef-label', text: `X${SUB[j + 1]}` }));
      const inp = el('input', {
        id: `obj-${j}`,
        type: 'text',
        inputmode: 'decimal',
        autocomplete: 'off',
        className: 'coef-input',
        'aria-label': `Coef. X${j + 1} función objetivo`,
      });
      inp.value = prev ? (prev.objective[j] ?? '') : (defObj[j] ?? '');
      inp.addEventListener('input', () => this.updatePreview());
      field.append(inp);
      objRow.append(field);
    }
    root.append(objRow);

    // Constraint rows
    for (let i = 0; i < this.state.numCons; i++) {
      const row = el('div', { className: 'con-row' });
      row.append(el('div', { className: 'row-index', text: `R${i + 1}` }));

      for (let j = 0; j < this.state.numVars; j++) {
        const field = el('label', { className: 'coef-field' });
        field.append(el('span', { className: 'coef-label', text: `X${SUB[j + 1]}` }));
        const inp = el('input', {
          id: `con-${i}-${j}`,
          type: 'text',
          inputmode: 'decimal',
          autocomplete: 'off',
          className: 'coef-input',
          'aria-label': `R${i + 1} coef X${j + 1}`,
        });
        const defV = prev
          ? (prev.constraints[i]?.coeffs[j] ?? '')
          : (defCons[i]?.coeffs[j] ?? '');
        inp.value = defV;
        inp.addEventListener('input', () => this.updatePreview());
        field.append(inp);
        row.append(field);
      }

      const op = el('select', {
        id: `op-${i}`,
        className: 'op-select',
        'aria-label': `Operador R${i + 1}`,
      });
      [['<=', '≤'], ['>=', '≥'], ['=', '=']].forEach(([v, lbl]) => {
        const o = el('option', { value: v, text: lbl });
        op.append(o);
      });
      op.value = prev ? (prev.constraints[i]?.op || '<=') : (defCons[i]?.op || '<=');
      op.addEventListener('change', () => this.updatePreview());
      row.append(op);

      const rhsField = el('label', { className: 'rhs-field' });
      rhsField.append(el('span', { className: 'rhs-label', text: 'LD' }));
      const rhs = el('input', {
        id: `rhs-${i}`,
        type: 'text',
        inputmode: 'decimal',
        autocomplete: 'off',
        className: 'coef-input',
        'aria-label': `Lado derecho R${i + 1}`,
      });
      rhs.value = prev ? (prev.constraints[i]?.rhs ?? '') : (defCons[i]?.rhs ?? '');
      rhs.addEventListener('input', () => this.updatePreview());
      rhsField.append(rhs);
      row.append(rhsField);

      root.append(row);
    }

    this.syncSteppers();
    this.updatePreview();
  }

  collectRaw() {
    const objective = [];
    for (let j = 0; j < this.state.numVars; j++) {
      const inp = document.getElementById(`obj-${j}`);
      if (inp && inp.value.trim() === '') inp.value = '0';
      objective.push(inp?.value.trim() ?? '0');
    }
    const constraints = [];
    for (let i = 0; i < this.state.numCons; i++) {
      const coeffs = [];
      for (let j = 0; j < this.state.numVars; j++) {
        const inp = document.getElementById(`con-${i}-${j}`);
        if (inp && inp.value.trim() === '') inp.value = '0';
        coeffs.push(inp?.value.trim() ?? '0');
      }
      constraints.push({
        coeffs,
        op: document.getElementById(`op-${i}`)?.value || '<=',
        rhs: document.getElementById(`rhs-${i}`)?.value.trim() || '',
      });
    }
    return { sense: this.state.sense, numVars: this.state.numVars, constraints, objective };
  }

  updatePreview() {
    const raw = this.collectRaw();
    const terms = (coeffs) => coeffs
      .map((c, j) => `${c || '0'}X${SUB[j + 1]}`)
      .join(' + ')
      .replace(/\+ -/g, '− ');

    let text = `${raw.sense === 'min' ? 'Minimizar' : 'Maximizar'}\nZ = ${terms(raw.objective)}\n\nsujeto a\n`;
    raw.constraints.forEach((con) => {
      text += `${terms(con.coeffs)} ${opSymbol(con.op)} ${con.rhs || '?'}\n`;
    });
    text += `X${SUB[1]}…X${SUB[raw.numVars]} ≥ 0`;
    $('#live-preview').textContent = text;
  }

  showMessages(issues, okMsg = null) {
    const box = $('#validation-messages');
    box.innerHTML = '';
    if (okMsg) box.append(el('div', { className: 'msg msg-ok', text: okMsg }));
    issues.forEach((issue) => {
      box.append(el('div', {
        className: `msg msg-${issue.level === 'error' ? 'error' : 'warning'}`,
        text: issue.message,
      }));
    });
  }

  validateOnly() {
    const raw = this.collectRaw();
    const { ok, issues } = validateProblem(raw);
    if (ok) this.showMessages(issues, 'El problema está bien formado y listo para resolver.');
    else this.showMessages(issues);
    return ok;
  }

  clearForm() {
    this.state.numVars = 2;
    this.state.numCons = 3;
    this.state.sense = 'max';
    // Reset toggles
    document.querySelectorAll('#sense-toggle .toggle-opt').forEach((b) => {
      const active = b.dataset.val === 'max';
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    $('#sense').value = 'max';
    this.buildForm(false);
    for (let j = 0; j < 2; j++) { const i = document.getElementById(`obj-${j}`); if (i) i.value = ''; }
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) { const inp = document.getElementById(`con-${i}-${j}`); if (inp) inp.value = ''; }
      const rhs = document.getElementById(`rhs-${i}`); if (rhs) rhs.value = '';
      const op = document.getElementById(`op-${i}`); if (op) op.value = '<=';
    }
    $('#results').classList.add('is-hidden');
    this.state.result = null;
    this.showMessages([]);
    this.updatePreview();
  }

  loadProblem(problem) {
    this.state.sense = problem.sense;
    this.state.numVars = problem.numVars;
    this.state.numCons = problem.constraints.length;

    // Sync toggles
    document.querySelectorAll('#sense-toggle .toggle-opt').forEach((b) => {
      const active = b.dataset.val === problem.sense;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    $('#sense').value = problem.sense;

    this.buildForm(false);

    problem.objective.forEach((c, j) => {
      const inp = document.getElementById(`obj-${j}`);
      if (inp) inp.value = c;
    });
    problem.constraints.forEach((con, i) => {
      con.coeffs.forEach((c, j) => {
        const inp = document.getElementById(`con-${i}-${j}`);
        if (inp) inp.value = c;
      });
      const op = document.getElementById(`op-${i}`);
      if (op) op.value = con.op;
      const rhs = document.getElementById(`rhs-${i}`);
      if (rhs) rhs.value = con.rhs;
    });
    this.updatePreview();
    this.showView('resolver');
    $('#results').classList.add('is-hidden');
  }

  // ── Solve ────────────────────────────────────────────────

  runSolve(mode) {
    const raw = this.collectRaw();
    const { ok, problem, issues } = validateProblem(raw);
    this.showMessages(issues);
    if (!ok) return;
    try {
      const result = solve(problem, { findAlternate: true });
      this.state.result = result;
      this.state.problemSnapshot = problem;
      this.state.stepIndex = mode === 'step' ? 0 : result.steps.length - 1;
      this.state.viewMode = mode;
      this.showMessages(issues, 'Cálculo completado.');
      this.renderResults();
      this.persistHistory(problem, result);
      $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      this.showMessages([{
        level: 'error',
        message: `Error al resolver: ${err.message || 'desconocido'}. Revise los datos.`,
      }]);
    }
  }

  persistHistory(problem, result) {
    if (!storageAvailable()) {
      if (!this.storageWarned) {
        this.storageWarned = true;
        this.showMessages([{ level: 'warning', message: 'Almacenamiento local bloqueado: el historial no se guardará.' }]);
      }
      return;
    }
    saveHistoryItem({
      summary: `${problem.sense === 'min' ? 'Min' : 'Max'} · ${problem.numVars} var · ${problem.constraints.length} rest · ${statusCopy(result.status).title}`,
      status: result.status,
      z: result.z?.toString?.() ?? null,
      problem,
    });
  }

  fmt(value) {
    if (!value || typeof value.toString !== 'function') return String(value ?? '0');
    const mode = this.state.displayMode;
    if (mode === 'decimal2') return value.toString('decimal', 2);
    if (mode === 'decimal3') return value.toString('decimal', 3);
    return value.toString('fraction');
  }

  // ── Results rendering ────────────────────────────────────

  renderResults() {
    const root = $('#results');
    root.classList.remove('is-hidden');
    root.innerHTML = '';
    const result = this.state.result;
    if (!result) return;

    const copy = statusCopy(result.status);
    const icons = { optimal: '✓', alternate: '∞', unbounded: '↗', infeasible: '∅', continue: '…' };

    // Status banner
    const banner = el('div', { className: `status-banner status-${result.status}` });
    const icon = el('div', { className: 'status-icon', text: icons[result.status] || '•' });
    const textDiv = el('div', { className: 'status-text' });
    textDiv.append(el('h2', { text: copy.title }));
    textDiv.append(el('p', { text: copy.body }));
    if (result.status === 'optimal' || result.status === 'alternate') {
      textDiv.append(el('p', { className: 'z-hero', text: `Z = ${this.fmt(result.z)}` }));
    }
    banner.append(icon, textDiv);
    root.append(banner);

    // Mode tabs
    const tabs = el('div', { className: 'mode-tabs' });
    [['auto', 'Resultado final'], ['step', 'Paso a paso'], ['full', 'Procedimiento completo']].forEach(([id, label]) => {
      const btn = el('button', {
        type: 'button',
        className: `mode-tab${this.state.viewMode === id ? ' is-active' : ''}`,
        text: label,
        onClick: () => {
          this.state.viewMode = id;
          if (id === 'step' && this.state.stepIndex >= result.steps.length)
            this.state.stepIndex = 0;
          this.renderResults();
        },
      });
      tabs.append(btn);
    });
    root.append(tabs);

    if (this.state.viewMode === 'auto') this.renderAuto(root, result);
    else if (this.state.viewMode === 'step') this.renderStep(root, result);
    else this.renderFull(root, result);
  }

  renderAuto(root, result) {
    const grid = el('div', { className: 'results-grid' });

    // Left: solution details
    const left = el('div', { className: 'result-card' });
    left.append(el('h3', { text: 'Valores óptimos' }));

    const ul = el('ul', { className: 'solution-list' });
    if (result.status === 'optimal' || result.status === 'alternate') {
      result.values.forEach((v, i) => {
        const li = el('li');
        li.append(el('span', { text: varName('X', i + 1) }));
        li.append(el('span', { className: 'key-val', text: this.fmt(v) }));
        ul.append(li);
      });
    } else {
      ul.append(el('li', { text: 'No hay solución óptima que reportar.' }));
    }
    left.append(ul);

    if (result.slacks && Object.keys(result.slacks).length > 0) {
      left.append(el('h3', { text: 'Holguras y excesos', className: 'subhead' }));
      const ulS = el('ul', { className: 'solution-list' });
      Object.entries(result.slacks).forEach(([name, val]) => {
        const li = el('li');
        li.append(el('span', { text: name }));
        li.append(el('span', {
          text: val.isZero() ? `${this.fmt(val)} · recurso agotado` : this.fmt(val),
          className: val.isZero() ? '' : 'key-val',
        }));
        ulS.append(li);
      });
      left.append(ulS);
    }

    if (result.shadowPrices && Object.keys(result.shadowPrices).length > 0) {
      left.append(el('h3', { text: 'Precios sombra', className: 'subhead' }));
      const ulP = el('ul', { className: 'solution-list' });
      Object.entries(result.shadowPrices).forEach(([name, val]) => {
        const li = el('li');
        li.append(el('span', { text: name }));
        li.append(el('span', { className: 'key-val', text: this.fmt(val) }));
        ulP.append(li);
      });
      left.append(ulP);
    }

    if (result.alternateValues) {
      left.append(el('h3', { text: 'Otra solución óptima básica', className: 'subhead' }));
      const ul2 = el('ul', { className: 'solution-list' });
      result.alternateValues.forEach((v, i) => {
        const li = el('li');
        li.append(el('span', { text: varName('X', i + 1) }));
        li.append(el('span', { className: 'key-val', text: this.fmt(v) }));
        ul2.append(li);
      });
      left.append(ul2);
    }

    if (result.verification?.length) {
      left.append(el('h3', { text: 'Verificación de restricciones', className: 'subhead' }));
      const vt = el('table', { className: 'ratio-table' });
      vt.append(el('thead', {}, [
        el('tr', {}, [
          el('th', { text: '#' }), el('th', { text: 'LHS' }),
          el('th', { text: 'Op' }), el('th', { text: 'RHS' }),
          el('th', { text: 'Estado' }),
        ]),
      ]));
      const tb = el('tbody');
      result.verification.forEach((v) => {
        tb.append(el('tr', {}, [
          el('td', { text: String(v.index) }),
          el('td', { text: this.fmt(v.lhs) }),
          el('td', { text: opSymbol(v.op) }),
          el('td', { text: this.fmt(v.rhs) }),
          el('td', { text: v.active ? '● Activa' : v.satisfied ? '○ Holgada' : '✗ Incumplida' }),
        ]));
      });
      vt.append(tb);
      left.append(vt);
    }

    // Right: graph
    const right = el('div', { className: 'result-card' });
    right.append(el('h3', { text: 'Región factible' }));
    const gwrap = el('div', { className: 'graph-wrap' });
    right.append(gwrap);
    grid.append(left, right);
    root.append(grid);
    this.drawGraph(gwrap, result);

    // CTA to step mode
    const cta = el('div', { style: 'margin-top:1.25rem; display:flex; gap:.6rem; flex-wrap:wrap;' });
    cta.append(
      el('button', {
        type: 'button',
        className: 'btn btn-step',
        text: 'Ver paso a paso',
        onClick: () => { this.state.viewMode = 'step'; this.state.stepIndex = 0; this.renderResults(); },
      }),
      el('button', {
        type: 'button',
        className: 'btn btn-outline',
        text: 'Procedimiento completo',
        onClick: () => { this.state.viewMode = 'full'; this.renderResults(); },
      })
    );
    root.append(cta);
  }

  drawGraph(container, result) {
    const problem = this.state.problemSnapshot;
    if (!problem || problem.numVars !== 2) {
      container.append(el('p', {
        className: 'graph-message',
        text: 'Gráfico disponible solo con exactamente dos variables.',
      }));
      return;
    }
    const region = computeFeasibleRegion(problem);
    const path = extractSimplexPath(result);
    const optPt = (result.status === 'optimal' || result.status === 'alternate')
      ? { x: result.values[0].toNumber(), y: result.values[1].toNumber() }
      : null;
    renderGraph(container, region, {
      optimalPoint: optPt, path,
      unbounded: result.status === 'unbounded',
      currentVertex: path.length ? path[path.length - 1] : null,
    });
  }

  renderStep(root, result) {
    const idx = this.state.stepIndex;
    const step = result.steps[idx];
    const total = result.steps.length;
    const explained = explainStep(step, idx, total);
    const pct = total > 1 ? Math.round((idx / (total - 1)) * 100) : 100;

    // Chrome bar
    const chrome = el('div', { className: 'step-chrome' });
    const prog = el('div', { className: 'step-progress' });
    prog.append(document.createTextNode(`${explained.progress}`));
    prog.append(el('span', { text: step.title }));
    chrome.append(prog);

    const nav = el('div', { className: 'step-nav' });
    const navBtns = [
      ['Primero', () => this.gotoStep(0)],
      ['Anterior', () => this.gotoStep(idx - 1)],
      ['Siguiente', () => this.gotoStep(idx + 1), true],
      ['Último', () => this.gotoStep(total - 1)],
    ];
    navBtns.forEach(([label, fn, primary]) => {
      nav.append(el('button', {
        type: 'button',
        className: `step-nav-btn${primary ? ' is-primary' : ''}`,
        text: label,
        onClick: fn,
      }));
    });
    chrome.append(nav);
    root.append(chrome);

    // Progress bar
    const pbWrap = el('div', { className: 'progress-bar-wrap' });
    const pbTrack = el('div', { className: 'progress-bar-track' });
    const pbFill = el('div', { className: 'progress-bar-fill', style: `width:${pct}%` });
    pbTrack.append(pbFill);
    pbWrap.append(pbTrack);
    root.append(pbWrap);

    // Pivot cards
    if (step.entering || step.leaving || step.pivotValue) {
      const cards = el('div', { className: 'pivot-cards' });
      cards.append(
        this.makePivotCard('Variable entrante', step.entering || '—', 'is-enter'),
        this.makePivotCard('Variable saliente', step.leaving || '—', 'is-leave'),
        this.makePivotCard('Elemento pivote', step.pivotValue ? this.fmt(step.pivotValue) : '—', 'is-pivot'),
      );
      root.append(cards);
    }

    // Explain box
    const box = el('div', { className: 'explain-box' });
    explained.paragraphs.forEach((p) => box.append(el('p', { text: p })));
    root.append(box);

    // Tables
    const beforeTableau = step.meta?.before && step.pivotCol != null ? step.meta.before : null;
    if (beforeTableau) {
      root.append(this.renderTableau(beforeTableau, {
        pivotCol: step.pivotCol, pivotRow: step.pivotRow, showNegZ: true,
      }, 'Tabla antes del pivote'));
      root.append(this.renderTableau(step.tableau, { showNegZ: true }, 'Tabla después del pivote'));
    } else {
      root.append(this.renderTableau(step.tableau, {
        pivotCol: step.pivotCol, pivotRow: step.pivotRow, showNegZ: true,
      }, step.title));
    }

    // Ratio test
    if (step.ratios) {
      root.append(el('p', { className: 'results-section-title', text: 'Prueba de razón' }));
      const rt = el('table', { className: 'ratio-table' });
      rt.append(el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Fila' }), el('th', { text: 'Básica' }),
          el('th', { text: 'Razón' }), el('th', { text: 'Nota' }),
        ]),
      ]));
      const tb = el('tbody');
      step.ratios.forEach((r) => {
        tb.append(el('tr', { className: step.pivotRow === r.row ? 'is-best' : '' }, [
          el('td', { text: String(r.row + 1) }),
          el('td', { text: r.basic }),
          el('td', { text: r.ratio ? this.fmt(r.ratio) : '—' }),
          el('td', { text: r.note }),
        ]));
      });
      rt.append(tb);
      root.append(rt);
    }

    // Row ops — con flechas animadas y stagger
    if (step.rowOps?.length) {
      root.append(el('p', { className: 'results-section-title', text: 'Operaciones de fila' }));
      const ol = el('ol', { className: 'ops-list' });
      step.rowOps.forEach((op, i) => {
        const li = el('li', { style: `animation-delay: ${i * 60}ms` });
        li.append(el('span', { className: 'op-arrow', text: '→' }));
        li.append(document.createTextNode(op));
        ol.append(li);
      });
      root.append(ol);
    }

    // Mini-grafo sticky — solo con 2 variables
    if (this.state.problemSnapshot?.numVars === 2) {
      const miniWrap = el('div', { className: 'mini-graph-wrap' });
      const miniCard = el('div', { className: 'result-card' });
      const miniTitle = el('p', { className: 'results-section-title', text: `Gráfico — paso ${idx + 1}` });
      miniCard.append(miniTitle);
      const host = el('div', { className: 'graph-wrap is-mini' });
      miniCard.append(host);
      miniWrap.append(miniCard);
      root.append(miniWrap);

      const region = computeFeasibleRegion(this.state.problemSnapshot);
      const partialResult = { ...result, steps: result.steps.slice(0, idx + 1) };
      const path = extractSimplexPath(partialResult);
      // Vértice actual = último punto del path
      const currentVertex = path.length > 0 ? path[path.length - 1] : null;
      renderGraph(host, region, {
        path,
        optimalPoint:
          (result.status === 'optimal' || result.status === 'alternate')
            ? { x: result.values[0].toNumber(), y: result.values[1].toNumber() }
            : null,
        unbounded: result.status === 'unbounded',
        currentVertex,
      });
    }
  }

  makePivotCard(label, value, cls) {
    const card = el('div', { className: `pivot-card ${cls}` });
    card.append(el('div', { className: 'pc-label', text: label }));
    card.append(el('div', { className: 'pc-value', text: value }));
    return card;
  }

  gotoStep(i) {
    if (!this.state.result) return;
    const max = this.state.result.steps.length - 1;
    this.state.stepIndex = Math.max(0, Math.min(max, i));
    this.renderResults();
  }

  renderFull(root, result) {
    const wrap = el('div', { className: 'full-procedure' });
    result.steps.forEach((step, i) => {
      const block = el('div', { className: 'step-block' });
      const title = el('p', {
        className: 'step-block-title',
        text: step.title,
      });
      title.setAttribute('data-num', String(i + 1));
      block.append(title);
      const explained = explainStep(step, i, result.steps.length);
      const box = el('div', { className: 'explain-box' });
      explained.paragraphs.forEach((p) => box.append(el('p', { text: p })));
      block.append(box);
      block.append(this.renderTableau(step.tableau, {
        pivotCol: step.pivotCol,
        pivotRow: step.pivotRow,
        showNegZ: true,
      }));
      wrap.append(block);
    });
    root.append(wrap);
  }

  renderTableau(tableau, highlight = {}, caption = null) {
    const hasPivot = highlight.pivotCol != null && highlight.pivotRow != null;
    const wrap = el('div', { className: 'table-wrap' });

    // Cabecera de la tabla con botón pivot-focus (solo si hay pivote)
    const header = el('div', {
      style: 'display:flex; align-items:center; justify-content:space-between; padding: 0.55rem 1rem 0;',
    });
    if (caption) {
      header.append(el('div', { className: 'table-caption', style: 'padding:0', text: caption }));
    } else {
      header.append(el('span')); // placeholder
    }
    if (hasPivot) {
      const focusBtn = el('button', {
        type: 'button',
        className: 'focus-toggle',
        text: '◎ Enfocar pivote',
        onClick: (e) => {
          const active = wrap.classList.toggle('pivot-focus');
          e.currentTarget.classList.toggle('is-active', active);
          e.currentTarget.textContent = active ? '◉ Quitar enfoque' : '◎ Enfocar pivote';
        },
      });
      header.append(focusBtn);
    }
    wrap.append(header);

    const table = el('table', { className: 'simplex-table' });
    const thead = el('thead');
    const hr = el('tr');
    hr.append(el('th', { className: 'col-basic', text: 'Base' }));
    tableau.colNames.forEach((name, j) => {
      hr.append(el('th', {
        className: highlight.pivotCol === j ? 'is-pivot-col' : '',
        text: name,
      }));
    });
    hr.append(el('th', { className: 'col-rhs', text: 'LD' }));
    thead.append(hr);
    table.append(thead);

    const tbody = el('tbody');
    tableau.matrix.forEach((row, i) => {
      const tr = el('tr', { className: highlight.pivotRow === i ? 'is-pivot-row' : '' });
      tr.append(el('td', { className: 'col-basic', text: tableau.basic[i] }));
      row.forEach((cell, j) => {
        const isPivot = highlight.pivotCol === j && highlight.pivotRow === i;
        tr.append(el('td', {
          className: [
            highlight.pivotCol === j ? 'is-pivot-col' : '',
            isPivot ? 'is-pivot-cell' : '',
          ].filter(Boolean).join(' '),
          text: this.fmt(cell),
        }));
      });
      tr.append(el('td', { className: 'col-rhs', text: this.fmt(tableau.rhs[i]) }));
      tbody.append(tr);
    });

    // Z row
    const zr = el('tr', { className: 'z-row' });
    zr.append(el('td', { className: 'col-basic', text: 'Z' }));
    tableau.zRow.forEach((cell, j) => {
      const isNeg = highlight.showNegZ && cell.isNegative();
      zr.append(el('td', {
        className: [
          highlight.pivotCol === j ? 'is-pivot-col' : '',
          isNeg ? 'is-neg-z' : '',
        ].filter(Boolean).join(' '),
        text: this.fmt(cell),
      }));
    });
    zr.append(el('td', { className: 'col-rhs', text: this.fmt(tableau.zRhs) }));
    tbody.append(zr);

    table.append(tbody);
    wrap.append(table);
    return wrap;
  }

  // ── Examples ─────────────────────────────────────────────

  renderExamples() {
    const grid = $('#examples-grid');
    grid.innerHTML = '';
    EXAMPLES.forEach((ex) => {
      const levelClass = ex.level === 'Caso especial' ? 'level-especial'
        : ex.level === 'Avanzado' ? 'level-avanzado' : '';
      const card = el('button', {
        type: 'button',
        className: 'example-card',
        onClick: () => {
          this.loadProblem(ex.problem);
          this.showMessages([], `Ejemplo «${ex.title}» cargado. Pulse Resolver o Paso a paso.`);
          this.showView('resolver');
        },
      });
      card.append(el('p', { className: `ex-level ${levelClass}`, text: ex.level }));
      card.append(el('h3', { text: ex.title }));
      card.append(el('p', { className: 'ex-statement', text: ex.statement }));
      card.append(el('p', { className: 'ex-illustrates', text: ex.illustrates }));
      grid.append(card);
    });
  }

  // ── Glossary ──────────────────────────────────────────────

  renderGlossary() {
    const dl = $('#glossary-list');
    if (!dl) return;
    dl.innerHTML = '';
    Object.entries(GLOSSARY).forEach(([term, def]) => {
      dl.append(el('dt', { text: term }));
      dl.append(el('dd', { text: def }));
    });
  }

  // ── History ───────────────────────────────────────────────

  renderHistory() {
    const list = $('#history-list');
    if (!list) return;
    list.innerHTML = '';
    const { items, available } = loadHistory();
    if (!available) {
      list.append(el('p', { className: 'muted', text: 'Almacenamiento local no disponible en este navegador.' }));
      return;
    }
    if (!items.length) {
      list.append(el('p', { className: 'muted', text: 'Aún no hay problemas guardados. Resuelva uno para que aparezca aquí.' }));
      return;
    }
    items.forEach((item) => {
      const row = el('div', { className: 'history-item' });
      const info = el('div');
      info.append(el('div', { className: 'history-summary', text: item.summary }));
      info.append(el('div', {
        className: 'history-meta',
        text: new Date(item.savedAt).toLocaleString('es') + (item.z ? ` · Z = ${item.z}` : ''),
      }));
      row.append(info);
      const actions = el('div', { className: 'history-actions' });
      actions.append(
        el('button', {
          type: 'button',
          className: 'btn btn-outline btn-sm',
          text: 'Cargar',
          onClick: () => { this.loadProblem(item.problem); this.showMessages([], 'Problema del historial cargado.'); },
        }),
        el('button', {
          type: 'button',
          className: 'btn btn-outline btn-sm',
          text: '✕',
          onClick: () => { removeHistoryItem(item.id); this.renderHistory(); },
        })
      );
      row.append(actions);
      list.append(row);
    });
  }
}
