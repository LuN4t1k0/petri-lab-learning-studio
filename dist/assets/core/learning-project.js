import { parseTraceLanguage } from './trace-parser.js';

export function serializeTrace(trace) {
  return `<${trace.map((activity) => String(activity).trim()).filter(Boolean).join(',')}>`;
}

export function appendTraceToLanguage(text, trace) {
  const line = serializeTrace(trace);
  if (!String(text ?? '').trim()) return line;
  const log = parseTraceLanguage(`${text.trim()}\n${line}`);
  return log.variants.map((variant) => {
    const base = serializeTrace(variant.activities);
    return variant.frequency > 1 ? `${base}^${variant.frequency}` : base;
  }).join('\n');
}

export function evidenceSummary(structural, dynamic) {
  const criteria = [
    structural.isPetriNet,
    structural.isWorkflowNet,
    dynamic.finalReachable,
    dynamic.deadTransitions.length === 0,
    !dynamic.residualTokensAtFinal,
  ];
  const score = Math.round((criteria.filter(Boolean).length / criteria.length) * 100);
  if (criteria.every(Boolean)) {
    return {
      level: 'correct', score,
      title: 'Workflow Net estructuralmente correcta',
      description: 'El final es alcanzable, no observamos transiciones muertas ni tokens residuales dentro del límite explorado.',
    };
  }
  if (structural.isPetriNet) {
    return {
      level: 'warning', score,
      title: 'Es una Petri Net, pero aún no una Workflow Net correcta',
      description: dynamic.truncated
        ? 'La exploración alcanzó su límite. Corrige primero las advertencias estructurales o reduce la red.'
        : 'Revisa las condiciones marcadas y vuelve a simular el proceso.',
    };
  }
  return {
    level: 'error', score,
    title: 'La estructura todavía no forma una Petri Net válida',
    description: 'Corrige arcos inválidos y nodos aislados antes de analizar el comportamiento.',
  };
}
