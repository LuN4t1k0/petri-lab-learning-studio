import { parseTraceLanguage } from './core/trace-parser.js';
import { appendTraceToLanguage, evidenceSummary } from './core/learning-project.js';
import { createEmptyNet, enabledTransitions, fireTransition } from './core/net-operations.js';
import { analyzeWorkflowNet, exploreReachability } from './core/workflow-analysis.js';
import { explainAlpha } from './miners/alpha-miner.js';
import { createNetEditor } from './ui/net-editor.js';
import { renderPetriNet } from './ui/svg-renderer.js';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const defaultLog = '<a,b,e,f>^2\n<a,b,e,c,d,b,f>^3\n<a,b,c,e,d,b,f>^2\n<a,b,c,d,e,b,f>^4\n<a,e,b,c,d,b,f>^3';
const saved = (() => { try { return JSON.parse(localStorage.getItem('petrilab-learning-project') ?? '{}'); } catch { return {}; } })();
let logText = saved.logText ?? defaultLog;
let lesson = explainAlpha(parseTraceLanguage(logText));
let manualModel = saved.manualModel ?? lesson.model;
let marking = { ...(manualModel.initialMarking ?? {}) };
let trace = [];
let mode = 'discover';
let alphaStep = 0;
let furthestAlphaStep = 0;
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

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]); }
function setList(values, formatter = (value) => value) { return `<div class="set-display">{ ${values.map((value) => escapeHtml(formatter(value))).join(', ') || '∅'} }</div>`; }
function traceText(activities) { return `⟨${activities.map(escapeHtml).join(', ')}⟩`; }

function alphaGlossary() {
  const terms = [
    ['a > b', 'b aparece inmediatamente después de a en alguna traza.'],
    ['a → b', 'a sigue directamente a b en un sentido causal: existe a > b, pero no b > a.'],
    ['a ∥ b', 'Se observan ambos órdenes: a > b y b > a.'],
    ['a # b', 'No se observa sucesión directa entre a y b en ningún sentido.'],
    ['Xₗ', 'Todos los pares de conjuntos que cumplen las reglas causales e internas de Alpha.'],
    ['Yₗ', 'Los elementos maximales de Xₗ; ninguno está contenido en otro candidato válido.'],
    ['Pₗ', 'Los lugares creados a partir de Yₗ, más el lugar inicial y el final.'],
    ['Fₗ', 'Los arcos que conectan transiciones y lugares.'],
  ];
  return `<details class="alpha-glossary"><summary>Glosario de símbolos</summary><div>${terms.map(([term, meaning]) => `<article><code>${term}</code><p>${meaning}</p></article>`).join('')}</div></details>`;
}

