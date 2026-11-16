import { createPetriBuilder } from '../core/petri-model.js';

export function minePrefix(log) {
  const builder = createPetriBuilder('prefijos');
  const start = builder.addPlace('inicio', { tokens: 1 });
  const trie = { place: start, children: new Map(), terminal: false };

  for (const variant of log.variants) {
    let cursor = trie;
    for (const activity of variant.activities) {
      if (!cursor.children.has(activity)) {
        const transition = builder.addTransition(activity);
        const place = builder.addPlace('');
        builder.addArc(cursor.place, transition);
        builder.addArc(transition, place);
        cursor.children.set(activity, { place, children: new Map(), terminal: false });
      }
      cursor = cursor.children.get(activity);
    }
    cursor.terminal = true;
  }

  const finalPlaces = [];
  const visit = (node) => {
    if (node.terminal) finalPlaces.push(node.place);
    for (const child of node.children.values()) visit(child);
  };
  visit(trie);

  return builder.build({
    finalPlaces,
    metadata: {
      variantCount: log.variants.length,
      description: 'Árbol que conserva exactamente cada camino observado y comparte sus prefijos.',
    },
  });
}
