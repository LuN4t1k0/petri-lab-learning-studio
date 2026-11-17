import test from 'node:test';
import assert from 'node:assert/strict';

import { parseTraceLanguage } from '../src/core/trace-parser.js';
import { explainAlpha } from '../src/miners/alpha-miner.js';

const L5 = `<a,b,e,f>^2
<a,b,e,c,d,b,f>^3
<a,b,c,e,d,b,f>^2
<a,b,c,d,e,b,f>^4
<a,e,b,c,d,b,f>^3`;

test('explica L5 desde sus variantes y frecuencias', () => {
  const lesson = explainAlpha(parseTraceLanguage(L5));

  assert.equal(lesson.totalCases, 14);
  assert.equal(lesson.variants.length, 5);
  assert.deepEqual(lesson.variants[0], {
    index: 1,
    activities: ['a', 'b', 'e', 'f'],
    frequency: 2,
  });
  assert.deepEqual(lesson.TL, ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.deepEqual(lesson.TI, ['a']);
  assert.deepEqual(lesson.TO, ['f']);
});

test('reúne Directly Follows con evidencia sin duplicar el conjunto', () => {
  const lesson = explainAlpha(parseTraceLanguage(L5));
  const direct = lesson.directlyFollows.find((relation) => relation.key === 'a > b');

  assert.ok(direct);
  assert.equal(lesson.directlyFollows.filter((relation) => relation.key === 'a > b').length, 1);
  assert.equal(direct.caseCount, 11);
  assert.equal(direct.occurrenceCount, 11);
  assert.deepEqual(direct.evidence.map((item) => item.variantIndex), [1, 2, 3, 4]);
  assert.deepEqual(direct.evidence[0].positions, [1]);
});

test('expone causalidad, paralelismo y no relación antes de XL', () => {
  const lesson = explainAlpha(parseTraceLanguage(L5));

  assert.ok(lesson.relationSets.causality.includes('a → b'));
  assert.ok(lesson.relationSets.parallel.includes('b ∥ e'));
  assert.ok(lesson.relationSets.unrelated.includes('a # c'));
  assert.equal(lesson.footprint.b.e, '∥');
  assert.equal(lesson.footprint.a.c, '#');
});

test('ordena la lección desde event log hasta Workflow Net', () => {
  const lesson = explainAlpha(parseTraceLanguage(L5));

  assert.deepEqual(
    lesson.steps.map((step) => step.key),
    ['log', 'direct', 'footprint', 'XL', 'YL', 'PL', 'FL', 'alpha'],
  );
});

