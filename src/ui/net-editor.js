import { addArc, addNode, removeElement, updateNode } from '../core/net-operations.js';
import { layoutPetriNet } from './graph-layout.js';
import { nodeBoundary } from './svg-renderer.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createEditorState() {
  return { tool: 'select', selectedId: null, connectingFrom: null, pendingConnection: null };
}

export function reduceEditorState(state, action) {
  switch (action.type) {
    case 'set-tool':
      return { ...state, tool: action.tool, connectingFrom: null, pendingConnection: null };
    case 'node-click':
      if (state.tool !== 'connect') return { ...state, selectedId: action.id, pendingConnection: null };
      if (!state.connectingFrom) return { ...state, connectingFrom: action.id, selectedId: action.id };
      return { ...state, connectingFrom: null, selectedId: action.id, pendingConnection: [state.connectingFrom, action.id] };
    case 'connection-consumed':
      return { ...state, pendingConnection: null };
    case 'clear-selection':
      return { ...state, selectedId: null, connectingFrom: null, pendingConnection: null };
    default:
      return state;
  }
}

function element(name, attributes = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function positionModel(model, width, height) {
  const positions = layoutPetriNet(model, width, height);
  return {
    ...model,
    nodes: model.nodes.map((node) => {
      const position = positions.get(node.id) ?? { x: width / 2, y: height / 2 };
      return { ...node, x: Number.isFinite(node.x) ? node.x : position.x, y: Number.isFinite(node.y) ? node.y : position.y };
    }),
  };
}

export function createNetEditor(container, callbacks = {}) {
  let model = positionModel(callbacks.model ?? { nodes: [], arcs: [], initialMarking: {}, finalPlaces: [], metadata: {} }, 1000, 620);
  let state = createEditorState();
  let marking = { ...(model.initialMarking ?? {}) };
  let simulation = { enabled: [], onFire: null };
  const svg = element('svg', { class: 'net-editor-svg', viewBox: '0 0 1000 620', role: 'application', 'aria-label': 'Editor gráfico de red de Petri' });
  container.replaceChildren(svg);

  function notify() {
    callbacks.onChange?.(model);
    callbacks.onSelection?.(model.nodes.find((node) => node.id === state.selectedId) ?? null);
  }

  function pointFromEvent(event) {
    const point = svg.createSVGPoint();
    point.x = event.clientX; point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }

  function render() {
    svg.replaceChildren();
    const defs = element('defs');
    const marker = element('marker', { id: 'editor-arrow', markerWidth: 8, markerHeight: 8, refX: 7, refY: 4, orient: 'auto' });
    marker.append(element('path', { d: 'M0,0 L8,4 L0,8 z', fill: '#496064' }));
    defs.append(marker);
    svg.append(defs);
    const byId = new Map(model.nodes.map((node) => [node.id, node]));

    for (const arc of model.arcs) {
      const source = byId.get(arc.source); const target = byId.get(arc.target);
      if (!source || !target) continue;
      const start = nodeBoundary(source, target, source);
      const end = nodeBoundary(target, source, target);
      const path = element('path', {
        class: 'editor-arc', d: `M${start.x},${start.y} L${end.x},${end.y}`,
        'marker-end': 'url(#editor-arrow)', 'data-id': arc.id,
      });
      path.addEventListener('click', (event) => {
        event.stopPropagation();
        if (state.tool === 'delete') { model = removeElement(model, arc.id); render(); notify(); }
      });
      svg.append(path);
    }

    function redrawArcGeometry() {
      const currentById = new Map(model.nodes.map((item) => [item.id, item]));
      for (const arc of model.arcs) {
        const source = currentById.get(arc.source); const target = currentById.get(arc.target);
        const path = svg.querySelector(`.editor-arc[data-id="${arc.id}"]`);
        if (!source || !target || !path) continue;
        const start = nodeBoundary(source, target, source); const end = nodeBoundary(target, source, target);
        path.setAttribute('d', `M${start.x},${start.y} L${end.x},${end.y}`);
      }
    }

    for (const node of model.nodes) {
      const classes = [
        'editor-node', `editor-node--${node.type}`,
        state.selectedId === node.id ? 'is-selected' : '',
        state.connectingFrom === node.id ? 'is-connecting' : '',
        simulation.enabled.includes(node.id) ? 'is-enabled' : '',
      ].filter(Boolean).join(' ');
      const group = element('g', { class: classes, transform: `translate(${node.x} ${node.y})`, tabindex: 0, 'data-id': node.id });
      if (node.type === 'place') {
        group.append(element('circle', { r: 27, class: 'editor-place' }));
        const count = marking[node.id] ?? 0;
        if (count === 1) group.append(element('circle', { r: 7, class: 'editor-token' }));
        else if (count > 1) {
          const token = element('text', { y: 6, class: 'editor-token-count' }); token.textContent = count; group.append(token);
        }
      } else {
        group.append(element('rect', { x: -24, y: -31, width: 48, height: 62, rx: node.silent ? 12 : 5, class: 'editor-transition' }));
        const label = element('text', { y: 6, class: 'editor-transition-label' }); label.textContent = node.silent ? 'τ' : node.label || '?'; group.append(label);
      }
      if (node.label && node.type === 'place') {
        const caption = element('text', { y: 47, class: 'editor-caption' }); caption.textContent = node.label; group.append(caption);
      }
      group.addEventListener('click', (event) => {
        event.stopPropagation();
        if (state.tool === 'delete') {
          model = removeElement(model, node.id); state = reduceEditorState(state, { type: 'clear-selection' }); render(); notify(); return;
        }
        if (state.tool === 'simulate' && simulation.enabled.includes(node.id)) {
          simulation.onFire?.(node.id); return;
        }
        state = reduceEditorState(state, { type: 'node-click', id: node.id });
        if (state.pendingConnection) {
          try { model = addArc(model, state.pendingConnection[0], state.pendingConnection[1]); }
          catch (error) { callbacks.onError?.(error.message); }
          state = reduceEditorState(state, { type: 'connection-consumed' });
        }
        render(); notify();
      });

      let dragStart = null;
      group.addEventListener('pointerdown', (event) => {
        if (state.tool !== 'select') return;
        event.stopPropagation(); group.setPointerCapture(event.pointerId);
        const point = pointFromEvent(event); dragStart = { dx: point.x - node.x, dy: point.y - node.y };
      });
      group.addEventListener('pointermove', (event) => {
        if (!dragStart) return;
        const point = pointFromEvent(event);
        node.x = point.x - dragStart.dx; node.y = point.y - dragStart.dy;
        group.setAttribute('transform', `translate(${node.x} ${node.y})`);
        redrawArcGeometry();
      });
      group.addEventListener('pointerup', () => { if (dragStart) { dragStart = null; notify(); } });
      svg.append(group);
    }
  }

  svg.addEventListener('click', (event) => {
    if (event.target !== svg) return;
    if (state.tool === 'place' || state.tool === 'transition') {
      const point = pointFromEvent(event);
      model = addNode(model, { type: state.tool, x: point.x, y: point.y, label: state.tool === 'transition' ? 'nueva' : '' });
      state = { ...state, selectedId: model.nodes.at(-1).id };
      render(); notify();
    } else {
      state = reduceEditorState(state, { type: 'clear-selection' }); render(); notify();
    }
  });

  render();
  return {
    setTool(tool) { state = reduceEditorState(state, { type: 'set-tool', tool }); render(); },
    setModel(nextModel) { model = positionModel(structuredClone(nextModel), 1000, 620); marking = { ...(model.initialMarking ?? {}) }; state = createEditorState(); render(); notify(); },
    getModel() { return structuredClone(model); },
    setMarking(nextMarking) { marking = { ...nextMarking }; render(); },
    setSimulation(enabled, onFire) { simulation = { enabled: [...enabled], onFire }; state = reduceEditorState(state, { type: 'set-tool', tool: 'simulate' }); render(); },
    updateSelected(changes) {
      if (!state.selectedId) return;
      model = updateNode(model, state.selectedId, changes); marking = { ...(model.initialMarking ?? {}) };
      render(); notify();
    },
    select(id) { state = { ...state, selectedId: id }; render(); notify(); },
  };
}
