# Ayuda contextual para la lección Alpha

## Objetivo

Convertir los resultados intermedios del algoritmo Alpha en explicaciones trazables para estudiantes: qué se busca, qué regla se aplica, qué datos del log la justifican y cuál es el error frecuente.

## Enfoque escogido

Se usa ayuda contextual dentro de cada paso. Se descartó una sección teórica separada porque obliga a alternar entre teoría y ejercicio, y se deja el modo desafío para una etapa posterior.

## Comportamiento

- Cada paso presenta objetivo, regla en lenguaje cotidiano, ejemplo del log actual y error frecuente.
- La matriz footprint muestra la evidencia Directly Follows de ambos sentidos al seleccionar una celda.
- Cada candidato de `XL` puede desplegar causalidades e incompatibilidades internas que lo validan.
- `YL` distingue maximales y explica qué candidato superior contiene a cada elemento eliminado.
- `PL` identifica el elemento de `YL` que originó cada lugar.
- `FL` identifica la regla que originó cada arco.
- La Workflow Net permite seleccionar un lugar y consultar su procedencia matemática.
- Un glosario contextual define `>`, `→`, `←`, `∥`, `#`, `XL`, `YL`, `PL` y `FL` sin abandonar el ejercicio.

## Restricciones

- Conservar los ocho pasos y el editor existentes.
- No añadir dependencias ni servicios externos.
- Derivar explicaciones de los datos calculados; no fijarlas al ejemplo `L5`.
- Mantener accesibilidad por teclado y diseño responsive.

