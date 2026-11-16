import test from 'node:test';
import assert from 'node:assert/strict';

import { parseTraceLanguage } from '../src/core/trace-parser.js';
import { minePrefix } from '../src/miners/prefix-miner.js';
import { layoutPetriNet } from '../src/ui/graph-layout.js';
import { nodeBoundary } from '../src/ui/svg-renderer.js';

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
