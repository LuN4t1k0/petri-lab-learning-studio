import test from 'node:test';
import assert from 'node:assert/strict';

import { parseTraceLanguage } from '../src/core/trace-parser.js';
import { analyzeWorkflowNet, exploreReachability } from '../src/core/workflow-analysis.js';
import { explainAlpha } from '../src/miners/alpha-miner.js';

const linear = {
  nodes: [
    { id: 'p1', type: 'place', label: 'inicio', tokens: 1 },
    { id: 't1', type: 'transition', label: 'a' },
    { id: 'p2', type: 'place', label: 'fin', tokens: 0 },
  ],
  arcs: [{ id: 'a1', source: 'p1', target: 't1' }, { id: 'a2', source: 't1', target: 'p2' }],
  initialMarking: { p1: 1 },
  finalPlaces: ['p2'],
};

test('reconoce una Workflow Net lineal y explica sus condiciones', () => {
  const report = analyzeWorkflowNet(linear);
  assert.equal(report.isPetriNet, true);
  assert.equal(report.isWorkflowNet, true);
  assert.equal(report.sourcePlace, 'p1');
  assert.equal(report.sinkPlace, 'p2');
  assert.equal(report.checks.every((check) => check.passed), true);
});

test('rechaza una red con varios sumideros o nodos fuera del camino principal', () => {
  const broken = structuredClone(linear);
  broken.nodes.push({ id: 'p3', type: 'place', label: 'aislado', tokens: 0 });
  const report = analyzeWorkflowNet(broken);
  assert.equal(report.isWorkflowNet, false);
  assert.ok(report.checks.some((check) => !check.passed && /sumidero|camino/i.test(check.detail)));
});

test('explora marcados, alcanza el final y registra transiciones vivas', () => {
  const result = exploreReachability(linear, { maxStates: 20 });
  assert.equal(result.finalReachable, true);
  assert.deepEqual(result.deadTransitions, []);
  assert.equal(result.truncated, false);
  assert.equal(result.statesExplored, 2);
});

test('infiere el lugar final en una red construida manualmente', () => {
  const manual = { ...linear, finalPlaces: [] };
  const result = exploreReachability(manual, { maxStates: 20 });
  assert.equal(result.finalReachable, true);
});

test('la exploración respeta un límite de estados', () => {
  const loop = {
    nodes: [
      { id: 'p1', type: 'place', tokens: 1 },
      { id: 't1', type: 'transition', label: 'duplicar' },
    ],
    arcs: [
      { id: 'a1', source: 'p1', target: 't1' },
      { id: 'a2', source: 't1', target: 'p1', weight: 2 },
    ],
    initialMarking: { p1: 1 }, finalPlaces: [],
  };
  const result = exploreReachability(loop, { maxStates: 5 });
  assert.equal(result.truncated, true);
  assert.equal(result.statesExplored, 5);
});

test('explica los ocho pasos formales de Alpha y la matriz footprint', () => {
  const log = parseTraceLanguage('<a,b,c,d>^3\n<a,c,b,d>^2\n<a,e,d>');
  const lesson = explainAlpha(log);
  assert.deepEqual(lesson.TL, ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(lesson.TI, ['a']);
  assert.deepEqual(lesson.TO, ['d']);
  assert.equal(lesson.footprint.a.b, '→');
  assert.equal(lesson.footprint.b.a, '←');
  assert.equal(lesson.footprint.b.c, '∥');
  assert.equal(lesson.footprint.b.e, '#');
  assert.deepEqual(lesson.YL.map((pair) => pair.key).sort(), [
    '{a}→{b,e}', '{a}→{c,e}', '{b,e}→{d}', '{c,e}→{d}',
  ]);
  assert.equal(lesson.steps.length, 8);
  assert.equal(lesson.model.metadata.method, 'alpha');
});
