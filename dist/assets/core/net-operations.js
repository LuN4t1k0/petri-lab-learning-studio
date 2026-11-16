function cloneModel(model) {
  return {
    ...model,
    nodes: model.nodes.map((node) => ({ ...node })),
    arcs: model.arcs.map((arc) => ({ ...arc })),
    initialMarking: { ...(model.initialMarking ?? {}) },
    finalPlaces: [...(model.finalPlaces ?? [])],
    metadata: { ...(model.metadata ?? {}) },
  };
}

function nextId(items, prefix) {
  let index = items.length + 1;
  while (items.some((item) => item.id === `${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}

export function createEmptyNet() {
  return {
    nodes: [], arcs: [], initialMarking: {}, finalPlaces: [],
    metadata: { method: 'manual', title: 'Red del estudiante' },
  };
}

export function addNode(model, input) {
  if (!['place', 'transition'].includes(input.type)) throw new Error('Tipo de nodo inválido.');
  const next = cloneModel(model);
  const prefix = input.type === 'place' ? 'p' : 't';
  const id = input.id ?? nextId(next.nodes, prefix);
  if (next.nodes.some((node) => node.id === id)) throw new Error(`El nodo ${id} ya existe.`);
  const node = {
    id, type: input.type, label: input.label ?? '',
    x: Number.isFinite(input.x) ? input.x : 120,
    y: Number.isFinite(input.y) ? input.y : 120,
  };
  if (input.type === 'place') {
    node.tokens = Math.max(0, Number(input.tokens) || 0);
    if (node.tokens) next.initialMarking[id] = node.tokens;
  } else {
    node.silent = Boolean(input.silent);
  }
  next.nodes.push(node);
  return next;
}

export function addArc(model, sourceId, targetId, options = {}) {
  const source = model.nodes.find((node) => node.id === sourceId);
  const target = model.nodes.find((node) => node.id === targetId);
  if (!source || !target) throw new Error('Selecciona dos nodos existentes.');
  if (source.type === target.type) throw new Error('Un arco debe unir un lugar y una transición.');
  if (model.arcs.some((arc) => arc.source === sourceId && arc.target === targetId)) {
    throw new Error('Ese arco ya existe.');
  }
  const next = cloneModel(model);
  next.arcs.push({
    id: options.id ?? nextId(next.arcs, 'a'), source: sourceId, target: targetId,
    weight: Math.max(1, Number(options.weight) || 1),
  });
  return next;
}

export function removeElement(model, id) {
  const next = cloneModel(model);
  next.nodes = next.nodes.filter((node) => node.id !== id);
  next.arcs = next.arcs.filter((arc) => arc.id !== id && arc.source !== id && arc.target !== id);
  delete next.initialMarking[id];
  next.finalPlaces = next.finalPlaces.filter((placeId) => placeId !== id);
  return next;
}

export function updateNode(model, id, changes) {
  const next = cloneModel(model);
  const node = next.nodes.find((candidate) => candidate.id === id);
  if (!node) throw new Error('El nodo seleccionado ya no existe.');
  if (typeof changes.label === 'string') node.label = changes.label;
  if (Number.isFinite(changes.x)) node.x = changes.x;
  if (Number.isFinite(changes.y)) node.y = changes.y;
  if (node.type === 'place' && changes.tokens !== undefined) {
    node.tokens = Math.max(0, Number(changes.tokens) || 0);
    if (node.tokens) next.initialMarking[id] = node.tokens;
    else delete next.initialMarking[id];
  }
  return next;
}

export function enabledTransitions(model, marking = model.initialMarking ?? {}) {
  return model.nodes.filter((node) => node.type === 'transition').filter((transition) => {
    const inputs = model.arcs.filter((arc) => arc.target === transition.id);
    return inputs.every((arc) => (marking[arc.source] ?? 0) >= (arc.weight ?? 1));
  }).map((transition) => transition.id);
}

export function fireTransition(model, marking, transitionId) {
  if (!enabledTransitions(model, marking).includes(transitionId)) {
    throw new Error('La transición no está habilitada con el marcado actual.');
  }
  const next = Object.fromEntries(
    model.nodes.filter((node) => node.type === 'place').map((place) => [place.id, marking[place.id] ?? 0]),
  );
  for (const arc of model.arcs.filter((candidate) => candidate.target === transitionId)) {
    next[arc.source] -= arc.weight ?? 1;
  }
  for (const arc of model.arcs.filter((candidate) => candidate.source === transitionId)) {
    next[arc.target] = (next[arc.target] ?? 0) + (arc.weight ?? 1);
  }
  return next;
}
