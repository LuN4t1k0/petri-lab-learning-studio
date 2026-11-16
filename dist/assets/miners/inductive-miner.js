import { createPetriBuilder } from '../core/petri-model.js';

export function mineInductive(log) {
  const builder = createPetriBuilder('inductivo');
  const start = builder.addPlace('inicio', { tokens: 1 });
  const end = builder.addPlace('fin', { terminal: true });

  for (const [variantIndex, variant] of log.variants.entries()) {
    const enter = builder.addTransition('', { silent: true });
    builder.addArc(start, enter);
    let previous = enter;

    for (const [activityIndex, activity] of variant.activities.entries()) {
      const before = builder.addPlace(`v${variantIndex + 1}.${activityIndex + 1}`);
      const transition = builder.addTransition(activity);
      builder.addArc(previous, before);
      builder.addArc(before, transition);
      previous = transition;
    }

    const beforeExit = builder.addPlace(`salida v${variantIndex + 1}`);
    const exit = builder.addTransition('', { silent: true });
    builder.addArc(previous, beforeExit);
    builder.addArc(beforeExit, exit);
    builder.addArc(exit, end);
  }

  return builder.build({
    finalPlaces: [end],
    metadata: {
      structure: 'elección estructurada de variantes',
      description: 'Modelo estructurado: una elección silenciosa selecciona una variante completa y converge al final.',
      variantFrequencies: log.variants.map((variant) => variant.frequency),
    },
  });
}
