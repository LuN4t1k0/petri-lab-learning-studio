import test from 'node:test';
import assert from 'node:assert/strict';

import { parseTraceLanguage } from '../src/core/trace-parser.js';
import { validatePetriModel } from '../src/core/petri-model.js';
import { minePrefix } from '../src/miners/prefix-miner.js';
import { mineAlpha } from '../src/miners/alpha-miner.js';
import { mineInductive } from '../src/miners/inductive-miner.js';

const log = parseTraceLanguage('<a,b,c,d>^3\n<a,c,b,d>^4\n<a,b,c,e,f,b,c,d>^2');

for (const [name, mine] of [
  ['prefijos', minePrefix],
  ['alpha', mineAlpha],
  ['inductivo', mineInductive],
]) {
  test(`${name} produce una red válida y conectada`, () => {
    const model = mine(log);
    assert.deepEqual(validatePetriModel(model), []);
    assert.equal(model.metadata.method, name);
    assert.ok(model.nodes.some((node) => node.type === 'place' && node.tokens === 1));
    assert.ok(model.finalPlaces.length > 0);
    assert.ok(model.arcs.length > 0);
  });
}

test('el árbol de prefijos comparte inicios pero conserva caminos observados', () => {
  const model = minePrefix(log);
  const labelled = model.nodes.filter((node) => node.type === 'transition' && node.label);
  assert.equal(labelled.filter((node) => node.label === 'a').length, 1);
  assert.ok(labelled.filter((node) => node.label === 'b').length > 1);
  assert.equal(model.metadata.variantCount, 3);
});

test('alpha detecta causalidad y paralelismo a partir de sucesión directa', () => {
  const model = mineAlpha(parseTraceLanguage('<a,b,c,d>\n<a,c,b,d>'));
  assert.ok(model.metadata.relations.parallel.includes('b ∥ c'));
  assert.ok(model.metadata.relations.causality.includes('a → b'));
  assert.ok(model.metadata.relations.causality.includes('c → d'));
});

test('alpha representa una elección con un lugar compartido', () => {
  const model = mineAlpha(parseTraceLanguage('<a,b,d>\n<a,c,d>'));
  const transitionByLabel = new Map(
    model.nodes.filter((node) => node.type === 'transition').map((node) => [node.label, node.id]),
  );
  const places = model.nodes.filter((node) => node.type === 'place');
  const outgoing = (id) => model.arcs.filter((arc) => arc.source === id).map((arc) => arc.target);
  const incoming = (id) => model.arcs.filter((arc) => arc.target === id).map((arc) => arc.source);
  const split = places.find((place) => {
    const targets = new Set(outgoing(place.id));
    return incoming(place.id).includes(transitionByLabel.get('a'))
      && targets.has(transitionByLabel.get('b'))
      && targets.has(transitionByLabel.get('c'));
  });
  assert.ok(split, 'la elección b/c debe compartir el token producido por a');
});

test('el minero inductivo usa transiciones silenciosas para elegir variantes', () => {
  const model = mineInductive(parseTraceLanguage('<a,b,d>\n<a,c,d>'));
  const silent = model.nodes.filter((node) => node.type === 'transition' && node.silent);
  assert.ok(silent.length >= 2);
  assert.equal(model.metadata.structure, 'elección estructurada de variantes');
});

test('ids internos siguen siendo únicos con etiquetas repetidas', () => {
  for (const mine of [minePrefix, mineAlpha, mineInductive]) {
    const model = mine(parseTraceLanguage('<a,b,a>'));
    assert.equal(new Set(model.nodes.map((node) => node.id)).size, model.nodes.length);
  }
});
