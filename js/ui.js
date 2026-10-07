/**
 * Interfaz: formularios, tablas, navegación de pasos. Único módulo que toca el DOM.
 */

import { solve, varName } from './engine.js';
import { BigCoeff } from './fractions.js';
import { validateProblem } from './validator.js';
import { statusCopy, resultAdvice, GLOSSARY } from './explainer.js';
import { EXAMPLES } from './examples.js';
import {
  loadHistory, saveHistoryItem, removeHistoryItem, clearHistory, storageAvailable,
} from './storage.js';
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

    const sense = this.state.sense;

    // Objective row — vacíos por defecto (el validador toma '' como 0)
    const objRow = el('div', { className: 'obj-row' });
    const badgeLabel = sense === 'min' ? 'Minimizar Z =' : 'Maximizar Z =';
    objRow.append(el('div', { className: 'row-badge', text: badgeLabel }));

    for (let j = 0; j < this.state.numVars; j++) {
      const field = el('label', { className: 'coef-field' });
      field.append(el('span', { className: 'coef-label', text: `x${SUB[j + 1]}` }));
      const inp = el('input', {
        id: `obj-${j}`,
        type: 'text',
        inputmode: 'decimal',
        autocomplete: 'off',
        className: 'coef-input',
        placeholder: '',
        'aria-label': `Coef. X${j + 1} función objetivo`,
      });
      inp.value = prev ? (prev.objective[j] ?? '') : '';
      this.wireCoefInput(inp);
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
        field.append(el('span', { className: 'coef-label', text: `x${SUB[j + 1]}` }));
        const inp = el('input', {
          id: `con-${i}-${j}`,
          type: 'text',
          inputmode: 'decimal',
          autocomplete: 'off',
          className: 'coef-input',
          placeholder: '',
          'aria-label': `R${i + 1} coef X${j + 1}`,
        });
        inp.value = prev ? (prev.constraints[i]?.coeffs[j] ?? '') : '';
        this.wireCoefInput(inp);
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
      op.value = prev ? (prev.constraints[i]?.op || '<=') : '<=';
      op.addEventListener('change', () => this.updatePreview());
      row.append(op);

      const rhsField = el('label', { className: 'rhs-field' });
      rhsField.append(el('span', { className: 'rhs-label', text: 'L.D.' }));
      const rhs = el('input', {
        id: `rhs-${i}`,
        type: 'text',
        inputmode: 'decimal',
        autocomplete: 'off',
        className: 'coef-input',
        placeholder: '',
        'aria-label': `Lado derecho R${i + 1}`,
      });
      rhs.value = prev ? (prev.constraints[i]?.rhs ?? '') : '';
      this.wireCoefInput(rhs);
      rhsField.append(rhs);
      row.append(rhsField);

      root.append(row);
    }

    this.syncSteppers();
    this.updatePreview();
  }

  /** Comportamiento de inputs de coeficiente: no rellenar con 0; al enfocar un 0, seleccionarlo. */
  wireCoefInput(inp) {
    inp.addEventListener('input', () => this.updatePreview());
    inp.addEventListener('focus', () => {
      const v = inp.value.trim();
      if (v === '0' || v === '0.0' || v === '0,0') {
        requestAnimationFrame(() => inp.select());
      }
    });
    // Si el usuario escribe encima de un 0 seleccionado, se reemplaza solo.
    // Si pega o escribe al final de "0", limpiar el cero residual al primer dígito.
    inp.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const isDigit = e.key.length === 1 && /[0-9.\-,/]/.test(e.key);
      if (!isDigit) return;
      const v = inp.value.trim();
      const selAll = inp.selectionStart === 0 && inp.selectionEnd === inp.value.length;
      if ((v === '0' || v === '0.0' || v === '0,0') && !selAll && inp.selectionStart === v.length) {
        // Cursor al final de un 0 suelto → reemplazar en vez de concatenar (p. ej. 05)
        if (e.key !== '.' && e.key !== ',' && e.key !== '-' && e.key !== '/') {
          e.preventDefault();
          inp.value = e.key;
          inp.setSelectionRange(1, 1);
          this.updatePreview();
        }
      }
    });
  }

  collectRaw() {
    const objective = [];
    for (let j = 0; j < this.state.numVars; j++) {
      const inp = document.getElementById(`obj-${j}`);
      // Vacío se deja vacío en pantalla; el validador lo trata como 0
      objective.push(inp?.value.trim() ?? '');
    }
    const constraints = [];
    for (let i = 0; i < this.state.numCons; i++) {
      const coeffs = [];
      for (let j = 0; j < this.state.numVars; j++) {
        const inp = document.getElementById(`con-${i}-${j}`);
        coeffs.push(inp?.value.trim() ?? '');
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
      .map((c, j) => `${c === '' || c == null ? '0' : c}x${SUB[j + 1]}`)
      .join(' + ')
      .replace(/\+ -/g, '− ');

    let text = `${raw.sense === 'min' ? 'Minimizar' : 'Maximizar'}\nZ = ${terms(raw.objective)}\n\nsujeto a\n`;
    raw.constraints.forEach((con) => {
      text += `${terms(con.coeffs)} ${opSymbol(con.op)} ${con.rhs || '?'}\n`;
    });
    text += `x${SUB[1]}…x${SUB[raw.numVars]} ≥ 0`;
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
    document.querySelectorAll('#sense-toggle .toggle-opt').forEach((b) => {
      const active = b.dataset.val === 'max';
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    $('#sense').value = 'max';
    this.buildForm(false);
    $('#results').classList.add('is-hidden');
    this.state.result = null;
    this.showMessages([]);
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

  exprTerms(coeffs) {
    const parts = [];
    coeffs.forEach((coef, j) => {
      const raw = String(coef);
      if (raw === '0') return;
      const name = `x${SUB[j + 1] || j + 1}`;
      if (raw === '1') parts.push(name);
      else if (raw === '-1') parts.push(`−${name}`);
      else parts.push(`${raw.replace(/-/g, '−')}${name}`);
    });
    if (!parts.length) return '0';
    return parts.join(' + ').replace(/\+ −/g, '− ');
  }

  printSolution() {
    const result = this.state.result;
    const problem = this.state.problemSnapshot;
    if (!result || !problem) return;

    document.getElementById('print-sheet')?.remove();
    const sheet = el('article', { id: 'print-sheet' });

    const head = el('header', { className: 'pdf-head' });
    head.append(el('p', { className: 'pdf-brand', text: 'SimplexLab · Investigación de Operaciones · UEB' }));
    head.append(el('h1', { text: 'Ejercicio resuelto' }));
    head.append(el('p', {
      className: 'pdf-date',
      text: new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }),
    }));
    sheet.append(head);

    const problemBox = el('section', { className: 'pdf-block pdf-problem' });
    problemBox.append(el('h2', { text: 'Problema' }));
    problemBox.append(el('p', { className: 'pdf-kicker', text: problem.sense === 'min' ? 'Minimizar' : 'Maximizar' }));
    problemBox.append(el('p', { className: 'pdf-eq', text: `Z = ${this.exprTerms(problem.objective)}` }));
    problemBox.append(el('p', { className: 'pdf-kicker', text: 'Sujeto a' }));
    const cons = el('ul', { className: 'pdf-cons' });
    problem.constraints.forEach((con) => {
      cons.append(el('li', { text: `${this.exprTerms(con.coeffs)}  ${opSymbol(con.op)}  ${String(con.rhs).replace(/-/g, '−')}` }));
    });
    problemBox.append(cons);
    const names = Array.from({ length: problem.numVars }, (_, i) => `x${SUB[i + 1] || i + 1}`);
    problemBox.append(el('p', { className: 'pdf-note', text: `${names.join(', ')} ≥ 0` }));
    sheet.append(problemBox);

    const answer = el('section', { className: 'pdf-block pdf-answer' });
    answer.append(el('h2', { text: 'Resultado' }));
    answer.append(el('p', { className: 'pdf-status', text: statusCopy(result.status).title }));
    const solved = result.status === 'optimal' || result.status === 'alternate';
    if (solved) {
      const list = el('ul', { className: 'pdf-values' });
      result.values.forEach((v, i) => {
        list.append(el('li', { text: `${varName('x', i + 1)} = ${this.fmt(v)}` }));
      });
      list.append(el('li', { className: 'is-z', text: `Z = ${this.fmt(result.z)}` }));
      answer.append(list);
      if (result.slacks && Object.keys(result.slacks).length) {
        const slackBits = Object.entries(result.slacks).map(([name, val]) => `${name} = ${this.fmt(val)}`);
        answer.append(el('p', { className: 'pdf-note', text: `Holguras: ${slackBits.join(' · ')}` }));
      }
      if (result.alternateValues) {
        const alt = result.alternateValues.map((v, i) => `${varName('x', i + 1)} = ${this.fmt(v)}`).join(', ');
        answer.append(el('p', { className: 'pdf-note', text: `Otra solución óptima básica: ${alt}` }));
      }
    } else {
      answer.append(el('p', { className: 'pdf-note', text: statusCopy(result.status).body }));
    }
    sheet.append(answer);

    const proc = el('section', { className: 'pdf-block pdf-procedure' });
    proc.append(el('h2', { text: 'Procedimiento' }));
    this.renderFull(proc, result);
    sheet.append(proc);

    document.body.append(sheet);
    const previousTitle = document.title;
    document.title = 'SimplexLab — ejercicio resuelto';
    const cleanup = () => {
      sheet.remove();
      document.title = previousTitle;
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
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

    const tips = resultAdvice(result.status);
    if (tips.length) {
      const tipBox = el('div', { className: `result-advice advice-${result.status}` });
      tipBox.append(el('p', { className: 'result-advice-title', text: 'Qué revisar / cómo interpretarlo' }));
      const tipList = el('ul', { className: 'result-advice-list' });
      tips.forEach((t) => tipList.append(el('li', { text: t })));
      tipBox.append(tipList);
      root.append(tipBox);
    }

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

    const tools = el('div', { className: 'result-tools' });
    tools.append(el('button', {
      type: 'button',
      className: 'btn-pdf',
      text: 'Generar PDF',
      onClick: () => this.printSolution(),
    }));
    tools.append(el('p', {
      className: 'pdf-hint',
      text: 'Se abre la ventana de impresión. Elija Guardar como PDF.',
    }));
    root.append(tools);

    if (this.state.viewMode === 'auto') this.renderAuto(root, result);
    else if (this.state.viewMode === 'step') this.renderStep(root, result);
    else this.renderFull(root, result);
  }

  renderAuto(root, result) {
    const isSolved = result.status === 'optimal' || result.status === 'alternate';

    const left = el('div', { className: 'result-card' });
    left.append(el('h3', { text: isSolved ? 'Valores óptimos' : 'Resumen del resultado' }));

    const ul = el('ul', { className: 'solution-list' });
    if (isSolved) {
      result.values.forEach((v, i) => {
        const li = el('li');
        li.append(el('span', { text: varName('x', i + 1) }));
        li.append(el('span', { className: 'key-val', text: this.fmt(v) }));
        ul.append(li);
      });
    } else if (result.status === 'infeasible') {
      ul.append(el('li', {
        text: 'No hay punto factible: las restricciones se contradicen. No se reportan Xⱼ ni Z óptimos.',
      }));
    } else if (result.status === 'unbounded') {
      ul.append(el('li', {
        text: 'Z puede crecer (o decrecer) sin límite. No hay óptimo finito que reportar.',
      }));
    } else {
      ul.append(el('li', { text: 'No hay solución óptima que reportar.' }));
    }
    left.append(ul);

    if (isSolved && result.slacks && Object.keys(result.slacks).length > 0) {
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
      if (result.excesses && Object.keys(result.excesses).length > 0) {
        Object.entries(result.excesses).forEach(([name, val]) => {
          const li = el('li');
          li.append(el('span', { text: name }));
          li.append(el('span', { className: 'key-val', text: this.fmt(val) }));
          ulS.append(li);
        });
      }
      left.append(ulS);
    }

    if (isSolved && result.shadowPrices && Object.keys(result.shadowPrices).length > 0) {
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
        li.append(el('span', { text: varName('x', i + 1) }));
        li.append(el('span', { className: 'key-val', text: this.fmt(v) }));
        ul2.append(li);
      });
      left.append(ul2);
    }

    if (result.verification?.length) {
      left.append(el('h3', {
        text: isSolved ? 'Verificación de restricciones' : 'Diagnóstico de restricciones',
        className: 'subhead',
      }));

      if (!isSolved) {
        left.append(el('p', {
          className: 'verify-note',
          text: result.status === 'unbounded'
            ? 'El último vértice de la tabla sí cumple las restricciones. El problema no tiene óptimo porque, desde ahí, Z puede seguir mejorando sin límite.'
            : 'Se evalúan las restricciones originales en el último punto de la tabla. «Incumplida» señala el conflicto.',
        }));
      }

      const violated = result.verification.filter((v) => !v.satisfied);
      if (violated.length && result.status === 'infeasible') {
        const diag = el('div', { className: 'verify-conflict' });
        diag.append(el('p', {
          className: 'verify-conflict-title',
          text: `${violated.length} restricción(es) en conflicto:`,
        }));
        const dList = el('ul');
        violated.forEach((v) => {
          dList.append(el('li', {
            text: `R${v.index}: LHS = ${this.fmt(v.lhs)}  ${opSymbol(v.op)}  ${this.fmt(v.rhs)}  → no se cumple`,
          }));
        });
        diag.append(dList);
        left.append(diag);
      }

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
        let estado;
        let estadoClass;
        if (!v.satisfied) {
          estado = '✗ Incumplida';
          estadoClass = 'estado-bad';
        } else if (v.active) {
          estado = '● Activa';
          estadoClass = 'estado-active';
        } else {
          estado = '○ Holgada';
          estadoClass = 'estado-ok';
        }
        tb.append(el('tr', {
          className: v.satisfied ? '' : 'is-violated',
        }, [
          el('td', { text: String(v.index) }),
          el('td', { text: this.fmt(v.lhs) }),
          el('td', { text: opSymbol(v.op) }),
          el('td', { text: this.fmt(v.rhs) }),
          el('td', { className: estadoClass, text: estado }),
        ]));
      });
      vt.append(tb);
      left.append(vt);
    }

    root.append(left);

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

  beat(n, kicker, title, text, extra) {
    const card = el('div', { className: 'beat-card' });
    card.append(el('p', { className: 'beat-kicker', text: kicker }));
    if (title) card.append(el('p', { className: 'beat-title', text: title }));
    if (text) card.append(el('p', { className: 'beat-text', text }));
    if (extra) card.append(extra);
    const row = el('section', { className: 'beat', style: `animation-delay:${(n - 1) * 80}ms` });
    row.append(el('span', { className: 'beat-index', text: String(n), 'aria-hidden': 'true' }));
    row.append(card);
    return row;
  }

  zNegatives(tableau) {
    const found = [];
    tableau.zRow.forEach((cell, j) => {
      if (!cell.isNegative()) return;
      if (tableau.basic.includes(tableau.colNames[j])) return;
      found.push({ name: tableau.colNames[j], coef: cell });
    });
    return found;
  }

  renderStartGuide(step, result) {
    const guide = el('div', { className: 'guide-grid' });
    const holguras = step.tableau.basic.filter((name) => name.startsWith('h'));
    const zBits = [];
    for (let j = 0; j < result.numVars; j++) {
      zBits.push(`${step.tableau.colNames[j]} aparece como ${this.fmt(step.tableau.zRow[j])}`);
    }
    const cards = [
      ['Las holguras', holguras.length
        ? `Cada restricción ≤ se vuelve igualdad sumando una h. Aquí empiezan en la base: ${holguras.join(', ')}.`
        : 'Si hay ≥ o =, la base inicial usa excesos E y artificiales A. Esas artificiales tienen que valer 0 al final.'],
      ['La fila Z', `La función objetivo se pasa al otro lado, por eso cambia de signo. ${zBits.join(' y ')}.`],
      ['Cuándo parar', 'Mientras Z tenga un número negativo, se puede mejorar. Cuando ya no quede ninguno, esa tabla es la solución.'],
    ];
    cards.forEach(([title, body]) => {
      const card = el('article', { className: 'guide-card' });
      card.append(el('p', { className: 'beat-kicker', text: title }));
      card.append(el('p', { className: 'beat-text', text: body }));
      guide.append(card);
    });
    const wrap = el('div', { className: 'walk-block' });
    wrap.append(guide);
    const setup = (step.notes || []).filter((n) => n && !/optimalidad|coeficiente más negativo/i.test(n));
    if (setup.length) {
      const note = el('div', { className: 'setup-notes' });
      setup.forEach((n) => note.append(el('p', { text: n })));
      wrap.append(note);
    }
    return wrap;
  }

  renderRatioBoard(step) {
    const board = el('div', { className: 'ratio-board' });
    const winner = step.ratios.find((r) => r.row === step.pivotRow);
    const tied = !!(winner?.ratio && step.ratios.some((r) => (
      r.eligible && r.row !== winner.row && r.ratio && r.ratio.equals(winner.ratio)
    )));
    step.ratios.forEach((r) => {
      const isBest = step.pivotRow === r.row;
      const chip = el('div', { className: `ratio-chip${isBest ? ' is-winner' : ''}${r.eligible ? '' : ' is-skip'}` });
      chip.append(el('span', { className: 'ratio-who', text: r.basic }));
      if (r.eligible && r.rhs && r.coef) {
        chip.append(el('span', { className: 'ratio-math', text: `${this.fmt(r.rhs)} ÷ ${this.fmt(r.coef)}` }));
        chip.append(el('span', { className: 'ratio-eq', text: `= ${this.fmt(r.ratio)}` }));
        chip.append(el('span', {
          className: 'ratio-tag',
          text: isBest
            ? (tied ? 'Sale · hay empate y se elige esta' : 'Sale · es la razón menor')
            : 'Se queda',
        }));
      } else {
        chip.append(el('span', {
          className: 'ratio-tag',
          text: r.coef && r.coef.isZero()
            ? 'No participa · el coeficiente es 0'
            : 'No participa · el coeficiente no es positivo',
        }));
      }
      board.append(chip);
    });
    return board;
  }

  /** Misma aritmética que el pivote del motor, solo para mostrar los números. */
  rowWork(before, pivotRow, pivotCol) {
    const names = [...before.colNames, 'L.D.'];
    const pack = (cells, rhs) => [...cells, rhs];
    const p = before.matrix[pivotRow][pivotCol].c;
    const newPivot = before.matrix[pivotRow].map((c) => c.div(p));
    const newRhs = before.rhs[pivotRow].div(p);
    const works = [{
      kind: 'div',
      sign: `÷ ${this.fmt(p)}`,
      fromLabel: `Fila ${before.basic[pivotRow]}`,
      from: pack(before.matrix[pivotRow], before.rhs[pivotRow]),
      to: pack(newPivot, newRhs),
    }];

    for (let i = 0; i < before.matrix.length; i++) {
      if (i === pivotRow) continue;
      const factor = before.matrix[i][pivotCol].c;
      if (factor.isZero()) continue;
      const shown = factor.isNegative() ? factor.neg() : factor;
      const toCells = before.matrix[i].map((c, j) => c.sub(newPivot[j].mul(factor)));
      const toRhs = before.rhs[i].sub(newRhs.mul(factor));
      works.push({
        kind: factor.isNegative() ? 'add' : 'sub',
        sign: `${factor.isNegative() ? '+' : '−'} ${this.fmt(shown)} ×`,
        fromLabel: `Fila ${before.basic[i]}`,
        from: pack(before.matrix[i], before.rhs[i]),
        midLabel: 'Fila pivote',
        mid: pack(newPivot, newRhs),
        to: pack(toCells, toRhs),
      });
    }

    const zFactor = before.zRow[pivotCol];
    if (!zFactor.isZero()) {
      const shown = zFactor.isNegative() ? zFactor.neg() : zFactor;
      const toZ = before.zRow.map((c, j) => {
        const pr = newPivot[j].c;
        return c.sub(new BigCoeff(zFactor.m.mul(pr), zFactor.c.mul(pr)));
      });
      const prRhs = newRhs.c;
      const toZRhs = before.zRhs.sub(new BigCoeff(zFactor.m.mul(prRhs), zFactor.c.mul(prRhs)));
      works.push({
        kind: zFactor.isNegative() ? 'add' : 'sub',
        sign: `${zFactor.isNegative() ? '+' : '−'} ${this.fmt(shown)} ×`,
        fromLabel: 'Fila Z',
        from: pack(before.zRow, before.zRhs),
        midLabel: 'Fila pivote',
        mid: pack(newPivot, newRhs),
        to: pack(toZ, toZRhs),
      });
    }
    return { names, focus: pivotCol, works };
  }

  numRow(names, values, focus, mode) {
    const row = el('div', { className: 'num-row' });
    values.forEach((value, j) => {
      const cell = el('span', { className: 'num-cell' });
      if (j === names.length - 1) cell.classList.add('is-ld');
      if (focus != null && j === focus && mode) cell.classList.add(mode);
      cell.append(el('span', { className: 'num-name', text: names[j] }));
      cell.append(el('span', { className: 'num-val', text: this.fmt(value) }));
      row.append(cell);
    });
    return row;
  }

  renderOpsList(step) {
    const ol = el('ol', { className: 'ops-list' });
    const before = step.meta?.before;
    const canShow = before && step.pivotRow != null && step.pivotCol != null;
    const worked = canShow ? this.rowWork(before, step.pivotRow, step.pivotCol) : null;
    step.rowOps.forEach((op, i) => {
      const formula = typeof op === 'string' ? op : op.formula;
      const why = typeof op === 'string' ? '' : op.why;
      let title = 'Esta fila queda en 0';
      if (i === 0) title = 'El pivote pasa a 1';
      else if (String(formula).includes('Fila Z')) title = 'En Z, esa columna queda en 0';
      const li = el('li', { style: `animation-delay:${i * 70}ms` });
      li.append(el('span', { className: 'op-num', text: String(i + 1) }));
      const body = el('div', { className: 'op-body' });
      body.append(el('p', { className: 'op-kicker', text: title }));
      body.append(el('p', { className: 'op-formula', text: formula }));
      if (why) body.append(el('p', { className: 'op-why', text: why }));
      const work = worked?.works[i];
      if (work) {
        const box = el('div', { className: 'op-work' });
        const from = el('div', { className: 'op-line' });
        from.append(el('span', { className: 'op-line-label', text: work.fromLabel }));
        from.append(this.numRow(worked.names, work.from, worked.focus, i === 0 ? 'is-pivot' : 'is-watch'));
        box.append(from);
        if (work.mid) {
          const mid = el('div', { className: 'op-line' });
          mid.append(el('span', { className: 'op-line-label', text: work.sign }));
          const midBody = el('div', { className: 'op-mid' });
          midBody.append(el('span', { className: 'op-mid-name', text: work.midLabel }));
          midBody.append(this.numRow(worked.names, work.mid, worked.focus, 'is-pivot'));
          mid.append(midBody);
          box.append(mid);
        } else {
          const sign = el('div', { className: 'op-line' });
          sign.append(el('span', { className: 'op-line-label is-sign', text: work.sign }));
          box.append(sign);
        }
        const to = el('div', { className: 'op-line is-result' });
        to.append(el('span', { className: 'op-line-label', text: 'Queda' }));
        to.append(this.numRow(worked.names, work.to, worked.focus, i === 0 ? 'is-pivot' : 'is-zero'));
        box.append(to);
        body.append(box);
      }
      li.append(body);
      ol.append(li);
    });
    return ol;
  }

  renderCheckpoint(step, result) {
    const box = el('div', { className: 'checkpoint' });
    const negs = this.zNegatives(step.tableau);
    let kind = 'is-wait';
    let title = 'Todavía no es óptimo';
    let text = '';

    if (step.status === 'optimal' || step.status === 'alternate') {
      kind = 'is-done';
      title = step.status === 'alternate' ? 'Hay más de una solución óptima' : 'Llegamos al óptimo';
      text = 'En la fila Z ya no hay números negativos. Las variables de la base valen lo que dice L.D. Las que no están en la base valen 0.';
    } else if (step.status === 'unbounded') {
      kind = 'is-stop';
      title = 'Z no tiene límite';
      text = step.entering
        ? `${step.entering} mejoraría Z, pero en su columna no hay ningún coeficiente positivo. No se puede armar una razón, así que no hay un óptimo finito.`
        : 'No hay un óptimo finito: Z puede seguir mejorando.';
    } else if (step.status === 'infeasible') {
      kind = 'is-stop';
      title = 'Las restricciones no se pueden cumplir juntas';
      text = 'Quedó una variable artificial con valor positivo. No existe una solución con todas las xⱼ ≥ 0.';
    } else if (!step.entering) {
      title = negs.length ? 'Ahora toca elegir quién entra' : 'Esta tabla ya no mejora';
      text = negs.length
        ? `En Z todavía hay ${negs.map((n) => `${this.fmt(n.coef)} en ${n.name}`).join(', ')}. Pulsa Siguiente.`
        : 'Pulsa Siguiente para ver el cierre de este caso.';
    } else if (negs.length) {
      text = `Después de este pivote, en Z sigue habiendo negativo: ${negs.map((n) => `${this.fmt(n.coef)} en ${n.name}`).join(', ')}. Pulsa Siguiente.`;
    } else {
      kind = 'is-done';
      title = 'La fila Z ya no tiene negativos';
      text = 'Con esta tabla se cierra el procedimiento.';
    }

    box.classList.add(kind);
    box.append(el('p', { className: 'checkpoint-title', text: title }));
    if (text) box.append(el('p', { className: 'beat-text', text }));

    if (step.status === 'optimal' || step.status === 'alternate') {
      const list = el('ul', { className: 'answer-list' });
      for (let i = 0; i < result.numVars; i++) {
        const name = step.tableau.colNames[i];
        const row = step.tableau.basic.indexOf(name);
        const value = row >= 0 ? this.fmt(step.tableau.rhs[row]) : '0';
        const li = el('li');
        li.append(el('span', { text: name }));
        li.append(el('span', { className: 'key-val', text: value }));
        list.append(li);
      }
      const zShow = result.originalSense === 'min' ? this.fmt(result.z) : this.fmt(step.tableau.zRhs);
      const zLi = el('li');
      zLi.append(el('span', { text: 'Z' }));
      zLi.append(el('span', { className: 'key-val', text: zShow }));
      list.append(zLi);
      box.append(list);
      if (result.originalSense === 'min') {
        box.append(el('p', {
          className: 'beat-text',
          text: `En la tabla, el L.D. de Z es ${this.fmt(step.tableau.zRhs)} porque se maximizó −Z. El valor del problema es ${zShow}.`,
        }));
      }
    }

    const extras = (step.notes || []).filter((n) => /empate|Bland|degener/i.test(n));
    extras.forEach((n) => box.append(el('p', { className: 'beat-text', text: n })));
    return box;
  }

  renderStep(root, result) {
    const idx = this.state.stepIndex;
    const step = result.steps[idx];
    const total = result.steps.length;
    const pct = total > 1 ? Math.round((idx / (total - 1)) * 100) : 100;

    const chrome = el('div', { className: 'step-chrome' });
    const prog = el('div', { className: 'step-progress' });
    prog.append(document.createTextNode(`Paso ${idx + 1} de ${total}`));
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

    if (idx === 0 && !step.entering) root.append(this.renderStartGuide(step, result));

    const beforeTableau = step.meta?.before && step.pivotCol != null ? step.meta.before : null;
    const source = beforeTableau || step.tableau;
    let enterCoef = null;
    if (step.entering && step.pivotCol != null) {
      enterCoef = source.zRow[step.pivotCol];
    }

    root.append(this.renderTableau(source, {
      pivotCol: step.pivotCol,
      pivotRow: beforeTableau ? step.pivotRow : null,
      showNegZ: true,
      ratios: step.ratios,
    }, beforeTableau ? 'Tabla de este paso' : step.title));

    if (step.pivotCol != null && step.pivotRow != null) {
      root.append(el('p', {
        className: 'table-hint',
        text: 'La columna verde es la que entra. La fila azul es la que sale. La celda oscura es el pivote.',
      }));
    }

    const walk = el('div', { className: 'walk' });
    let n = 1;
    if (step.entering && enterCoef) {
      walk.append(this.beat(
        n,
        'Quién entra',
        `Entra ${step.entering}`,
        `En la fila Z, el número más negativo es ${this.fmt(enterCoef)}. Está en la columna ${step.entering}. Esa es la variable que más mejora Z.`,
      ));
      n += 1;
    }
    if (step.ratios?.length) {
      const ratioText = step.pivotRow == null
        ? `La razón es L.D. ÷ el coeficiente de ${step.entering || 'la columna'}. Solo vale si ese coeficiente es positivo.`
        : `En la columna de ${step.entering} se divide el lado derecho entre el coeficiente. La razón más pequeña dice quién sale.`;
      walk.append(this.beat(n, 'Prueba de razón', 'L.D. ÷ coeficiente', ratioText, this.renderRatioBoard(step)));
      n += 1;
    }
    if (step.entering || step.leaving || step.pivotValue) {
      const cards = el('div', { className: 'pivot-cards' });
      cards.append(
        this.makePivotCard('Entra', step.entering || '—', 'is-enter', 'La más negativa de Z'),
        this.makePivotCard('Sale', step.leaving || '—', 'is-leave', step.leaving ? 'La razón más pequeña' : 'No hay fila que pueda salir'),
        this.makePivotCard('Pivote', step.pivotValue ? this.fmt(step.pivotValue) : '—', 'is-pivot', 'Donde se cruzan fila y columna'),
      );
      walk.append(cards);
    }
    if (step.rowOps?.length) {
      walk.append(this.beat(
        n,
        'Operaciones de fila',
        'Así se arma la tabla nueva',
        'Primero el pivote queda en 1. Después, en cada otra fila, esa columna queda en 0.',
        this.renderOpsList(step),
      ));
    }
    if (walk.childNodes.length) root.append(walk);

    if (beforeTableau && step.rowOps?.length) {
      root.append(this.renderTableau(step.tableau, { showNegZ: true }, 'Tabla que queda'));
    }

    root.append(this.renderCheckpoint(step, result));
  }

  makePivotCard(label, value, cls, hint) {
    const card = el('div', { className: `pivot-card ${cls}` });
    card.append(el('div', { className: 'pc-label', text: label }));
    card.append(el('div', { className: 'pc-value', text: value }));
    if (hint) card.append(el('p', { className: 'pc-hint', text: hint }));
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
      if (i === 0 && !step.entering) block.append(this.renderStartGuide(step, result));
      const beforeTableau = step.meta?.before && step.pivotCol != null ? step.meta.before : null;
      if (beforeTableau) {
        block.append(this.renderTableau(beforeTableau, {
          pivotCol: step.pivotCol,
          pivotRow: step.pivotRow,
          showNegZ: true,
          ratios: step.ratios,
        }, 'Tabla de este paso'));
      }
      if (step.ratios?.length) {
        const boardBeat = this.beat(1, 'Prueba de razón', step.entering ? `Entra ${step.entering}` : 'Razones', step.leaving
          ? `Sale ${step.leaving}. La razón menor es la que deja la base.`
          : 'Ninguna fila tiene coeficiente positivo, así que no hay quién salga.', this.renderRatioBoard(step));
        block.append(boardBeat);
      }
      if (step.rowOps?.length) {
        block.append(this.beat(2, 'Operaciones de fila', 'Así cambia la tabla', 'El pivote pasa a 1 y el resto de esa columna pasa a 0.', this.renderOpsList(step)));
      }
      if (!beforeTableau || step.rowOps?.length) {
        block.append(this.renderTableau(step.tableau, { showNegZ: true }, beforeTableau ? 'Tabla que queda' : step.title));
      }
      block.append(this.renderCheckpoint(step, result));
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
    hr.append(el('th', { className: 'col-rhs', text: 'L.D.' }));
    const ratios = Array.isArray(highlight.ratios) ? highlight.ratios : null;
    if (ratios) hr.append(el('th', { className: 'col-ratio', text: 'R' }));
    thead.append(hr);
    table.append(thead);

    const tbody = el('tbody');

    // Fila Z primero, como en el material (fila 1 de la tabla)
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
    if (ratios) zr.append(el('td', { className: 'col-ratio', text: '—' }));
    tbody.append(zr);

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
      if (ratios) {
        const hit = ratios.find((r) => r.row === i);
        const show = hit && hit.eligible && hit.ratio;
        tr.append(el('td', {
          className: show && highlight.pivotRow === i ? 'col-ratio is-best-ratio' : 'col-ratio',
          text: show ? this.fmt(hit.ratio) : '—',
        }));
      }
      tbody.append(tr);
    });

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
