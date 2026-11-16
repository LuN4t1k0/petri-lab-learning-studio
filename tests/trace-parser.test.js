import test from 'node:test';
import assert from 'node:assert/strict';

import { parseTraceLanguage, TraceParseError } from '../src/core/trace-parser.js';

test('expande exponentes y acepta ambos tipos de delimitadores', () => {
  const log = parseTraceLanguage('<a,b,c,d>^3\n⟨a, c, b, d⟩⁴');

  assert.equal(log.totalCases, 7);
  assert.deepEqual(log.activities, ['a', 'b', 'c', 'd']);
  assert.deepEqual(log.variants, [
    { activities: ['a', 'b', 'c', 'd'], frequency: 3 },
    { activities: ['a', 'c', 'b', 'd'], frequency: 4 },
  ]);
  assert.equal(log.traces.length, 7);
});

test('acumula la frecuencia de variantes duplicadas', () => {
  const log = parseTraceLanguage('<a,b>^2\n<a,b>^3');
  assert.deepEqual(log.variants, [{ activities: ['a', 'b'], frequency: 5 }]);
  assert.equal(log.totalCases, 5);
});

test('rechaza entrada vacía y exponentes no positivos indicando la línea', () => {
  assert.throws(() => parseTraceLanguage('   '), TraceParseError);
  assert.throws(
    () => parseTraceLanguage('<a,b>\n<c,d>^0'),
    (error) => error instanceof TraceParseError && error.line === 2 && /positivo/.test(error.message),
  );
  assert.throws(
    () => parseTraceLanguage('<a,b>^-2'),
    (error) => error instanceof TraceParseError && error.line === 1,
  );
});

test('rechaza actividades vacías y conserva etiquetas repetidas', () => {
  assert.throws(() => parseTraceLanguage('<a,,b>'), TraceParseError);
  const log = parseTraceLanguage('<a,b,a>');
  assert.deepEqual(log.traces[0], ['a', 'b', 'a']);
});

test('rechaza registros que expandirían demasiados casos en el navegador', () => {
  assert.throws(
    () => parseTraceLanguage('<a,b>^10001'),
    (error) => error instanceof TraceParseError && /10.000/.test(error.message),
  );
});
