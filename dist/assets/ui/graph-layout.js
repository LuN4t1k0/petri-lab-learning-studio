const nodeOrder = (left, right) => left.localeCompare(right, undefined, { numeric: true });

function graphIndex(model) {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const outgoing = new Map(model.nodes.map((node) => [node.id, []]));
  const incoming = new Map(model.nodes.map((node) => [node.id, []]));
  const undirected = new Map(model.nodes.map((node) => [node.id, []]));
  for (const arc of model.arcs ?? []) {
    if (!nodeById.has(arc.source) || !nodeById.has(arc.target)) continue;
    outgoing.get(arc.source).push(arc.target);
    incoming.get(arc.target).push(arc.source);
    undirected.get(arc.source).push(arc.target);
    undirected.get(arc.target).push(arc.source);
  }
  for (const adjacency of [...outgoing.values(), ...incoming.values(), ...undirected.values()]) {
    adjacency.sort(nodeOrder);
  }
  return { nodeById, outgoing, incoming, undirected };
}

function fallbackLayout(model, width, height, graph) {
  const positions = new Map();
  const starts = Object.keys(model.initialMarking ?? {});
  if (!starts.length) {
    starts.push(...model.nodes.filter((node) => graph.incoming.get(node.id).length === 0).map((node) => node.id));
  }
  if (!starts.length) starts.push(model.nodes[0].id);

  const layers = new Map(starts.map((id) => [id, 0]));
  const queue = [...starts];
  while (queue.length) {
    const current = queue.shift();
    const nextLayer = (layers.get(current) ?? 0) + 1;
    for (const target of graph.outgoing.get(current) ?? []) {
      if (layers.has(target)) continue;
      layers.set(target, nextLayer);
      queue.push(target);
    }
  }

  let fallbackLayer = Math.max(0, ...layers.values()) + 1;
  for (const node of model.nodes) {
    if (!layers.has(node.id)) layers.set(node.id, fallbackLayer++);
  }

  const grouped = new Map();
  for (const node of model.nodes) {
    const layer = layers.get(node.id);
    const entries = grouped.get(layer) ?? [];
    entries.push(node);
    grouped.set(layer, entries);
  }

  const maxLayer = Math.max(...grouped.keys(), 1);
  const horizontalPadding = 76;
  const verticalPadding = 72;
  for (const [layer, nodes] of grouped) {
    nodes.sort((left, right) => nodeOrder(left.id, right.id));
    const x = horizontalPadding + (layer / maxLayer) * Math.max(200, width - horizontalPadding * 2);
    const usableHeight = Math.max(140, height - verticalPadding * 2);
    nodes.forEach((node, index) => {
      const y = nodes.length === 1
        ? height / 2
        : verticalPadding + (index / (nodes.length - 1)) * usableHeight;
      positions.set(node.id, { x, y, layer, lane: 0, role: 'fallback' });
    });
  }
  return positions;
}

function enumerateSimplePaths(starts, finals, graph, limit = 2048) {
  const finalSet = new Set(finals);
  const paths = [];
  const visit = (current, path, seen) => {
    if (paths.length >= limit) return;
    if (finalSet.has(current)) {
      paths.push(path);
      return;
    }
    for (const target of graph.outgoing.get(current) ?? []) {
      if (seen.has(target)) continue;
      seen.add(target);
      visit(target, [...path, target], seen);
      seen.delete(target);
      if (paths.length >= limit) return;
    }
  };
  for (const start of [...starts].sort(nodeOrder)) {
    visit(start, [start], new Set([start]));
    if (paths.length >= limit) break;
  }
  return paths;
}

function chooseSpine(paths, graph) {
  const score = (path) => path.reduce((total, id) => {
    const degree = graph.incoming.get(id).length + graph.outgoing.get(id).length;
    return total + Math.max(0, degree - 2) * 10000;
  }, 0) + path.length * 100;
  return [...paths].sort((left, right) => {
    const scoreDifference = score(right) - score(left);
    if (scoreDifference) return scoreDifference;
    if (left.length !== right.length) return right.length - left.length;
    return left.join('|').localeCompare(right.join('|'));
  })[0];
}

function externalComponents(model, spineSet, graph) {
  const remaining = new Set(model.nodes.map((node) => node.id).filter((id) => !spineSet.has(id)));
  const components = [];
  while (remaining.size) {
    const first = [...remaining].sort(nodeOrder)[0];
    const queue = [first];
    const component = [];
    remaining.delete(first);
    while (queue.length) {
      const current = queue.shift();
      component.push(current);
      for (const neighbor of graph.undirected.get(current) ?? []) {
        if (!remaining.has(neighbor)) continue;
        remaining.delete(neighbor);
        queue.push(neighbor);
      }
    }
    components.push(component.sort(nodeOrder));
  }
  return components;
}

