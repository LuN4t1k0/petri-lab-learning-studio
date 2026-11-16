import { parseTraceLanguage } from './core/trace-parser.js';
import { appendTraceToLanguage, evidenceSummary } from './core/learning-project.js';
import { createEmptyNet, enabledTransitions, fireTransition } from './core/net-operations.js';
import { analyzeWorkflowNet, exploreReachability } from './core/workflow-analysis.js';
import { explainAlpha } from './miners/alpha-miner.js';
import { createNetEditor } from './ui/net-editor.js';
import { renderPetriNet } from './ui/svg-renderer.js';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const defaultLog = '<a,b,c,d>^3\n<a,c,b,d>^2\n<a,e,d>';
const saved = (() => { try { return JSON.parse(localStorage.getItem('petrilab-learning-project') ?? '{}'); } catch { return {}; } })();
let logText = saved.logText ?? defaultLog;
let lesson = explainAlpha(parseTraceLanguage(logText));
let manualModel = saved.manualModel ?? lesson.model;
let marking = { ...(manualModel.initialMarking ?? {}) };
let trace = [];
let mode = 'discover';
let alphaStep = 0;
const logInput = $('#event-log');
logInput.value = logText;

function persist() { localStorage.setItem('petrilab-learning-project', JSON.stringify({ logText, manualModel })); }
function modelStats(model) { const places = model.nodes.filter((node) => node.type === 'place').length; const transitions = model.nodes.filter((node) => node.type === 'transition').length; return `${places} lugares · ${transitions} transiciones · ${model.arcs.length} arcos`; }
function showCanvasMessage(message, error = false) { const target = $('#canvas-message'); target.textContent = message; target.classList.toggle('error', error); }
function setCoach(title, content) { $('#coach-title').textContent = title; $('#coach-content').innerHTML = content; }

const editor = createNetEditor($('#manual-canvas'), {
  model: manualModel,
  onChange(model) { manualModel = model; $('#canvas-stats').textContent = modelStats(model); persist(); if (mode === 'check') renderEvidence(); },
  onSelection(node) {
    const inspector = $('#node-inspector'); inspector.hidden = !node || mode === 'discover'; if (!node) return;
    $('#selected-type').textContent = node.type === 'place' ? `Lugar · ${node.id}` : `Transición · ${node.id}`;
    $('#selected-label').value = node.label ?? ''; $('#token-field').hidden = node.type !== 'place'; $('#selected-tokens').value = node.tokens ?? manualModel.initialMarking?.[node.id] ?? 0;
  },
  onError(message) { showCanvasMessage(message, true); },
});
$('#canvas-stats').textContent = modelStats(manualModel);

function buildCoach() { return `<div class="coach-card"><span class="concept-icon">○</span><div><strong>Lugar</strong><p>Representa una condición o estado. Puede contener tokens.</p></div></div><div class="coach-card"><span class="concept-icon square">▯</span><div><strong>Transición</strong><p>Representa una actividad o cambio de estado.</p></div></div><div class="coach-card"><span class="concept-icon">→</span><div><strong>Arco</strong><p>Define qué consume y qué produce una transición.</p></div></div>`; }
function simulationCoach() { return `<div class="coach-note"><b>¿Cuándo está habilitada?</b><p>Cuando cada lugar de entrada tiene los tokens requeridos.</p></div><div class="coach-note"><b>¿Qué ocurre al disparar?</b><p>Consume tokens de sus entradas y produce tokens en sus salidas. Las etiquetas forman una traza.</p></div>`; }
function setNotation(symbol, title, explanation, content = '') { setCoach(title, `<div class="notation-hero"><span>${symbol}</span><p>${explanation}</p></div>${content}`); }

function updateMode(nextMode) {
  mode = nextMode;
  $$('.mode-tabs button').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
  $$('.rail-panel').forEach((panel) => { panel.hidden = panel.dataset.panel !== mode; });
  $('#alpha-stage').hidden = mode !== 'discover'; $('#editor-stage').hidden = mode === 'discover'; $('#evidence-panel').hidden = mode !== 'check'; $('#node-inspector').hidden = true;
  if (mode === 'discover') renderAlphaStep();
  if (mode === 'build') { editor.setTool('select'); setCoach('Construye con reglas', buildCoach()); }
  if (mode === 'check') { editor.setTool('select'); renderEvidence(); }
  if (mode === 'simulate') { resetSimulation(false); setCoach('Simulación por tokens', simulationCoach()); }
  $('#editor-kicker').textContent = mode === 'simulate' ? 'Ejecución paso a paso' : mode === 'check' ? 'Modelo bajo análisis' : 'Lienzo de trabajo';
  $('#editor-title').textContent = mode === 'simulate' ? 'Dispara transiciones habilitadas' : mode === 'check' ? 'Evidencia estructural y dinámica' : 'Red del estudiante';
}

