export function createPetriBuilder(method) {
  const nodes = [];
  const arcs = [];
  const counters = { place: 0, transition: 0, arc: 0 };

  function addPlace(label = '', options = {}) {
    const node = {
      id: `p_${++counters.place}`,
      type: 'place',
      label,
      tokens: options.tokens ?? 0,
      terminal: Boolean(options.terminal),
    };
    nodes.push(node);
    return node.id;
  }

  function addTransition(label = '', options = {}) {
    const node = {
      id: `t_${++counters.transition}`,
      type: 'transition',
      label,
      silent: Boolean(options.silent),
    };
    nodes.push(node);
    return node.id;
  }

  function addArc(source, target) {
    const existing = arcs.find((arc) => arc.source === source && arc.target === target);
    if (existing) return existing.id;
    const arc = { id: `a_${++counters.arc}`, source, target };
    arcs.push(arc);
    return arc.id;
  }

  function build({ finalPlaces = [], metadata = {} } = {}) {
    return {
      nodes,
      arcs,
      initialMarking: Object.fromEntries(
        nodes.filter((node) => node.type === 'place' && node.tokens > 0)
          .map((node) => [node.id, node.tokens]),
      ),
      finalPlaces,
      metadata: { method, ...metadata },
    };
  }

  return { addPlace, addTransition, addArc, build };
}

export function validatePetriModel(model) {
  const errors = [];
  if (!model || !Array.isArray(model.nodes) || !Array.isArray(model.arcs)) {
    return ['El modelo no tiene nodos y arcos válidos.'];
  }
  const byId = new Map();
  for (const node of model.nodes) {
    if (byId.has(node.id)) errors.push(`ID duplicado: ${node.id}`);
    byId.set(node.id, node);
    if (!['place', 'transition'].includes(node.type)) errors.push(`Tipo inválido: ${node.id}`);
  }
  const incident = new Set();
  for (const arc of model.arcs) {
    const source = byId.get(arc.source);
    const target = byId.get(arc.target);
    if (!source || !target) {
      errors.push(`Arco ${arc.id} referencia un nodo inexistente.`);
      continue;
    }
    if (source.type === target.type) errors.push(`Arco ${arc.id} no es bipartito.`);
    incident.add(source.id);
    incident.add(target.id);
  }
  for (const node of model.nodes) {
    if (!incident.has(node.id)) errors.push(`Nodo aislado: ${node.id}`);
  }
  if (!Object.keys(model.initialMarking ?? {}).length) errors.push('Falta el marcado inicial.');
  for (const id of model.finalPlaces ?? []) {
    if (byId.get(id)?.type !== 'place') errors.push(`Lugar final inválido: ${id}`);
  }
  return errors;
}
