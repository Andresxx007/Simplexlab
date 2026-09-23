/**
 * Aritmética exacta con fracciones (BigInt) y coeficientes Big-M.
 * Signo siempre en el numerador; siempre simplificadas.
 */

function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export class Fraction {
  /**
   * @param {bigint|number|string} num
   * @param {bigint|number|string} [den=1]
   */
  constructor(num, den = 1n) {
    let n = typeof num === 'bigint' ? num : BigInt(num);
    let d = typeof den === 'bigint' ? den : BigInt(den);
    if (d === 0n) throw new Error('Denominador cero');
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d);
    this.n = n / g;
    this.d = d / g;
  }

  static zero() {
    return new Fraction(0n);
  }

  static one() {
    return new Fraction(1n);
  }

  static from(value) {
    if (value instanceof Fraction) return value;
    if (value instanceof BigCoeff) return value; // caller should not do this
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('Número no finito');
      return Fraction.fromDecimal(value);
    }
    if (typeof value === 'bigint') return new Fraction(value);
    if (typeof value === 'string') return Fraction.parse(value);
    throw new Error('Tipo no convertible a fracción');
  }

  /** Convierte decimal IEEE a fracción exacta vía string cuando es posible. */
  static fromDecimal(x) {
    if (Number.isInteger(x)) return new Fraction(BigInt(x));
    const s = String(x);
    if (s.includes('e') || s.includes('E')) {
      // Fallback racional aproximado controlado
      const abs = Math.abs(x);
      const den = 1e12;
      const num = Math.round(abs * den);
      return new Fraction(BigInt(x < 0 ? -num : num), BigInt(den));
    }
    return Fraction.parse(s.replace(',', '.'));
  }

  /**
   * Acepta: enteros, decimales con . o ,, fracciones a/b, signos.
   * @param {string} raw
   * @returns {Fraction}
   */
  static parse(raw) {
    const s = String(raw).trim().replace(/\s+/g, '');
    if (!s) throw new Error('Vacío');

    const fracMatch = s.match(/^([+-]?\d+)\/([+-]?\d+)$/);
    if (fracMatch) {
      return new Fraction(BigInt(fracMatch[1]), BigInt(fracMatch[2]));
    }

    const normalized = s.replace(',', '.');
    const decMatch = normalized.match(/^([+-]?\d+)(?:\.(\d+))?$/);
    if (decMatch) {
      const intPart = decMatch[1];
      const fracPart = decMatch[2] || '';
      if (!fracPart) return new Fraction(BigInt(intPart));
      const den = 10n ** BigInt(fracPart.length);
      const sign = intPart.startsWith('-') ? -1n : 1n;
      const absInt = BigInt(intPart.startsWith('+') || intPart.startsWith('-') ? intPart.slice(1) || '0' : intPart);
      const num = sign * (absInt * den + BigInt(fracPart));
      return new Fraction(num, den);
    }

    throw new Error(`Número no válido: ${raw}`);
  }

  add(other) {
    const o = Fraction.from(other);
    return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d);
  }

  sub(other) {
    const o = Fraction.from(other);
    return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d);
  }

  mul(other) {
    const o = Fraction.from(other);
    return new Fraction(this.n * o.n, this.d * o.d);
  }

  div(other) {
    const o = Fraction.from(other);
    if (o.n === 0n) throw new Error('División por cero');
    return new Fraction(this.n * o.d, this.d * o.n);
  }

  neg() {
    return new Fraction(-this.n, this.d);
  }

  abs() {
    return this.n < 0n ? this.neg() : this;
  }

  isZero() {
    return this.n === 0n;
  }

  isPositive() {
    return this.n > 0n;
  }

  isNegative() {
    return this.n < 0n;
  }

  compare(other) {
    const o = Fraction.from(other);
    const left = this.n * o.d;
    const right = o.n * this.d;
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }

  equals(other) {
    return this.compare(other) === 0;
  }

  lt(other) {
    return this.compare(other) < 0;
  }

  lte(other) {
    return this.compare(other) <= 0;
  }

  gt(other) {
    return this.compare(other) > 0;
  }

  gte(other) {
    return this.compare(other) >= 0;
  }

  toNumber() {
    return Number(this.n) / Number(this.d);
  }

  /**
   * @param {'fraction'|'decimal'} mode
   * @param {number} decimals
   */
  toString(mode = 'fraction', decimals = 3) {
    if (mode === 'decimal') {
      const v = this.toNumber();
      const fixed = v.toFixed(decimals);
      return fixed.replace(/\.?0+$/, '') || '0';
    }
    if (this.d === 1n) return this.n.toString();
    return `${this.n}/${this.d}`;
  }

  toJSON() {
    return { n: this.n.toString(), d: this.d.toString() };
  }

  static fromJSON(obj) {
    return new Fraction(BigInt(obj.n), BigInt(obj.d));
  }

  clone() {
    return new Fraction(this.n, this.d);
  }
}