function stepHelp(stepKey) {
  const firstVariant = lesson.variants[0];
  const firstDirect = lesson.directlyFollows[0];
  const footprintExample = lesson.relationSets.parallel[0] ?? lesson.relationSets.causality[0];
  const firstCandidate = lesson.candidateExplanations[0];
  const discarded = lesson.maximality.find((item) => !item.isMaximal);
  const derivedPlace = lesson.placeExplanations.find((item) => item.kind === 'derived');
  const internalArc = lesson.flowExplanations.find((item) => item.kind === 'input');
  const content = {
    log: {
      goal: 'Entender qué comportamiento fue observado antes de inferir el modelo.',
      rule: 'Las frecuencias cuentan casos; las relaciones se obtienen de las secuencias de actividades.',
      example: firstVariant ? `V${firstVariant.index} = ${traceText(firstVariant.activities)} aparece ${firstVariant.frequency} veces.` : 'No hay variantes.',
      mistake: 'Confundir una variante repetida con varias actividades diferentes.',
    },
    direct: {
      goal: 'Encontrar todas las parejas que aparecen consecutivamente.',
      rule: 'Solo importa la posición inmediata: no se saltan actividades intermedias.',
      example: firstDirect ? `${escapeHtml(firstDirect.key)} aparece en ${firstDirect.caseCount} casos.` : 'No hay pares consecutivos.',
      mistake: 'Usar precedencia indirecta. En ⟨a,b,c⟩ existe a > b, pero no a > c.',
    },
    footprint: {
      goal: 'Clasificar cada par comparando Directly Follows en ambos sentidos.',
      rule: 'Un solo sentido produce causalidad; ambos producen paralelismo; ninguno produce #.',
      example: footprintExample ? `En este log obtenemos ${escapeHtml(footprintExample)}.` : 'No hay una relación para ejemplificar.',
      mistake: 'Interpretar ∥ como simultaneidad medida: Alpha lo infiere al observar ambos órdenes.',
    },
    XL: {
      goal: 'Construir todos los pares de conjuntos permitidos por las relaciones del footprint.',
      rule: 'Cada elemento de A debe causar a cada elemento de B; dentro de A y B solo puede haber #.',
      example: firstCandidate ? `${escapeHtml(firstCandidate.key)} se apoya en ${firstCandidate.causalRelations.map(escapeHtml).join(', ')}.` : 'No hay candidatos.',
      mistake: 'Agrupar actividades paralelas dentro del mismo lado; allí deben estar relacionadas por #.',
    },
    YL: {
      goal: 'Conservar solamente los candidatos maximales de Xₗ.',
      rule: 'Se descarta un candidato si sus dos lados están contenidos en otro candidato válido mayor.',
      example: discarded ? `${escapeHtml(discarded.key)} se descarta porque lo contiene ${discarded.containedBy.map(escapeHtml).join(', ')}.` : 'Todos los candidatos ya son maximales.',
      mistake: 'Elegir por cantidad de símbolos sin comprobar la inclusión en ambos lados.',
    },
    PL: {
      goal: 'Transformar cada elemento de Yₗ en un lugar de la red.',
      rule: 'Se añade un lugar inicial, uno por cada par maximal y un lugar final.',
      example: derivedPlace ? `${escapeHtml(derivedPlace.pairKey)} origina ${escapeHtml(derivedPlace.place)}.` : 'No hay lugares derivados.',
      mistake: 'Crear lugares para elementos descartados de Xₗ que no pertenecen a Yₗ.',
    },
    FL: {
      goal: 'Convertir la estructura de cada par maximal en arcos dirigidos.',
      rule: 'A conecta hacia el lugar; el lugar conecta hacia B. TI y TO conectan los extremos.',
      example: internalArc ? `${escapeHtml(internalArc.arc)} porque ${escapeHtml(internalArc.rule)}.` : 'No hay arcos internos.',
      mistake: 'Invertir los arcos: las actividades de A entran al lugar y las de B salen de él.',
    },
    alpha: {
      goal: 'Leer la red como la síntesis gráfica de todas las decisiones anteriores.',
      rule: 'Transiciones = actividades; lugares = condiciones deducidas de Yₗ; arcos = Fₗ.',
      example: derivedPlace ? `Selecciona el lugar ${escapeHtml(derivedPlace.place)} para ver su procedencia.` : 'Selecciona un elemento de la red.',
      mistake: 'Ver el dibujo como un resultado independiente: cada elemento debe rastrearse hasta el log.',
    },
  }[stepKey];
  return `<section class="lesson-help">
    <article><small>Qué estamos buscando</small><p>${content.goal}</p></article>
    <article><small>Regla en palabras</small><p>${content.rule}</p></article>
    <article><small>Ejemplo del log actual</small><p>${content.example}</p></article>
    <article class="common-mistake"><small>Error frecuente</small><p>${content.mistake}</p></article>
  </section>`;
}

