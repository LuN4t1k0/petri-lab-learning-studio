import { createPetriBuilder } from '../core/petri-model.js';

const pairKey = (left, right) => `${left}\u0000${right}`;

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b, 'es'));
}

function setIsSubset(left, right) {
  return [...left].every((value) => right.has(value));
}

function candidateSignature(candidate) {
  return `${sorted(candidate.inputs).join(',')}|${sorted(candidate.outputs).join(',')}`;
}

function alphaCandidates(causalPairs, direct) {
  const causal = new Set(causalPairs.map(([left, right]) => pairKey(left, right)));
  const unrelated = (left, right) => left === right
    || (!direct.has(pairKey(left, right)) && !direct.has(pairKey(right, left)));
  const valid = ({ inputs, outputs }) => {
    const inputList = [...inputs];
    const outputList = [...outputs];
    const internallyUnrelated = (values) => values.every((value, index) =>
      values.slice(index + 1).every((other) => unrelated(value, other)));
    return internallyUnrelated(inputList)
      && internallyUnrelated(outputList)
      && inputList.every((left) => outputList.every((right) => causal.has(pairKey(left, right))));
  };

  const candidates = new Map(causalPairs.map(([left, right]) => {
    const candidate = { inputs: new Set([left]), outputs: new Set([right]) };
    return [candidateSignature(candidate), candidate];
  }));
  let changed = true;
  while (changed) {
    changed = false;
    const current = [...candidates.values()];
    for (let leftIndex = 0; leftIndex < current.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < current.length; rightIndex += 1) {
        const merged = {
          inputs: new Set([...current[leftIndex].inputs, ...current[rightIndex].inputs]),
          outputs: new Set([...current[leftIndex].outputs, ...current[rightIndex].outputs]),
        };
        const signature = candidateSignature(merged);
        if (!candidates.has(signature) && valid(merged)) {
          candidates.set(signature, merged);
          changed = true;
        }
      }
    }
  }

  const all = [...candidates.values()];
  const maximal = all.filter((candidate) => !all.some((other) => other !== candidate
    && setIsSubset(candidate.inputs, other.inputs)
    && setIsSubset(candidate.outputs, other.outputs)
    && (candidate.inputs.size < other.inputs.size || candidate.outputs.size < other.outputs.size)));
  return { all, maximal };
}

function analyzeAlphaRelations(log) {
  const direct = new Set();
  const starts = new Set();
  const ends = new Set();
  for (const variant of log.variants) {
    const sequence = variant.activities;
    starts.add(sequence[0]);
    ends.add(sequence.at(-1));
    for (let index = 0; index < sequence.length - 1; index += 1) {
      direct.add(pairKey(sequence[index], sequence[index + 1]));
    }
  }
  const causalPairs = [];
  const parallelPairs = [];
  const choicePairs = [];
  for (let leftIndex = 0; leftIndex < log.activities.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < log.activities.length; rightIndex += 1) {
      const left = log.activities[leftIndex];
      const right = log.activities[rightIndex];
      const lr = direct.has(pairKey(left, right));
      const rl = direct.has(pairKey(right, left));
      if (lr && rl) parallelPairs.push([left, right]);
      else if (!lr && !rl) choicePairs.push([left, right]);
    }
  }
  for (const left of log.activities) {
    for (const right of log.activities) {
      if (direct.has(pairKey(left, right)) && !direct.has(pairKey(right, left))) causalPairs.push([left, right]);
    }
  }
  return { direct, starts, ends, causalPairs, parallelPairs, choicePairs, candidates: alphaCandidates(causalPairs, direct) };
}

export function mineAlpha(log) {
  const builder = createPetriBuilder('alpha');
  const startPlace = builder.addPlace('inicio', { tokens: 1 });
  const endPlace = builder.addPlace('fin', { terminal: true });
  const transitions = new Map(log.activities.map((activity) => [activity, builder.addTransition(activity)]));
  const { direct, starts, ends, causalPairs, parallelPairs, choicePairs, candidates } = analyzeAlphaRelations(log);

  for (const activity of sorted(starts)) builder.addArc(startPlace, transitions.get(activity));
  for (const activity of sorted(ends)) builder.addArc(transitions.get(activity), endPlace);
  for (const candidate of candidates.maximal) {
    const inputs = sorted(candidate.inputs);
    const outputs = sorted(candidate.outputs);
    const place = builder.addPlace(`${inputs.join(',')}→${outputs.join(',')}`);
    for (const activity of inputs) builder.addArc(transitions.get(activity), place);
    for (const activity of outputs) builder.addArc(place, transitions.get(activity));
  }

  return builder.build({
    finalPlaces: [endPlace],
    metadata: {
      description: 'Minería Alpha basada en sucesión directa, causalidad, elección y paralelismo.',
      relations: {
        directSuccession: sorted([...direct].map((key) => key.replace('\u0000', ' > '))),
        causality: causalPairs.map(([left, right]) => `${left} → ${right}`),
        parallel: parallelPairs.map(([left, right]) => `${left} ∥ ${right}`),
        choice: choicePairs.map(([left, right]) => `${left} # ${right}`),
      },
    },
  });
}

