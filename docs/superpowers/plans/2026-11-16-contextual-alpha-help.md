# Contextual Alpha Help Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir explicaciones trazables y ayudas contextuales a cada resultado del recorrido Alpha.

**Architecture:** `explainAlpha(log)` producirá derivaciones pedagógicas para candidatos, lugares y arcos. La UI renderizará esas derivaciones mediante paneles desplegables y un glosario; el renderer SVG aceptará un callback opcional para seleccionar lugares sin acoplar conocimiento Alpha al componente gráfico.

**Tech Stack:** JavaScript ES modules, Node test runner, HTML/CSS estático y SVG.

**Spec:** `docs/superpowers/specs/2026-11-16-contextual-alpha-help-design.md`

## Global Constraints

- Conservar los ocho pasos existentes.
- No añadir dependencias.
- Generar explicaciones desde cualquier event log válido.
- Mantener navegación por teclado y diseño responsive.

## Review Focus

- Candidatos no maximales contenidos por más de un maximal deben listar todos sus contenedores.
- Pares singleton no deben mostrar incompatibilidades internas inexistentes.
- Lugares inicial y final deben tener explicaciones distintas de los lugares derivados.
- Arcos iniciales/finales deben citar `TI`/`TO`; los internos deben citar `YL`.
- Seleccionar un nodo sin procedencia Alpha no debe romper el renderer reutilizable.

---

### Task 1: Derivaciones pedagógicas

**Files:**
- Modify: `src/miners/alpha-miner.js`
- Modify: `tests/alpha-explanation.test.js`

**Interfaces:**
- Produces: `candidateExplanations`, `maximality`, `placeExplanations`, `flowExplanations` dentro del resultado de `explainAlpha(log)`.

- [x] Escribir pruebas fallidas con `L5` para la validez de `XL`, descarte hacia `YL`, origen de lugares y reglas de arcos.
- [x] Ejecutar la prueba focal y confirmar campos ausentes.
- [x] Implementar las derivaciones usando los conjuntos ya calculados.
- [x] Ejecutar prueba focal y suite completa.
- [x] Commit del motor pedagógico.

### Task 2: Ayudas visuales y selección de procedencia

**Files:**
- Modify: `src/app.js`
- Modify: `src/ui/svg-renderer.js`
- Modify: `dist/learning.css`
- Modify: `tests/build.test.js`

**Interfaces:**
- Consumes: derivaciones de Task 1.
- Produces: paneles de objetivo/regla/ejemplo/error, detalles desplegables, glosario y selección de lugares en la red final.

- [x] Escribir pruebas de build fallidas para los nuevos componentes y callback del renderer.
- [x] Ejecutar la prueba focal y confirmar el fallo.
- [x] Implementar paneles, glosario y detalles por elemento.
- [x] Añadir `renderPetriNet(container, model, { onNodeSelect })` como opción compatible.
- [x] Construir y ejecutar toda la suite.
- [x] Commit de la experiencia educativa.

### Task 2b: Alineación con el material académico

- [x] Contrastar el recorrido con la definición y los ejemplos del PDF de Alpha.
- [x] Explicar proceso frente a trazas y sobreajuste.
- [x] Presentar las cuatro dimensiones de conformidad sin simular métricas no calculadas.
- [x] Detectar bucles cortos de longitud 1 y 2 y explicar las demás limitaciones clásicas.

### Task 3: Publicación y QA

**Files:**
- Modify: `README.md`
- Generated: `dist/assets/`

- [ ] Documentar las ayudas contextuales.
- [ ] Ejecutar `npm test` y `npm run build`.
- [ ] Integrar la rama en `main` y publicar GitHub Pages.
- [ ] Recorrer `L5` en la web pública y comprobar detalles de footprint, `XL`, `YL`, `PL`, `FL` y selección en la red.