function logOverview() {
  return `<div class="log-summary">
    <article><strong>${lesson.variants.length}</strong><span>variantes</span></article>
    <article><strong>${lesson.totalCases}</strong><span>casos</span></article>
    <article><strong>${lesson.TL.length}</strong><span>actividades</span></article>
  </div>
  <div class="variant-list">${lesson.variants.map((variant) => `<article>
    <span>V${variant.index}</span><code>${traceText(variant.activities)}</code><b>× ${variant.frequency}</b>
  </article>`).join('')}</div>
  <div class="derived-sets">
    <article><small>T<sub>L</sub> · actividades</small>${setList(lesson.TL)}</article>
    <article><small>T<sub>I</sub> · inicio</small>${setList(lesson.TI)}</article>
    <article><small>T<sub>O</sub> · fin</small>${setList(lesson.TO)}</article>
  </div>
  <section class="discovery-context">
    <h4>Descubrir el proceso, no copiar las trazas</h4>
    <div><article><strong>El log es evidencia</strong><p>Contiene casos observados, no necesariamente todos los caminos que el proceso permite.</p></article><article><strong>El modelo debe generalizar</strong><p>Un proceso con bucles puede generar infinitas trazas; memorizar cada variante produciría sobreajuste.</p></article><article><strong>La salida es una Workflow Net</strong><p>Alpha resume relaciones del log como lugares, transiciones y arcos que explican el flujo.</p></article></div>
    <aside><strong>Correspondencia con la definición formal</strong><p>Este primer paso visual reúne los pasos formales 1–3: <code>T<sub>L</sub></code>, <code>T<sub>I</sub></code> y <code>T<sub>O</sub></code>. Después calculamos las relaciones auxiliares y continuamos con <code>X<sub>L</sub></code>, <code>Y<sub>L</sub></code>, <code>P<sub>L</sub></code>, <code>F<sub>L</sub></code> y <code>α(L)</code>.</p></aside>
  </section>`;
}

function directEvidence() {
  return `<div class="rule-box"><b>Cómo se obtiene</b><p><code>a &gt;<sub>L</sub> b</code> cuando <b>b aparece inmediatamente después de a</b> en al menos una traza.</p></div>
  <h4>Conjunto &gt;<sub>L</sub></h4>
  ${setList(lesson.directlyFollows, (relation) => relation.key)}
  <div class="direct-evidence">${lesson.directlyFollows.map((relation) => `<article>
    <header><code>${escapeHtml(relation.key)}</code><span>${relation.caseCount} caso${relation.caseCount === 1 ? '' : 's'}</span></header>
    <div>${relation.evidence.map((item) => `<span>V${item.variantIndex} · posición ${item.positions.map((position) => `${position}→${position + 1}`).join(', ')} · ×${item.frequency}</span>`).join('')}</div>
  </article>`).join('')}</div>`;
}

