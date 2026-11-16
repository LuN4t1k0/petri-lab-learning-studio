import { layoutPetriNet } from './graph-layout.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

export function nodeBoundary(from, to, node) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  if (node.type === 'place') {
    return { x: from.x + (dx / length) * 27, y: from.y + (dy / length) * 27 };
  }
  const scale = Math.min(24 / Math.max(Math.abs(dx), 0.01), 31 / Math.max(Math.abs(dy), 0.01));
  return { x: from.x + dx * scale, y: from.y + dy * scale };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function renderPetriNet(container, model) {
  container.replaceChildren();
  const width = Math.max(940, container.clientWidth || 940);
  const height = Math.max(560, Math.min(820, model.nodes.length * 24));
  const positions = layoutPetriNet(model, width, height);
  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));
  const svg = svgElement('svg', {
    class: 'petri-svg', viewBox: `0 0 ${width} ${height}`,
    role: 'img', 'aria-label': `Red de Petri con ${model.nodes.length} nodos y ${model.arcs.length} arcos`,
  });
  const defs = svgElement('defs');
  const embeddedStyles = svgElement('style');
  embeddedStyles.textContent = `
    .petri-arc{fill:none;stroke:#496064;stroke-width:1.7;color:#496064}
    .place-shape{fill:#fbfaf5;stroke:#152a2c;stroke-width:2.2}
    .transition-shape{fill:#152a2c;stroke:#152a2c;stroke-width:2}
    .is-silent .transition-shape{fill:#d9ded5;stroke-dasharray:3 2}
    .transition-label{fill:#fbfaf5;text-anchor:middle;font:600 17px monospace}
    .is-silent .transition-label{fill:#496064;font-size:13px}
    .node-caption{fill:#496064;text-anchor:middle;font:10px monospace}
    .token-dot{fill:#ff7d4e;stroke:#152a2c;stroke-width:2}
  `;
  const marker = svgElement('marker', {
    id: 'arrowhead', markerWidth: 8, markerHeight: 8, refX: 7, refY: 4,
    orient: 'auto', markerUnits: 'strokeWidth',
  });
  marker.append(svgElement('path', { d: 'M 0 0 L 8 4 L 0 8 z', fill: 'currentColor' }));
  defs.append(embeddedStyles, marker);
  svg.append(defs);
  const viewport = svgElement('g', { class: 'graph-viewport' });
  const arcLayer = svgElement('g', { class: 'arc-layer' });
  const nodeLayer = svgElement('g', { class: 'node-layer' });
  viewport.append(arcLayer, nodeLayer);
  svg.append(viewport);
  container.append(svg);

  const arcElements = new Map();
  for (const arc of model.arcs) {
    const path = svgElement('path', { class: 'petri-arc', 'marker-end': 'url(#arrowhead)' });
    arcLayer.append(path);
    arcElements.set(arc.id, path);
  }

  function updateArcs() {
    for (const arc of model.arcs) {
      const sourcePosition = positions.get(arc.source);
      const targetPosition = positions.get(arc.target);
      const start = nodeBoundary(sourcePosition, targetPosition, nodesById.get(arc.source));
      const end = nodeBoundary(targetPosition, sourcePosition, nodesById.get(arc.target));
      const bend = Math.max(34, Math.abs(end.x - start.x) * 0.44);
      arcElements.get(arc.id).setAttribute(
        'd', `M ${start.x} ${start.y} C ${start.x + bend} ${start.y}, ${end.x - bend} ${end.y}, ${end.x} ${end.y}`,
      );
    }
  }

  for (const node of model.nodes) {
    const position = positions.get(node.id);
    const group = svgElement('g', {
      class: `petri-node petri-node--${node.type}${node.silent ? ' is-silent' : ''}`,
      transform: `translate(${position.x} ${position.y})`, tabindex: 0,
      'aria-label': node.type === 'place' ? `Lugar ${node.label || node.id}` : `Transición ${node.label || 'silenciosa'}`,
    });
    const title = svgElement('title');
    title.textContent = node.label || (node.silent ? 'Transición silenciosa (τ)' : node.id);
    group.append(title);
    if (node.type === 'place') {
      group.append(svgElement('circle', { r: 26, class: 'place-shape' }));
      if (node.tokens > 0) group.append(svgElement('circle', { r: 7, class: 'token-dot' }));
      if (node.label) {
        const label = svgElement('text', { y: 45, class: 'node-caption' });
        label.textContent = node.label;
        group.append(label);
      }
    } else {
      group.append(svgElement('rect', { x: -24, y: -31, width: 48, height: 62, rx: node.silent ? 12 : 7, class: 'transition-shape' }));
      const label = svgElement('text', { y: 6, class: 'transition-label' });
      label.textContent = node.silent ? 'τ' : node.label;
      group.append(label);
    }
    nodeLayer.append(group);

    let draggingNode = false;
    group.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      draggingNode = true;
      group.setPointerCapture(event.pointerId);
    });
    group.addEventListener('pointermove', (event) => {
      if (!draggingNode) return;
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const local = point.matrixTransform(viewport.getScreenCTM().inverse());
      position.x = local.x;
      position.y = local.y;
      group.setAttribute('transform', `translate(${position.x} ${position.y})`);
      updateArcs();
    });
    group.addEventListener('pointerup', () => { draggingNode = false; });
  }
  updateArcs();

  let transform = { x: 0, y: 0, scale: 1 };
  const applyTransform = () => viewport.setAttribute('transform', `translate(${transform.x} ${transform.y}) scale(${transform.scale})`);
  let panning = false;
  let panStart = null;
  svg.addEventListener('pointerdown', (event) => {
    if (event.target.closest?.('.petri-node')) return;
    panning = true;
    panStart = { x: event.clientX - transform.x, y: event.clientY - transform.y };
    svg.setPointerCapture(event.pointerId);
    svg.classList.add('is-panning');
  });
  svg.addEventListener('pointermove', (event) => {
    if (!panning) return;
    transform.x = event.clientX - panStart.x;
    transform.y = event.clientY - panStart.y;
    applyTransform();
  });
  svg.addEventListener('pointerup', () => {
    panning = false;
    svg.classList.remove('is-panning');
  });
  svg.addEventListener('wheel', (event) => {
    event.preventDefault();
    const nextScale = Math.min(2.8, Math.max(0.45, transform.scale * (event.deltaY < 0 ? 1.1 : 0.9)));
    transform.scale = nextScale;
    applyTransform();
  }, { passive: false });

  return {
    resetView() {
      transform = { x: 0, y: 0, scale: 1 };
      applyTransform();
    },
    async downloadPng(filename = 'red-de-petri.png') {
      const clone = svg.cloneNode(true);
      clone.setAttribute('width', width);
      clone.setAttribute('height', height);
      const source = new XMLSerializer().serializeToString(clone);
      const image = new Image();
      const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const context = canvas.getContext('2d');
      context.scale(2, 2);
      context.fillStyle = '#f7f6f0';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => blob && downloadBlob(blob, filename), 'image/png');
    },
  };
}
