/**
 * Explicador: convierte pasos del motor en texto didáctico en español.
 */

import { varName } from './engine.js';

const STATUS_COPY = {
  optimal: {
    title: 'Solución óptima',
    body: 'Se encontró una solución factible que optimiza la función objetivo.',
  },
  unbounded: {
    title: 'Problema no acotado',
    body: 'La función objetivo puede mejorar indefinidamente dentro de la región factible.',
  },
  infeasible: {
    title: 'Problema infactible',
    body: 'No existe ningún punto que cumpla todas las restricciones a la vez.',
  },
  alternate: {
    title: 'Óptimos alternativos',
    body: 'Hay más de una solución óptima. El valor de Z es el mismo en todas ellas.',
  },
  continue: {
    title: 'En proceso',
    body: 'El algoritmo aún no ha terminado.',
  },
};

export function statusCopy(status) {
  return STATUS_COPY[status] || STATUS_COPY.continue;
}

export function explainStep(step, index, total) {
  const parts = [];

  if (index === 0) {
    parts.push('Se construyó la tabla inicial en forma estándar y canónica.');
  }

  if (step.entering && step.leaving) {
    parts.push(
      `Se eligió ${step.entering} como variable entrante y ${step.leaving} como saliente.`
    );
  } else if (step.entering && step.status === 'unbounded') {
    parts.push(
      `${step.entering} mejora Z, pero no hay fila con coeficiente positivo: el problema no está acotado.`
    );
  }

  if (step.ratios && step.ratios.length) {
    const eligible = step.ratios.filter((r) => r.eligible);
    const skipped = step.ratios.filter((r) => !r.eligible);
    if (eligible.length) {
      parts.push(
        `Prueba de razón: ${eligible.map((r) => `${r.basic} → ${r.ratio.toString()}`).join('; ')}.`
      );
    }
    if (skipped.length) {
      parts.push(
        `No participan: ${skipped.map((r) => `${r.basic} (${r.note})`).join('; ')}.`
      );
    }
  }

  if (step.degeneracy) {
    parts.push('Advertencia de degeneración: alguna variable básica vale cero o hubo empate en razones.');
  }

  (step.notes || []).forEach((n) => parts.push(n));

  return {
    progress: `Paso ${index + 1} de ${total}`,
    paragraphs: parts,
    status: statusCopy(step.status),
  };
}

export function explainSolution(result, displayMode = 'fraction') {
  const fmt = (f) => (f && typeof f.toString === 'function' ? f.toString(displayMode) : String(f));
  const lines = [];

  if (result.status === 'optimal' || result.status === 'alternate') {
    const sense = result.originalSense === 'min' ? 'mínimo' : 'máximo';
    lines.push(`Valor ${sense} de Z = ${fmt(result.z)}.`);
    result.values.forEach((v, i) => {
      lines.push(`${varName('X', i + 1)} = ${fmt(v)}`);
    });
  }

  if (result.slacks && Object.keys(result.slacks).length) {
    Object.entries(result.slacks).forEach(([name, val]) => {
      if (val.isZero()) {
        lines.push(`${name} = 0 → el recurso asociado se agota (restricción activa).`);
      } else {
        lines.push(`${name} = ${fmt(val)} → sobra ese recurso.`);
      }
    });
  }

  if (result.shadowPrices && Object.keys(result.shadowPrices).length) {
    Object.entries(result.shadowPrices).forEach(([name, val]) => {
      lines.push(
        `Precio sombra de ${name}: ${fmt(val)} → cuánto mejora Z por cada unidad extra de ese recurso (en el entorno local).`
      );
    });
  }

  return lines;
}

export const GLOSSARY = {
  holgura:
    'Variable que convierte una restricción ≤ en igualdad. Si vale más que cero, el recurso sobra.',
  exceso:
    'Variable que convierte una restricción ≥ en igualdad. Mide cuánto se supera el mínimo exigido.',
  artificial:
    'Variable auxiliar que permite arrancar con una base factible artificial. Debe valer cero al final.',
  base:
    'Conjunto de variables básicas (una por restricción). Sus columnas forman una identidad en la tabla.',
  pivote:
    'Elemento de la tabla en la intersección de la fila saliente y la columna entrante. Con él se hacen las operaciones de fila.',
  razon:
    'Cociente lado derecho / coeficiente de la columna entrante. La menor razón positiva indica la variable que sale.',
  degeneracion:
    'Situación en la que una variable básica vale cero, a menudo por empate en la prueba de razón.',
  'precio sombra':
    'Valor dual de un recurso: mejora marginal de Z si el lado derecho de esa restricción aumenta en una unidad.',
};
