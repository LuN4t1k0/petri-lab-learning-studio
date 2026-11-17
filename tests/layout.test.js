import test from 'node:test';
import assert from 'node:assert/strict';

import { parseTraceLanguage } from '../src/core/trace-parser.js';
import { minePrefix } from '../src/miners/prefix-miner.js';
import { mineAlpha } from '../src/miners/alpha-miner.js';
import { layoutPetriNet } from '../src/ui/graph-layout.js';
import { nodeBoundary } from '../src/ui/svg-renderer.js';
import { L5_LOG } from './fixtures/alpha-l5-reference.js';

test('asigna coordenadas finitas a todos los nodos y avanza desde el inicio', () => {
  const model = minePrefix(parseTraceLanguage('<a,b,c>\n<a,d,c>'));
  const positions = layoutPetriNet(model, 1000, 600);
  assert.equal(positions.size, model.nodes.length);
  for (const position of positions.values()) {
    assert.ok(Number.isFinite(position.x));
    assert.ok(Number.isFinite(position.y));
    assert.ok(Number.isInteger(position.layer));
  }
  const startId = Object.keys(model.initialMarking)[0];
  const firstTransition = model.arcs.find((arc) => arc.source === startId).target;
  assert.ok(positions.get(firstTransition).x > positions.get(startId).x);
});

test('separa los nodos que comparten una capa', () => {
  const model = minePrefix(parseTraceLanguage('<a,b>\n<a,c>\n<a,d>'));
  const positions = layoutPetriNet(model, 900, 500);
  const byLayer = new Map();
  for (const [id, position] of positions) {
    const ids = byLayer.get(position.layer) ?? [];
    ids.push({ id, y: position.y });
    byLayer.set(position.layer, ids);
  }
  for (const entries of byLayer.values()) {
    assert.equal(new Set(entries.map((entry) => entry.y)).size, entries.length);
  }
});

test('maneja una red vacía y una red extensa sin valores inválidos', () => {
  assert.equal(layoutPetriNet({ nodes: [], arcs: [], initialMarking: {} }).size, 0);
  const traces = Array.from({ length: 24 }, (_, index) => `<a,x${index},z>`).join('\n');
  const model = minePrefix(parseTraceLanguage(traces));
  const positions = layoutPetriNet(model, 1200, 720);
  assert.equal([...positions.values()].every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)), true);
});

test('calcula los extremos del arco sobre el borde de cada nodo', () => {
  assert.deepEqual(
    nodeBoundary({ x: 100, y: 100 }, { x: 200, y: 100 }, { type: 'place' }),
    { x: 127, y: 100 },
  );
  assert.deepEqual(
    nodeBoundary({ x: 200, y: 100 }, { x: 100, y: 100 }, { type: 'transition' }),
    { x: 176, y: 100 },
  );
});

test('organiza L5 con una ruta principal y carriles opuestos para retorno y alternativa', () => {
  const model = mineAlpha(parseTraceLanguage(L5_LOG));
  const positions = layoutPetriNet(model, 1200, 720);
  const nodeId = (label) => model.nodes.find((node) => node.label === label)?.id;
  const spineLabels = ['inicio', 'a', 'a,d→b', 'b', 'b→c,f', 'f', 'fin'];
  const spine = spineLabels.map((label) => positions.get(nodeId(label)));

  assert.equal(spine.every((position) => position.role === 'spine' && position.lane === 0), true);
  assert.equal(new Set(spine.map((position) => position.y)).size, 1);
  assert.equal(spine.every((position, index) => index === 0 || position.x > spine[index - 1].x), true);

  const returnLane = ['c', 'c→d', 'd'].map((label) => positions.get(nodeId(label)));
  const alternativeLane = ['a→e', 'e', 'e→f'].map((label) => positions.get(nodeId(label)));
  assert.equal(returnLane.every((position) => position.role === 'return' && position.lane < 0), true);
  assert.equal(alternativeLane.every((position) => position.role === 'branch' && position.lane > 0), true);
  assert.equal(returnLane.every((position) => position.y < spine[0].y), true);
  assert.equal(alternativeLane.every((position) => position.y > spine[0].y), true);
  assert.equal(returnLane[0].x > returnLane[1].x && returnLane[1].x > returnLane[2].x, true);
});

test('el layout pedagógico es determinista', () => {
  const model = mineAlpha(parseTraceLanguage(L5_LOG));
  const first = [...layoutPetriNet(model, 1000, 600)];
  const second = [...layoutPetriNet(model, 1000, 600)];

  assert.deepEqual(first, second);
});

test('usa un fallback seguro cuando no existe una ruta de inicio a fin', () => {
  const model = {
    nodes: [
      { id: 'p_1', type: 'place', label: 'inicio', tokens: 1 },
      { id: 't_1', type: 'transition', label: 'a' },
      { id: 'p_2', type: 'place', label: 'aislado' },
    ],
    arcs: [
      { id: 'a_1', source: 'p_1', target: 't_1' },
      { id: 'a_2', source: 't_1', target: 'p_1' },
    ],
    initialMarking: { p_1: 1 },
    finalPlaces: ['p_2'],
  };
  const positions = layoutPetriNet(model, 900, 500);

  assert.equal(positions.size, model.nodes.length);
  assert.equal([...positions.values()].every((position) => position.role === 'fallback'), true);
  assert.equal([...positions.values()].every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)), true);
});
