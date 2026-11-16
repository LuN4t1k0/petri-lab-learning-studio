const SUPERSCRIPT_DIGITS = Object.freeze({
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
});
const MAX_EXPANDED_CASES = 10_000;

export class TraceParseError extends Error {
  constructor(message, line = null) {
    super(line ? `Línea ${line}: ${message}` : message);
    this.name = 'TraceParseError';
    this.line = line;
  }
}

function parseFrequency(caretDigits, superscriptDigits, line) {
  const raw = caretDigits ?? (superscriptDigits
    ? [...superscriptDigits].map((digit) => SUPERSCRIPT_DIGITS[digit]).join('')
    : '1');
  const frequency = Number(raw);
  if (!Number.isSafeInteger(frequency) || frequency <= 0) {
    throw new TraceParseError('el exponente debe ser un entero positivo.', line);
  }
  return frequency;
}

function parseLine(rawLine, line) {
  const match = rawLine.trim().match(
    /^[<⟨]\s*(.*?)\s*[>⟩](?:\s*(?:\^\s*(-?\d+)|([⁰¹²³⁴⁵⁶⁷⁸⁹]+)))?\s*,?\s*$/u,
  );
  if (!match) {
    throw new TraceParseError('usa el formato <a,b,c>^3.', line);
  }

  const activities = match[1].split(',').map((activity) => activity.trim());
  if (!activities.length || activities.some((activity) => !activity)) {
    throw new TraceParseError('cada actividad debe tener una etiqueta.', line);
  }

  return {
    activities,
    frequency: parseFrequency(match[2], match[3], line),
  };
}

export function parseTraceLanguage(text) {
  const source = String(text ?? '');
  const rows = source.split(/\r?\n/u)
    .map((value, index) => ({ value, line: index + 1 }))
    .filter(({ value }) => value.trim());

  if (!rows.length) {
    throw new TraceParseError('ingresa al menos una traza.');
  }

  const variantsByKey = new Map();
  let totalCases = 0;
  for (const row of rows) {
    const parsed = parseLine(row.value, row.line);
    totalCases += parsed.frequency;
    if (totalCases > MAX_EXPANDED_CASES) {
      throw new TraceParseError('el registro no puede superar 10.000 casos expandidos.', row.line);
    }
    const key = JSON.stringify(parsed.activities);
    const existing = variantsByKey.get(key);
    if (existing) existing.frequency += parsed.frequency;
    else variantsByKey.set(key, parsed);
  }

  const variants = [...variantsByKey.values()];
  const traces = variants.flatMap(({ activities, frequency }) =>
    Array.from({ length: frequency }, () => [...activities]));
  const activities = [...new Set(variants.flatMap((variant) => variant.activities))].sort(
    (left, right) => left.localeCompare(right, 'es'),
  );

  return {
    traces,
    variants: variants.map(({ activities: sequence, frequency }) => ({
      activities: [...sequence],
      frequency,
    })),
    activities,
    totalCases,
  };
}