/**
 * Coeficiente de la forma m·M + c (método de la M grande).
 */
export class BigCoeff {
  /**
   * @param {Fraction|bigint|number|string} mPart
   * @param {Fraction|bigint|number|string} [cPart=0]
   */
  constructor(mPart = 0, cPart = 0) {
    this.m = mPart instanceof Fraction ? mPart : Fraction.from(mPart);
    this.c = cPart instanceof Fraction ? cPart : Fraction.from(cPart);
  }

  static zero() {
    return new BigCoeff(0, 0);
  }

  static fromFraction(f) {
    return new BigCoeff(0, f instanceof Fraction ? f : Fraction.from(f));
  }

  static from(value) {
    if (value instanceof BigCoeff) return value;
    return BigCoeff.fromFraction(value);
  }

  add(other) {
    const o = BigCoeff.from(other);
    return new BigCoeff(this.m.add(o.m), this.c.add(o.c));
  }

  sub(other) {
    const o = BigCoeff.from(other);
    return new BigCoeff(this.m.sub(o.m), this.c.sub(o.c));
  }

  mul(scalar) {
    const s = Fraction.from(scalar);
    return new BigCoeff(this.m.mul(s), this.c.mul(s));
  }

  div(scalar) {
    const s = Fraction.from(scalar);
    return new BigCoeff(this.m.div(s), this.c.div(s));
  }

  neg() {
    return new BigCoeff(this.m.neg(), this.c.neg());
  }

  isZero() {
    return this.m.isZero() && this.c.isZero();
  }

  isNegative() {
    return this.compare(BigCoeff.zero()) < 0;
  }

  isPositive() {
    return this.compare(BigCoeff.zero()) > 0;
  }

  /** Compara primero la parte M, luego la constante. */
  compare(other) {
    const o = BigCoeff.from(other);
    const cm = this.m.compare(o.m);
    if (cm !== 0) return cm;
    return this.c.compare(o.c);
  }

  equals(other) {
    return this.compare(other) === 0;
  }

  /**
   * @param {'fraction'|'decimal'} mode
   * @param {number} decimals
   */
  toString(mode = 'fraction', decimals = 3) {
    const fmt = (f) => f.toString(mode, decimals);
    const hasM = !this.m.isZero();
    const hasC = !this.c.isZero();

    if (!hasM && !hasC) return '0';
    if (!hasM) return fmt(this.c);

    let mStr;
    if (this.m.equals(1)) mStr = 'M';
    else if (this.m.equals(-1)) mStr = '−M';
    else mStr = `${fmt(this.m)}M`;

    if (!hasC) return mStr;

    const cAbs = this.c.abs();
    const cStr = fmt(cAbs);
    if (this.c.isPositive()) return `${mStr} + ${cStr}`;
    return `${mStr} − ${cStr}`;
  }

  toJSON() {
    return { m: this.m.toJSON(), c: this.c.toJSON() };
  }

  static fromJSON(obj) {
    return new BigCoeff(Fraction.fromJSON(obj.m), Fraction.fromJSON(obj.c));
  }

  clone() {
    return new BigCoeff(this.m.clone(), this.c.clone());
  }

  /** Parte constante (para RHS sin M en filas de restricciones). */
  asFraction() {
    if (!this.m.isZero()) {
      throw new Error('No se puede convertir un coeficiente con M a fracción simple');
    }
    return this.c.clone();
  }
}

/**
 * Intenta parsear entrada de usuario a Fraction.
 * @param {string} raw
 * @returns {{ ok: true, value: Fraction } | { ok: false, error: string }}
 */
export function tryParseFraction(raw) {
  try {
    if (raw === null || raw === undefined) {
      return { ok: false, error: 'Valor vacío' };
    }
    const s = String(raw).trim();
    if (s === '') {
      return { ok: false, error: 'Valor vacío' };
    }
    return { ok: true, value: Fraction.parse(s) };
  } catch (e) {
    return { ok: false, error: e.message || 'Número no válido' };
  }
}
