import { enabledTransitions, fireTransition } from './net-operations.js';

function reachableFrom(start, adjacency) {
  const seen = new Set(start ? [start] : []);
  const queue = start ? [start] : [];
  while (queue.length) {
    const current = queue.shift();
    for (const next of adjacency.get(current) ?? []) {
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return seen;
}

export function analyzeWorkflowNet(model) {
  const nodesById = new Map((model.nodes ?? []).map((node) => [node.id, node]));
  const structuralErrors = [];
  const outgoing = new Map((model.nodes ?? []).map((node) => [node.id, []]));
  const incoming = new Map((model.nodes ?? []).map((node) => [node.id, []]));
  for (const arc of model.arcs ?? []) {
    const source = nodesById.get(arc.source);
    const target = nodesById.get(arc.target);
    if (!source || !target) structuralErrors.push(`El arco ${arc.id} apunta a un nodo inexistente.`);
    else if (source.type === target.type) structuralErrors.push(`El arco ${arc.id} no conecta un lugar con una transición.`);
    if (source && target) {
      outgoing.get(source.id).push(target.id);
      incoming.get(target.id).push(source.id);
    }
  }
  const isolated = (model.nodes ?? []).filter((node) => !outgoing.get(node.id)?.length && !incoming.get(node.id)?.length);
  if (isolated.length) structuralErrors.push(`Hay ${isolated.length} nodo(s) aislado(s).`);
  const places = (model.nodes ?? []).filter((node) => node.type === 'place');
  const sources = places.filter((place) => !incoming.get(place.id)?.length);
  const sinks = places.filter((place) => !outgoing.get(place.id)?.length);
  const sourcePlace = sources.length === 1 ? sources[0].id : null;
  const sinkPlace = sinks.length === 1 ? sinks[0].id : null;
  const forward = reachableFrom(sourcePlace, outgoing);
  const backward = reachableFrom(sinkPlace, incoming);
  const outsidePath = (model.nodes ?? []).filter((node) => !forward.has(node.id) || !backward.has(node.id));
  const checks = [
    {
      id: 'petri-structure', passed: structuralErrors.length === 0,
      title: 'Estructura de Petri Net',
      detail: structuralErrors.length ? structuralErrors.join(' ') : 'Todos los arcos respetan la bipartición lugar–transición.',
      fix: 'Elimina nodos aislados y conecta siempre lugares con transiciones.',
    },
    {
      id: 'single-source', passed: sources.length === 1,
      title: 'Un único lugar fuente',
      detail: sources.length === 1 ? `El lugar ${sources[0].label || sources[0].id} inicia el proceso.` : `Se encontraron ${sources.length} lugares fuente.`,
      fix: 'Conserva un solo lugar sin arcos de entrada.',
    },
    {
      id: 'single-sink', passed: sinks.length === 1,
      title: 'Un único lugar sumidero',
      detail: sinks.length === 1 ? `El lugar ${sinks[0].label || sinks[0].id} termina el proceso.` : `Se encontraron ${sinks.length} lugares sumidero.`,
      fix: 'Une todas las terminaciones mediante transiciones silenciosas hacia un único lugar final.',
    },
    {
      id: 'all-on-path', passed: Boolean(sourcePlace && sinkPlace) && outsidePath.length === 0,
      title: 'Todos los nodos participan',
      detail: outsidePath.length ? `${outsidePath.length} nodo(s) no están en un camino entre inicio y fin.` : 'Cada nodo pertenece a un camino desde el inicio hasta el final.',
      fix: 'Conecta o elimina los nodos que quedan fuera del flujo principal.',
    },
  ];
  return {
    isPetriNet: structuralErrors.length === 0,
    isWorkflowNet: checks.every((check) => check.passed),
    sourcePlace, sinkPlace, sources: sources.map((node) => node.id), sinks: sinks.map((node) => node.id),
    outsidePath: outsidePath.map((node) => node.id), checks,
  };
}

function markingKey(marking, placeIds) {
  return placeIds.map((id) => `${id}:${marking[id] ?? 0}`).join('|');
}

export function exploreReachability(model, { maxStates = 300 } = {}) {
  const placeIds = model.nodes.filter((node) => node.type === 'place').map((node) => node.id).sort();
  const initial = Object.fromEntries(placeIds.map((id) => [id, model.initialMarking?.[id] ?? 0]));
  const queue = [initial];
  const seen = new Set([markingKey(initial, placeIds)]);
  const fired = new Set();
  const configuredFinals = model.finalPlaces?.length
    ? model.finalPlaces
    : [analyzeWorkflowNet(model).sinkPlace].filter(Boolean);
  const finalPlaces = new Set(configuredFinals);
  let finalReachable = false;
  let residualTokensAtFinal = false;
  let statesExplored = 0;
  let truncated = false;

  while (queue.length) {
    if (statesExplored >= maxStates) { truncated = true; break; }
    const marking = queue.shift();
    statesExplored += 1;
    const total = placeIds.reduce((sum, id) => sum + (marking[id] ?? 0), 0);
    const finalTokens = placeIds.filter((id) => finalPlaces.has(id)).reduce((sum, id) => sum + (marking[id] ?? 0), 0);
    if (finalPlaces.size && finalTokens > 0) {
      if (finalTokens === 1 && total === 1) finalReachable = true;
      else residualTokensAtFinal = true;
    }
    for (const transitionId of enabledTransitions(model, marking)) {
      fired.add(transitionId);
      const next = fireTransition(model, marking, transitionId);
      const key = markingKey(next, placeIds);
      if (!seen.has(key)) {
        if (seen.size >= maxStates) { truncated = true; continue; }
        seen.add(key);
        queue.push(next);
      }
    }
  }
  const transitions = model.nodes.filter((node) => node.type === 'transition').map((node) => node.id);
  return {
    finalReachable, residualTokensAtFinal, statesExplored, truncated,
    deadTransitions: transitions.filter((id) => !fired.has(id)),
  };
}