function formatCandidate(candidate) {
  const inputs = sorted(candidate.inputs);
  const outputs = sorted(candidate.outputs);
  return { inputs, outputs, key: `{${inputs.join(',')}}→{${outputs.join(',')}}` };
}

function explainDirectlyFollows(log) {
  const relations = new Map();
  log.variants.forEach((variant, variantIndex) => {
    const positionsByPair = new Map();
    for (let index = 0; index < variant.activities.length - 1; index += 1) {
      const left = variant.activities[index];
      const right = variant.activities[index + 1];
      const key = pairKey(left, right);
      if (!positionsByPair.has(key)) positionsByPair.set(key, []);
      positionsByPair.get(key).push(index + 1);
      if (!relations.has(key)) {
        relations.set(key, {
          left,
          right,
          key: `${left} > ${right}`,
          caseCount: 0,
          occurrenceCount: 0,
          evidence: [],
        });
      }
    }
    for (const [key, positions] of positionsByPair) {
      const relation = relations.get(key);
      relation.caseCount += variant.frequency;
      relation.occurrenceCount += positions.length * variant.frequency;
      relation.evidence.push({
        variantIndex: variantIndex + 1,
        frequency: variant.frequency,
        positions,
      });
    }
  });
  return [...relations.values()].sort((left, right) => left.key.localeCompare(right.key, 'es'));
}

export function explainAlpha(log) {
  const analysis = analyzeAlphaRelations(log);
  const footprint = Object.fromEntries(log.activities.map((left) => [left, Object.fromEntries(
    log.activities.map((right) => {
      const lr = analysis.direct.has(pairKey(left, right));
      const rl = analysis.direct.has(pairKey(right, left));
      return [right, lr && rl ? '∥' : lr ? '→' : rl ? '←' : '#'];
    }),
  )]));
  const XL = analysis.candidates.all.map(formatCandidate).sort((a, b) => a.key.localeCompare(b.key));
  const YL = analysis.candidates.maximal.map(formatCandidate).sort((a, b) => a.key.localeCompare(b.key));
  const PL = ['i_L', ...YL.map((pair) => `p(${pair.key})`), 'o_L'];
  const FL = [
    ...sorted(analysis.starts).map((activity) => `i_L→${activity}`),
    ...YL.flatMap((pair) => [
      ...pair.inputs.map((activity) => `${activity}→p(${pair.key})`),
      ...pair.outputs.map((activity) => `p(${pair.key})→${activity}`),
    ]),
    ...sorted(analysis.ends).map((activity) => `${activity}→o_L`),
  ];
  const variants = log.variants.map((variant, index) => ({
    index: index + 1,
    activities: [...variant.activities],
    frequency: variant.frequency,
  }));
  const directlyFollows = explainDirectlyFollows(log);
  const relationSets = {
    causality: analysis.causalPairs.map(([left, right]) => `${left} → ${right}`),
    parallel: analysis.parallelPairs.map(([left, right]) => `${left} ∥ ${right}`),
    unrelated: analysis.choicePairs.map(([left, right]) => `${left} # ${right}`),
  };
  const result = {
    totalCases: log.totalCases,
    variants,
    TL: [...log.activities],
    TI: sorted(analysis.starts),
    TO: sorted(analysis.ends),
    directlyFollows,
    relationSets,
    footprint,
    XL,
    YL,
    PL,
    FL,
    model: mineAlpha(log),
  };
  result.steps = [
    { key: 'log', title: '1. Event log', value: result.variants },
    { key: 'direct', title: '2. Directly Follows', value: result.directlyFollows },
    { key: 'footprint', title: '3. Footprint', value: result.relationSets },
    { key: 'XL', title: '4. Pares candidatos', value: result.XL },
    { key: 'YL', title: '5. Pares maximales', value: result.YL },
    { key: 'PL', title: '6. Lugares', value: result.PL },
    { key: 'FL', title: '7. Flujo', value: result.FL },
    { key: 'alpha', title: '8. Workflow Net', value: result.model },
  ];
  return result;
}