function setList(values, formatter = (value) => value) { return `<div class="set-display">{ ${values.map(formatter).join(', ') || '∅'} }</div>`; }
function footprintTable() {
  const activities = lesson.TL;
  return `<div class="footprint-wrap"><table class="footprint"><thead><tr><th></th>${activities.map((a) => `<th>${a}</th>`).join('')}</tr></thead><tbody>${activities.map((left) => `<tr><th>${left}</th>${activities.map((right) => { const relation = lesson.footprint[left][right]; const kind = relation === '#' ? 'choice' : relation === '∥' ? 'parallel' : 'causal'; return `<td class="rel-${kind}" title="${left} ${relation} ${right}">${relation}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function renderAlphaStep() {
  const nav = $('#alpha-steps');
  nav.replaceChildren(...lesson.steps.map((step, index) => {
    const button = document.createElement('button'); button.className = index === alphaStep ? 'active' : index < alphaStep ? 'done' : '';
    button.innerHTML = `<span>${index < alphaStep ? '✓' : index + 1}</span><small>${step.key === 'alpha' ? 'α(L)' : step.key}</small>`;
    button.addEventListener('click', () => { alphaStep = index; renderAlphaStep(); }); return button;
  }));
  $('#alpha-progress').textContent = `Paso ${alphaStep + 1} de 8`; $('#alpha-progress-bar').style.width = `${((alphaStep + 1) / 8) * 100}%`;
  const step = lesson.steps[alphaStep];
  const explanations = {
    TL: ['Actividades observadas', 'Reunimos todas las actividades diferentes que aparecen al menos una vez en el log.'],
    TI: ['Actividades iniciales', 'Buscamos la primera actividad de cada traza. Son las candidatas a recibir el token inicial.'],
    TO: ['Actividades finales', 'Buscamos la última actividad de cada traza. Conducirán al lugar final.'],
    XL: ['Pares candidatos y footprint', 'La matriz resume causalidad (→), relación inversa (←), paralelismo (∥) y elección (#). Con ella formamos pares de conjuntos causales.'],
    YL: ['Pares maximales', 'Eliminamos candidatos contenidos en otros. Cada par maximal se convertirá en un lugar de la red.'],
    PL: ['Lugares de la red', 'Creamos un lugar inicial, uno por cada par maximal y un lugar final.'],
    FL: ['Relación de flujo', 'Conectamos actividades y lugares según los conjuntos de entrada y salida, incluyendo inicio y fin.'],
    alpha: ['Red descubierta α(L)', 'El resultado integra actividades, lugares y arcos derivados únicamente del comportamiento observado.'],
  };
  const [title, description] = explanations[step.key];
  let body = '';
  if (['TL', 'TI', 'TO'].includes(step.key)) body = setList(step.value);
  if (step.key === 'XL') body = `${footprintTable()}<h4>X<sub>L</sub> · candidatos</h4>${setList(step.value, (pair) => pair.key)}`;
  if (step.key === 'YL') body = `<div class="candidate-grid">${step.value.map((pair) => `<div><span>${pair.inputs.join(',')}</span><b>→</b><span>${pair.outputs.join(',')}</span></div>`).join('')}</div>`;
  if (step.key === 'PL' || step.key === 'FL') body = `<div class="formula-list">${step.value.map((value) => `<code>${value}</code>`).join('')}</div>`;
  if (step.key === 'alpha') body = '<div class="alpha-model-canvas" id="alpha-model-canvas"></div>';
  $('#alpha-step-content').innerHTML = `<header><span>${alphaStep + 1}</span><div><small>${step.key === 'alpha' ? 'α(L)' : step.key}</small><h3>${title}</h3><p>${description}</p></div></header>${body}<footer><button id="prev-alpha" ${alphaStep === 0 ? 'disabled' : ''}>← Anterior</button><button id="next-alpha" ${alphaStep === 7 ? 'disabled' : ''}>Siguiente →</button></footer>`;
  $('#prev-alpha').addEventListener('click', () => { alphaStep -= 1; renderAlphaStep(); }); $('#next-alpha').addEventListener('click', () => { alphaStep += 1; renderAlphaStep(); });
  if (step.key === 'alpha') renderPetriNet($('#alpha-model-canvas'), lesson.model);
  setNotation(step.key === 'alpha' ? 'α(L)' : step.key, title, description, step.key === 'XL' ? '<div class="relation-key"><span>→ causal</span><span>∥ paralelo</span><span># elección</span></div>' : '');
}

function calculateAlpha() {
  $('#log-error').textContent = '';
  try { logText = logInput.value; const log = parseTraceLanguage(logText); lesson = explainAlpha(log); $('#log-case-count').textContent = `${log.totalCases} casos`; alphaStep = 0; renderAlphaStep(); persist(); }
  catch (error) { $('#log-error').textContent = error.message; }
}

function renderEvidence() {
  const structural = analyzeWorkflowNet(manualModel);
  const dynamic = structural.isPetriNet ? exploreReachability(manualModel, { maxStates: 300 }) : { finalReachable: false, deadTransitions: [], residualTokensAtFinal: false, truncated: false, statesExplored: 0 };
  const summary = evidenceSummary(structural, dynamic); const panel = $('#evidence-panel'); panel.hidden = false;
  panel.innerHTML = `<div class="score-card ${summary.level}"><div><span>${summary.score}</span><small>/100</small></div><section><strong>${summary.title}</strong><p>${summary.description}</p></section></div><div class="check-list">${structural.checks.map((check) => `<article class="${check.passed ? 'passed' : 'failed'}"><span>${check.passed ? '✓' : '!'}</span><div><strong>${check.title}</strong><p>${check.detail}</p>${check.passed ? '' : `<small>Cómo corregir: ${check.fix}</small>`}</div></article>`).join('')}</div><div class="dynamic-checks"><h3>Comportamiento explorado</h3><p><b>${dynamic.statesExplored}</b> marcados analizados</p><p>${dynamic.finalReachable ? '✓ Final alcanzable' : '× No alcanzamos el final'}</p><p>${dynamic.deadTransitions.length ? `⚠ ${dynamic.deadTransitions.length} transición(es) muerta(s)` : '✓ Sin transiciones muertas observadas'}</p></div>`;
  setCoach('Evidencia de tu solución', '<div class="coach-note"><b>Estructura + comportamiento</b><p>Una WF-net no solo debe tener la forma correcta: también esperamos poder terminar sin dejar trabajo pendiente.</p></div>');
}

function resetSimulation(resetTrace = true) {
  marking = { ...(manualModel.initialMarking ?? {}) }; if (resetTrace) trace = [];
  const enabled = enabledTransitions(manualModel, marking); editor.setMarking(marking); editor.setSimulation(enabled, fireFromEditor); $('#current-trace').textContent = `⟨ ${trace.join(', ')} ⟩`;
  showCanvasMessage(enabled.length ? `${enabled.length} transición(es) habilitada(s)` : 'No hay transiciones habilitadas', !enabled.length);
}
function fireFromEditor(transitionId) {
  try { marking = fireTransition(manualModel, marking, transitionId); const transition = manualModel.nodes.find((node) => node.id === transitionId); if (transition && !transition.silent && transition.label) trace.push(transition.label); const enabled = enabledTransitions(manualModel, marking); editor.setMarking(marking); editor.setSimulation(enabled, fireFromEditor); $('#current-trace').textContent = `⟨ ${trace.join(', ')} ⟩`; showCanvasMessage(enabled.length ? `${enabled.length} transición(es) habilitada(s)` : 'Ejecución detenida'); }
  catch (error) { showCanvasMessage(error.message, true); }
}

$$('.mode-tabs button').forEach((button) => button.addEventListener('click', () => updateMode(button.dataset.mode)));
$('#discover-button').addEventListener('click', calculateAlpha);
$('#load-alpha-model').addEventListener('click', () => { manualModel = structuredClone(lesson.model); editor.setModel(manualModel); updateMode('build'); persist(); showCanvasMessage('Modelo Alpha cargado. Ahora puedes modificarlo.'); });
$('#check-network').addEventListener('click', renderEvidence);
$('#new-network').addEventListener('click', () => { manualModel = createEmptyNet(); editor.setModel(manualModel); showCanvasMessage('Red vacía creada. Añade un lugar para comenzar.'); });
$$('#editor-tools button').forEach((button) => button.addEventListener('click', () => { $$('#editor-tools button').forEach((item) => item.classList.toggle('active', item === button)); editor.setTool(button.dataset.tool); showCanvasMessage(button.dataset.tool === 'connect' ? 'Selecciona el origen y luego el destino' : `Herramienta: ${button.textContent.trim()}`); }));
$('#selected-label').addEventListener('input', (event) => editor.updateSelected({ label: event.target.value })); $('#selected-tokens').addEventListener('input', (event) => editor.updateSelected({ tokens: Number(event.target.value) }));
$('#reset-simulation').addEventListener('click', () => resetSimulation(true));
$('#save-trace').addEventListener('click', () => { if (!trace.length) { showCanvasMessage('Dispara al menos una transición antes de guardar.', true); return; } logText = appendTraceToLanguage(logText, trace); logInput.value = logText; persist(); showCanvasMessage('Traza añadida al event log. Puedes redescubrir el modelo.'); trace = []; resetSimulation(false); });

renderAlphaStep(); updateMode('discover');
