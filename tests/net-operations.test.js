import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addArc, addNode, createEmptyNet, enabledTransitions, fireTransition, removeElement,
} from '../src/core/net-operations.js';

function linearNet() {
  return {
    nodes: [
      { id: 'p1', type: 'place', label: 'inicio', tokens: 1 },
      { id: 't1', type: 'transition', label: 'a' },
      { id: 'p2', type: 'place', label: 'fin', tokens: 0 },
    ],
    arcs: [
      { id: 'a1', source: 'p1', target: 't1' },
      { id: 'a2', source: 't1', target: 'p2' },
    ],
    initialMarking: { p1: 1 },
    finalPlaces: ['p2'],
    metadata: { method: 'manual' },
  };
}

test('crea nodos con ids únicos sin mutar la red anterior', () => {
  const empty = createEmptyNet();
  const withPlace = addNode(empty, { type: 'place', x: 100, y: 120, tokens: 1 });
  const withTransition = addNode(withPlace, { type: 'transition', label: 'registrar', x: 240, y: 120 });
  assert.equal(empty.nodes.length, 0);
  assert.equal(new Set(withTransition.nodes.map((node) => node.id)).size, 2);
  assert.deepEqual(withTransition.initialMarking, { [withPlace.nodes[0].id]: 1 });
});

test('solo permite arcos bipartitos y evita duplicados', () => {
  let model = createEmptyNet();
  model = addNode(model, { type: 'place' });
  model = addNode(model, { type: 'transition', label: 'a' });
  const [place, transition] = model.nodes;
  model = addArc(model, place.id, transition.id);
  assert.equal(model.arcs.length, 1);
  assert.throws(() => addArc(model, place.id, place.id), /lugar y una transición/i);
  assert.throws(() => addArc(model, place.id, transition.id), /ya existe/i);
});

test('habilita una transición solo cuando todas sus entradas tienen tokens', () => {
  const model = linearNet();
  assert.deepEqual(enabledTransitions(model, { p1: 1, p2: 0 }), ['t1']);
  assert.deepEqual(enabledTransitions(model, { p1: 0, p2: 0 }), []);
});

test('disparar consume entradas y produce salidas exactamente una vez', () => {
  const model = linearNet();
  assert.deepEqual(fireTransition(model, { p1: 1, p2: 0 }, 't1'), { p1: 0, p2: 1 });
  assert.throws(() => fireTransition(model, { p1: 0, p2: 0 }, 't1'), /no está habilitada/i);
});

test('eliminar un nodo elimina también sus arcos incidentes', () => {
  const result = removeElement(linearNet(), 't1');
  assert.equal(result.nodes.some((node) => node.id === 't1'), false);
  assert.equal(result.arcs.length, 0);
});