function describeComponent(component, model, spineIndex, graph) {
  const members = new Set(component);
  const entries = [];
  const exits = [];
  const attachments = [];
  for (const arc of model.arcs ?? []) {
    if (spineIndex.has(arc.source) && members.has(arc.target)) {
      entries.push({ anchor: arc.source, member: arc.target, index: spineIndex.get(arc.source) });
      attachments.push(spineIndex.get(arc.source));
    }
    if (members.has(arc.source) && spineIndex.has(arc.target)) {
      exits.push({ anchor: arc.target, member: arc.source, index: spineIndex.get(arc.target) });
      attachments.push(spineIndex.get(arc.target));
    }
  }
  entries.sort((left, right) => left.index - right.index || nodeOrder(left.member, right.member));
  exits.sort((left, right) => left.index - right.index || nodeOrder(left.member, right.member));

  let selected = null;
  for (const entry of entries) {
    for (const exit of exits) {
      const span = Math.abs(exit.index - entry.index);
      const signature = `${entry.anchor}|${entry.member}|${exit.member}|${exit.anchor}`;
      if (!selected || span > selected.span || (span === selected.span && signature < selected.signature)) {
        selected = { entry, exit, span, signature };
      }
    }
  }
  const minimum = attachments.length ? Math.min(...attachments) : 0;
  const maximum = attachments.length ? Math.max(...attachments) : spineIndex.size - 1;
  const fromIndex = selected?.entry.index ?? entries[0]?.index ?? 0;
  const toIndex = selected?.exit.index
    ?? exits.at(-1)?.index
    ?? (entries.length ? spineIndex.size - 1 : maximum);
  const seeds = selected
    ? [selected.entry.member]
    : entries.length ? [...new Set(entries.map((entry) => entry.member))] : [component[0]];

  const distance = new Map(seeds.map((id) => [id, 0]));
  const queue = [...seeds];
  while (queue.length) {
    const current = queue.shift();
    for (const target of graph.outgoing.get(current) ?? []) {
      if (!members.has(target) || distance.has(target)) continue;
      distance.set(target, distance.get(current) + 1);
      queue.push(target);
    }
  }
  let nextDistance = Math.max(-1, ...distance.values()) + 1;
  for (const id of component) {
    if (!distance.has(id)) distance.set(id, nextDistance++);
  }
  const ordered = [...component].sort((left, right) =>
    distance.get(left) - distance.get(right) || nodeOrder(left, right));
  return { ordered, fromIndex, toIndex, role: toIndex < fromIndex ? 'return' : 'branch' };
}

export function layoutPetriNet(model, width = 1200, height = 720) {
  const positions = new Map();
  if (!model?.nodes?.length) return positions;

  const graph = graphIndex(model);
  const starts = Object.keys(model.initialMarking ?? {}).filter((id) => graph.nodeById.has(id));
  if (!starts.length) {
    starts.push(...model.nodes.filter((node) => graph.incoming.get(node.id).length === 0).map((node) => node.id));
  }
  const finals = (model.finalPlaces ?? []).filter((id) => graph.nodeById.has(id));
  if (!finals.length) {
    finals.push(...model.nodes.filter((node) => graph.outgoing.get(node.id).length === 0).map((node) => node.id));
  }
  const paths = enumerateSimplePaths(starts, finals, graph);
  if (!paths.length) return fallbackLayout(model, width, height, graph);

  const spine = chooseSpine(paths, graph);
  const spineIndex = new Map(spine.map((id, index) => [id, index]));
  const spineSet = new Set(spine);
  const horizontalPadding = 76;
  const usableWidth = Math.max(200, width - horizontalPadding * 2);
  const centerY = height / 2;
  const spineX = (index) => horizontalPadding + (index / Math.max(1, spine.length - 1)) * usableWidth;
  spine.forEach((id, index) => {
    positions.set(id, { x: spineX(index), y: centerY, layer: index, lane: 0, role: 'spine' });
  });

  const described = externalComponents(model, spineSet, graph)
    .map((component) => describeComponent(component, model, spineIndex, graph))
    .sort((left, right) => {
      if (left.role !== right.role) return left.role === 'return' ? -1 : 1;
      if (left.fromIndex !== right.fromIndex) return left.fromIndex - right.fromIndex;
      if (left.toIndex !== right.toIndex) return left.toIndex - right.toIndex;
      return left.ordered.join('|').localeCompare(right.ordered.join('|'));
    });
  let returnLane = 0;
  const occupiedLanes = new Set();
  for (const item of described.filter((component) => component.role === 'return')) {
    item.lane = -(++returnLane);
    occupiedLanes.add(item.lane);
  }
  let branchOffset = 1;
  let branchDirection = 1;
  for (const item of described.filter((component) => component.role === 'branch')) {
    let candidate = branchOffset * branchDirection;
    while (occupiedLanes.has(candidate)) {
      if (branchDirection > 0) branchDirection = -1;
      else {
        branchDirection = 1;
        branchOffset += 1;
      }
      candidate = branchOffset * branchDirection;
    }
    item.lane = candidate;
    occupiedLanes.add(candidate);
    if (branchDirection > 0) branchDirection = -1;
    else {
      branchDirection = 1;
      branchOffset += 1;
    }
  }
  const maximumLane = Math.max(1, ...described.map((item) => Math.abs(item.lane)));
  const availableHalfHeight = Math.max(80, centerY - 72);
  const laneGap = Math.min(150, availableHalfHeight / maximumLane);

  for (const item of described) {
    const startX = spineX(item.fromIndex);
    const endX = spineX(item.toIndex);
    item.ordered.forEach((id, index) => {
      const progress = (index + 1) / (item.ordered.length + 1);
      const x = startX + (endX - startX) * progress;
      positions.set(id, {
        x,
        y: centerY + item.lane * laneGap,
        layer: Math.round(x),
        lane: item.lane,
        role: item.role,
      });
    });
  }
  return positions.size === model.nodes.length ? positions : fallbackLayout(model, width, height, graph);
}