function footprintTable() {
  const activities = lesson.TL;
  return `<div class="footprint-wrap"><table class="footprint"><thead><tr><th></th>${activities.map((a) => `<th>${escapeHtml(a)}</th>`).join('')}</tr></thead><tbody>${activities.map((left) => `<tr><th>${escapeHtml(left)}</th>${activities.map((right) => { const relation = lesson.footprint[left][right]; const kind = relation === '#' ? 'choice' : relation === '∥' ? 'parallel' : 'causal'; return `<td class="rel-${kind}"><button data-left="${escapeHtml(left)}" data-right="${escapeHtml(right)}" data-relation="${relation}" title="Explicar ${escapeHtml(left)} ${relation} ${escapeHtml(right)}">${relation}</button></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function footprintStep() {
  return `<div class="rule-grid">
    <article><b>a → b</b><p>Existe a &gt; b y no existe b &gt; a.</p></article>
    <article><b>a ∥ b</b><p>Existen a &gt; b y b &gt; a.</p></article>
    <article><b>a # b</b><p>No existe sucesión directa en ningún sentido.</p></article>
  </div>
  <div class="relation-groups">
    <article><small>Causalidad</small>${setList(lesson.relationSets.causality)}</article>
    <article><small>Paralelismo</small>${setList(lesson.relationSets.parallel)}</article>
    <article><small>Sin relación</small>${setList(lesson.relationSets.unrelated)}</article>
  </div>
  <h4>Matriz footprint · selecciona una celda</h4>
  ${footprintTable()}
  <div class="relation-detail" id="relation-detail">Selecciona una relación para ver cómo se obtiene.</div>`;
}

function candidateCards(candidates, maximal = false) {
  return `<div class="candidate-explanations">${candidates.map((pair) => {
    const explanation = lesson.candidateExplanations.find((item) => item.key === pair.key);
    const internal = [...explanation.inputUnrelated, ...explanation.outputUnrelated];
    return `<details class="candidate-help ${maximal ? 'maximal' : ''}"><summary><span>{${pair.inputs.map(escapeHtml).join(', ')}}</span><b>→</b><span>{${pair.outputs.map(escapeHtml).join(', ')}}</span><em>¿Por qué es válido?</em></summary><div>
      <p><strong>Causalidad entre A y B:</strong> ${explanation.causalRelations.map(escapeHtml).join(', ')}</p>
      <p><strong>Relaciones internas:</strong> ${internal.length ? internal.map(escapeHtml).join(', ') : 'No se requieren: ambos lados son singleton.'}</p>
    </div></details>`;
  }).join('')}</div>`;
}

function directProof(left, right) {
  const direct = lesson.directlyFollows.find((item) => item.left === left && item.right === right);
  if (!direct) return `<span class="proof-missing">No aparece ${escapeHtml(left)} &gt; ${escapeHtml(right)}</span>`;
  return `<span class="proof-present">${escapeHtml(left)} &gt; ${escapeHtml(right)}: ${direct.evidence.map((item) => `V${item.variantIndex} (${item.positions.map((position) => `${position}→${position + 1}`).join(', ')})`).join(' · ')}</span>`;
}

function relationExplanation(left, right, relation) {
  const descriptions = {
    '→': `Existe ${escapeHtml(left)} &gt; ${escapeHtml(right)} y no existe el sentido inverso.`,
    '←': `Existe ${escapeHtml(right)} &gt; ${escapeHtml(left)} y no existe el sentido directo.`,
    '∥': `Se observaron los dos órdenes; Alpha los interpreta como paralelismo.`,
    '#': 'No se observó sucesión directa en ninguno de los dos sentidos.',
  };
  return `<strong>${escapeHtml(left)} ${relation} ${escapeHtml(right)}</strong><p>${descriptions[relation]}</p><div class="relation-proof">${directProof(left, right)}${left === right ? '' : directProof(right, left)}</div>`;
}

function maximalityExplanation() {
  const discarded = lesson.maximality.filter((item) => !item.isMaximal);
  if (!discarded.length) return '<p class="empty-explanation">Ningún candidato fue descartado.</p>';
  return `<div class="discarded-list"><h4>Candidatos de Xₗ que no pasan a Yₗ</h4>${discarded.map((item) => `<details><summary><code>${escapeHtml(item.key)}</code><span>Descartado</span></summary><p>Está contenido en ${item.containedBy.map((key) => `<code>${escapeHtml(key)}</code>`).join(', ')}. Por eso no es maximal.</p></details>`).join('')}</div>`;
}

function placeCards() {
  return `<div class="origin-list">${lesson.placeExplanations.map((item) => `<details><summary><code>${escapeHtml(item.place)}</code><span>${item.kind === 'derived' ? 'Desde Yₗ' : item.kind === 'initial' ? 'Inicio' : 'Fin'}</span></summary><p>${escapeHtml(item.rule)}</p></details>`).join('')}</div>`;
}

function flowCards() {
  return `<div class="origin-list flow-origins">${lesson.flowExplanations.map((item) => `<details><summary><code>${escapeHtml(item.arc)}</code><span>${item.kind === 'initial' ? 'TI' : item.kind === 'final' ? 'TO' : 'YL'}</span></summary><p>Regla aplicada: <code>${escapeHtml(item.rule)}</code>.</p></details>`).join('')}</div>`;
}

function networkOrigin(node) {
  const target = $('#network-origin');
  if (node.type === 'transition') {
    target.innerHTML = `<strong>Transición ${escapeHtml(node.label)}</strong><p>Representa la actividad ${escapeHtml(node.label)} observada en T<sub>L</sub>.</p>`;
    return;
  }
  const placeName = node.label === 'inicio' ? 'i_L' : node.label === 'fin' ? 'o_L' : `p(${node.label})`;
  const origin = lesson.placeExplanations.find((item) => item.place === placeName);
  target.innerHTML = origin
    ? `<strong>${escapeHtml(origin.place)}</strong><p>${escapeHtml(origin.rule)}</p>`
    : `<strong>${escapeHtml(node.label || node.id)}</strong><p>Lugar de la red.</p>`;
}

function conformanceAndLimitations() {
  const oneLoops = lesson.limitations.shortLoopsOne;
  const twoLoops = lesson.limitations.shortLoopsTwo;
  const loopOneEvidence = oneLoops.length
    ? oneLoops.map((item) => `<code>V${item.variantIndex}: ${escapeHtml(item.activity)},${escapeHtml(item.activity)}</code>`).join(' ')
    : 'No se observó ninguno en este log.';
  const loopTwoEvidence = twoLoops.length
    ? twoLoops.map((item) => `<code>V${item.variantIndex}: ${escapeHtml(item.left)},${escapeHtml(item.middle)},${escapeHtml(item.left)}</code>`).join(' ')
    : 'No se observó ninguno en este log.';
  return `<section class="model-reading">
    <h4>Dimensiones de conformidad</h4>
    <p class="section-intro">Sirven para evaluar la calidad del modelo descubierto. Aquí se presentan como preguntas conceptuales; no son métricas numéricas calculadas por esta versión.</p>
    <div class="conformance-grid">${lesson.conformanceDimensions.map((dimension) => `<article><span>${escapeHtml(dimension.title)}</span><p>${escapeHtml(dimension.question)}</p></article>`).join('')}</div>
    <h4>Limitaciones de Alpha clásico</h4>
    <p class="section-intro">La red es la salida correcta del algoritmo para estas relaciones, pero Alpha clásico no representa bien todos los procesos posibles.</p>
    <div class="limitation-grid">
      <article class="${oneLoops.length ? 'detected' : ''}"><strong>Bucles de longitud 1</strong><p>Una repetición <code>a,a</code> se vuelve <code>a &gt; a</code> y el footprint clásico no la transforma correctamente en un lazo.</p><small>${loopOneEvidence}</small></article>
      <article class="${twoLoops.length ? 'detected' : ''}"><strong>Bucles de longitud 2</strong><p>Un patrón <code>a,b,a</code> puede confundirse con paralelismo porque aparecen ambos órdenes directos.</p><small>${loopTwoEvidence}</small></article>
      <article><strong>Dependencias no locales</strong><p>Si la relación depende de contexto lejano y no de vecinos directos, el footprint puede perderla.</p><small>Requiere análisis adicional; no se diagnostica solo con una celda de la matriz.</small></article>
      <article><strong>Lugares implícitos o redundantes</strong><p>El modelo descubierto puede contener lugares redundantes o no revelar lugares necesarios para distinguir comportamientos.</p><small>Debe revisarse junto con fitness, precision, generalization y simplicity.</small></article>
    </div>
    <p class="model-warning"><strong>Importante:</strong> que no detectemos un bucle corto en el log no demuestra que el proceso real no lo tenga; el log es una muestra del comportamiento.</p>
  </section>`;
}

function renderAlphaStep() {
  const nav = $('#alpha-steps');
  nav.replaceChildren(...lesson.steps.map((step, index) => {
    const button = document.createElement('button'); button.className = index === alphaStep ? 'active' : index < alphaStep ? 'done' : '';
    const labels = { log: 'Log', direct: '>L', footprint: 'Matriz', XL: 'XL', YL: 'YL', PL: 'PL', FL: 'FL', alpha: 'WF' };
    button.innerHTML = `<span>${index < alphaStep ? '✓' : index + 1}</span><small>${labels[step.key]}</small>`;
    button.disabled = index > furthestAlphaStep;
    button.addEventListener('click', () => { alphaStep = index; renderAlphaStep(); }); return button;
  }));
  $('#alpha-progress').textContent = `Paso ${alphaStep + 1} de 8`; $('#alpha-progress-bar').style.width = `${((alphaStep + 1) / 8) * 100}%`;
  const step = lesson.steps[alphaStep];
  const explanations = {
    log: ['Comprende el event log', 'Antes de calcular relaciones identificamos variantes, frecuencias, actividades y extremos del proceso.'],
    direct: ['Directly Follows', 'Recorremos cada variante de izquierda a derecha y reunimos todas las parejas consecutivas.'],
    footprint: ['Causalidad, paralelismo y unrelated', 'Comparamos cada par de actividades en ambos sentidos y construimos la matriz footprint.'],
    XL: ['Conjunto Xₗ', 'Formamos todos los pares (A,B) donde cada actividad de A causa a cada actividad de B y no hay relaciones internas en A ni en B.'],
    YL: ['Conjunto Yₗ', 'Conservamos solo los candidatos maximales de Xₗ. Cada elemento de Yₗ se convertirá en un lugar.'],
    PL: ['Lugares de la red', 'Creamos un lugar inicial, uno por cada par maximal y un lugar final.'],
    FL: ['Relación de flujo', 'Conectamos actividades y lugares según los conjuntos de entrada y salida, incluyendo inicio y fin.'],
    alpha: ['Workflow Net descubierta', 'Representamos gráficamente los lugares, transiciones y arcos deducidos en los pasos anteriores.'],
  };
  const [title, description] = explanations[step.key];
  let body = '';
  if (step.key === 'log') body = logOverview();
  if (step.key === 'direct') body = directEvidence();
  if (step.key === 'footprint') body = footprintStep();
  if (step.key === 'XL') body = `<div class="rule-box"><b>Cómo se obtiene X<sub>L</sub></b><p>Se combinan conjuntos causalmente conectados cuyos elementos internos están relacionados por #.</p></div><h4>${step.value.length} candidatos</h4>${candidateCards(step.value)}`;
  if (step.key === 'YL') body = `<div class="comparison-note"><strong>${lesson.XL.length}</strong><span>candidatos X<sub>L</sub></span><b>→</b><strong>${lesson.YL.length}</strong><span>maximales Y<sub>L</sub></span></div><h4>Elementos maximales</h4>${candidateCards(step.value, true)}${maximalityExplanation()}`;
  if (step.key === 'PL') body = `<div class="formula-list">${step.value.map((value) => `<code>${value}</code>`).join('')}</div><h4>Procedencia de cada lugar</h4>${placeCards()}`;
  if (step.key === 'FL') body = `<div class="formula-list">${step.value.map((value) => `<code>${value}</code>`).join('')}</div><h4>Regla que produce cada arco</h4>${flowCards()}`;
  if (step.key === 'alpha') body = `<div class="network-summary"><span>${lesson.model.nodes.filter((node) => node.type === 'place').length} lugares</span><span>${lesson.model.nodes.filter((node) => node.type === 'transition').length} transiciones</span><span>${lesson.model.arcs.length} arcos</span></div><div class="alpha-model-canvas" id="alpha-model-canvas"></div><div class="network-origin" id="network-origin"><strong>Selecciona un elemento de la red</strong><p>Verás qué actividad, par maximal o regla lo originó.</p></div>${conformanceAndLimitations()}`;
  const notation = { log: 'L', direct: '>ₗ', footprint: '→ ∥ #', XL: 'Xₗ', YL: 'Yₗ', PL: 'Pₗ', FL: 'Fₗ', alpha: 'WF' };
  $('#alpha-step-content').innerHTML = `<header><span>${alphaStep + 1}</span><div><small>${notation[step.key]}</small><h3>${title}</h3><p>${description}</p></div></header>${stepHelp(step.key)}${body}${alphaGlossary()}<footer><button id="prev-alpha" ${alphaStep === 0 ? 'disabled' : ''}>← Anterior</button><button id="next-alpha" ${alphaStep === 7 ? 'disabled' : ''}>Siguiente paso →</button></footer>`;
  $('#prev-alpha').addEventListener('click', () => { alphaStep -= 1; renderAlphaStep(); });
  $('#next-alpha').addEventListener('click', () => { alphaStep += 1; furthestAlphaStep = Math.max(furthestAlphaStep, alphaStep); renderAlphaStep(); });
  $$('.footprint button').forEach((button) => button.addEventListener('click', () => { $('#relation-detail').innerHTML = relationExplanation(button.dataset.left, button.dataset.right, button.dataset.relation); }));
  if (step.key === 'alpha') renderPetriNet($('#alpha-model-canvas'), lesson.model, { onNodeSelect: networkOrigin });
  setNotation(notation[step.key], title, description, step.key === 'footprint' ? '<div class="relation-key"><span>→ causal</span><span>∥ paralelo</span><span># unrelated</span></div>' : '');
}

function calculateAlpha() {
  $('#log-error').textContent = '';
  try { logText = logInput.value; const log = parseTraceLanguage(logText); lesson = explainAlpha(log); $('#log-case-count').textContent = `${log.totalCases} casos`; alphaStep = 0; furthestAlphaStep = 0; renderAlphaStep(); persist(); }
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
