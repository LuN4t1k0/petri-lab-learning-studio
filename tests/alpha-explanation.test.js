import test from 'node:test';
import assert from 'node:assert/strict';

import { parseTraceLanguage } from '../src/core/trace-parser.js';
import { explainAlpha } from '../src/miners/alpha-miner.js';
import { L5_LOG, L5_REFERENCE } from './fixtures/alpha-l5-reference.js';

const L5 = L5_LOG;

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

test('explica por qué un candidato pertenece a XL', () => {
  const lesson = explainAlpha(parseTraceLanguage(L5));
  const candidate = lesson.candidateExplanations.find((item) => item.key === '{a,d}→{b}');

  assert.deepEqual(candidate.causalRelations, ['a → b', 'd → b']);
  assert.deepEqual(candidate.inputUnrelated, ['a # d']);
  assert.deepEqual(candidate.outputUnrelated, []);
});

test('explica qué maximal contiene a cada candidato descartado de YL', () => {
  const lesson = explainAlpha(parseTraceLanguage(L5));
  const discarded = lesson.maximality.find((item) => item.key === '{a}→{b}');

  assert.equal(discarded.isMaximal, false);
  assert.deepEqual(discarded.containedBy, ['{a,d}→{b}']);
});

test('vincula lugares y arcos con la regla que los origina', () => {
  const lesson = explainAlpha(parseTraceLanguage(L5));
  const place = lesson.placeExplanations.find((item) => item.place === 'p({a,d}→{b})');
  const initialArc = lesson.flowExplanations.find((item) => item.arc === 'i_L→a');
  const internalArc = lesson.flowExplanations.find((item) => item.arc === 'a→p({a,d}→{b})');

  assert.equal(place.kind, 'derived');
  assert.equal(place.pairKey, '{a,d}→{b}');
  assert.equal(initialArc.rule, 'a ∈ TI');
  assert.equal(internalArc.rule, 'a ∈ A de {a,d}→{b}');
});

test('detecta bucles cortos que Alpha clásico no representa correctamente', () => {
  const oneLoop = explainAlpha(parseTraceLanguage('<a,a,b>'));
  const twoLoop = explainAlpha(parseTraceLanguage('<a,b,a,c>'));

  assert.deepEqual(oneLoop.limitations.shortLoopsOne, [
    { activity: 'a', variantIndex: 1, positions: [1] },
  ]);
  assert.deepEqual(twoLoop.limitations.shortLoopsTwo, [
    { left: 'a', middle: 'b', variantIndex: 1, positions: [1] },
  ]);
});

test('expone las dimensiones conceptuales para evaluar el modelo descubierto', () => {
  const lesson = explainAlpha(parseTraceLanguage(L5));

  assert.deepEqual(lesson.conformanceDimensions.map((item) => item.key), [
    'fitness', 'precision', 'generalization', 'simplicity',
  ]);
});

test('coincide exactamente con el ejercicio L5 de las páginas 34 a 38', () => {
  const lesson = explainAlpha(parseTraceLanguage(L5));

  assert.deepEqual(lesson.directlyFollows.map((relation) => relation.key), L5_REFERENCE.directlyFollows);
  assert.deepEqual(lesson.relationSets.causality, L5_REFERENCE.causality);
  assert.deepEqual(lesson.relationSets.parallel, L5_REFERENCE.parallel);
  assert.deepEqual(lesson.relationSets.unrelated, L5_REFERENCE.unrelated);
  assert.deepEqual(lesson.footprint, L5_REFERENCE.footprint);
  assert.deepEqual(lesson.XL.map((candidate) => candidate.key), L5_REFERENCE.XL);
  assert.deepEqual(lesson.YL.map((candidate) => candidate.key), L5_REFERENCE.YL);
  assert.deepEqual(lesson.PL, L5_REFERENCE.PL);
  assert.deepEqual(lesson.FL, L5_REFERENCE.FL);
});

test('cada arco del modelo L5 corresponde exactamente a un elemento de FL', () => {
  const lesson = explainAlpha(parseTraceLanguage(L5));
  const placeByLabel = new Map(lesson.placeExplanations.map((item) => {
    if (item.kind === 'initial') return ['inicio', item.place];
    if (item.kind === 'final') return ['fin', item.place];
    return [item.pairKey.replaceAll('{', '').replaceAll('}', ''), item.place];
  }));
  const formalName = new Map(lesson.model.nodes.map((node) => [
    node.id,
    node.type === 'transition' ? node.label : placeByLabel.get(node.label),
  ]));
  const modelFlow = lesson.model.arcs
    .map((arc) => `${formalName.get(arc.source)}→${formalName.get(arc.target)}`)
    .sort();

  assert.equal(modelFlow.includes('undefined→undefined'), false);
  assert.deepEqual(modelFlow, [...L5_REFERENCE.FL].sort());
});

