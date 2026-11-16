export function layoutPetriNet(model, width = 1200, height = 720) {
  const positions = new Map();
  if (!model?.nodes?.length) return positions;

  const outgoing = new Map(model.nodes.map((node) => [node.id, []]));
  const incomingCount = new Map(model.nodes.map((node) => [node.id, 0]));
  for (const arc of model.arcs ?? []) {
    outgoing.get(arc.source)?.push(arc.target);
    incomingCount.set(arc.target, (incomingCount.get(arc.target) ?? 0) + 1);
  }

  const starts = Object.keys(model.initialMarking ?? {});
  if (!starts.length) {
    starts.push(...model.nodes.filter((node) => incomingCount.get(node.id) === 0).map((node) => node.id));
  }
  if (!starts.length) starts.push(model.nodes[0].id);

  const layers = new Map(starts.map((id) => [id, 0]));
  const queue = [...starts];
  while (queue.length) {
    const current = queue.shift();
    const nextLayer = (layers.get(current) ?? 0) + 1;
    for (const target of outgoing.get(current) ?? []) {
      if (!layers.has(target)) {
        layers.set(target, nextLayer);
        queue.push(target);
      }
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
    nodes.sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));
    const x = horizontalPadding + (layer / maxLayer) * Math.max(200, width - horizontalPadding * 2);
    const usableHeight = Math.max(140, height - verticalPadding * 2);
    nodes.forEach((node, index) => {
      const y = nodes.length === 1
        ? height / 2
        : verticalPadding + (index / (nodes.length - 1)) * usableHeight;
      positions.set(node.id, { x, y, layer });
    });
  }
  return positions;
}
