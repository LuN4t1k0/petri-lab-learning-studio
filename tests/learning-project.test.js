import test from 'node:test';
import assert from 'node:assert/strict';

import { appendTraceToLanguage, evidenceSummary, serializeTrace } from '../src/core/learning-project.js';

test('serializa una ejecución como traza del event log', () => {
  assert.equal(serializeTrace(['registrar', 'validar', 'aprobar']), '<registrar,validar,aprobar>');
});

test('agregar una ejecución acumula la frecuencia de una variante existente', () => {
  assert.equal(appendTraceToLanguage('<a,b>^2\n<a,c>', ['a', 'b']), '<a,b>^3\n<a,c>');
});

test('resume evidencia estática y dinámica en lenguaje pedagógico', () => {
  const summary = evidenceSummary(
    { isPetriNet: true, isWorkflowNet: true, checks: [{ passed: true }, { passed: true }] },
    { finalReachable: true, deadTransitions: [], residualTokensAtFinal: false, truncated: false },
  );
  assert.equal(summary.level, 'correct');
  assert.match(summary.title, /Workflow Net/i);
  assert.equal(summary.score, 100);
});
