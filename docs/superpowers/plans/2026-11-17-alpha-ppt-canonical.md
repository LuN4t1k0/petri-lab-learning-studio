# Alpha canónico y layout pedagógico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la PPT en un caso de aceptación exacto y dibujar redes Alpha legibles mediante una ruta principal con carriles para ramas y ciclos.

**Architecture:** El motor Alpha mantiene la semántica actual y gana validaciones explícitas de correspondencia. `graph-layout.js` resuelve solo posiciones, seleccionando una ruta principal y distribuyendo componentes externos en carriles; `svg-renderer.js` consume esas posiciones sin conocer Alpha.

**Tech Stack:** JavaScript ES modules, Node test runner, SVG y CSS estático.

**Spec:** `docs/superpowers/specs/2026-11-17-alpha-ppt-canonical-design.md`

## Global Constraints

- No codificar etiquetas ni coordenadas especiales para L5.
- No agregar dependencias externas.
- Preservar la interfaz `layoutPetriNet(model, width, height)`.
- Mantener soporte de teclado, arrastre de nodos y diseño responsive.
- Distinguir validación estructural calculada de las limitaciones conceptuales de Alpha.

## Review Focus

- Redes con ciclos sin una ruta simple completa deben usar fallback y mantener coordenadas finitas.
- Elecciones simétricas deben producir un resultado determinista.
- Redes grandes deben limitar la enumeración de rutas sin bloquear el navegador.
- Componentes con múltiples anclajes no deben superponer nodos de un mismo carril.
- Una red vacía o desconectada no debe romper el renderer.

---

### Task 1: Oráculo académico L5

**Files:**
- Create: `tests/fixtures/alpha-l5-reference.js`
- Modify: `tests/alpha-explanation.test.js`

**Interfaces:**
- Produces: `L5_LOG` y conjuntos esperados reutilizables por pruebas de motor, layout y UI.

- [ ] Escribir una prueba que compare exactamente Directly Follows, footprint, `XL`, `YL`, `PL` y `FL` con las páginas 34–38.
- [ ] Ejecutar la prueba y verificar si revela alguna diferencia real del motor.
- [ ] Si existe una diferencia, corregir una sola regla del motor con una prueba focal; si no existe, conservar el motor sin cambios.
- [ ] Añadir una prueba de correspondencia uno a uno entre `FL` y arcos del modelo.
- [ ] Ejecutar `node --test tests/alpha-explanation.test.js`.
- [ ] Commit: `test: pin alpha ppt reference case`.

### Task 2: Layout por ruta principal y carriles

**Files:**
- Modify: `src/ui/graph-layout.js`
- Modify: `tests/layout.test.js`

**Interfaces:**
- Produces: `layoutPetriNet(model, width, height) -> Map<nodeId, {x,y,layer,lane,role}>`.

- [ ] Escribir una prueba L5 que exija una ruta principal horizontal con los nodos estructurales y carriles opuestos para ciclo y alternativa.
- [ ] Escribir pruebas de fallback, determinismo y coordenadas finitas en red extensa.
- [ ] Ejecutar `node --test tests/layout.test.js` y confirmar fallos por metadatos/posiciones ausentes.
- [ ] Implementar enumeración acotada de rutas simples y selección determinista de `spine`.
- [ ] Implementar componentes externos, anclajes y asignación alternada de carriles.
- [ ] Ejecutar prueba focal y suite completa.
- [ ] Commit: `feat: add pedagogical petri net layout`.

### Task 3: Arcos legibles y evidencia de equivalencia

**Files:**
- Modify: `src/ui/svg-renderer.js`
- Modify: `src/app.js`
- Modify: `dist/learning.css`
- Modify: `tests/build.test.js`

**Interfaces:**
- Consumes: posiciones con `lane` y `role` del Task 2.
- Produces: rutas SVG diferenciadas para spine/desvíos y panel de comprobación final.

- [ ] Escribir pruebas de build para “Comprobación del resultado”, equivalencia gráfica y clases de arco.
- [ ] Ejecutar la prueba y confirmar fallo por UI ausente.
- [ ] Etiquetar arcos con clases de spine, rama y retorno a partir de los metadatos del layout.
- [ ] Mostrar checks derivados de `TL`, `YL`, `PL`, `FL` y el modelo, más la lista compacta de lugares.
- [ ] Añadir estilos responsive y leyenda visual.
- [ ] Ejecutar `npm test` y `npm run build`.
- [ ] Commit: `feat: explain canonical alpha network`.

### Task 4: Publicación y verificación visual

**Files:**
- Modify: `README.md`
- Generated: `dist/assets/`

- [ ] Documentar el caso de referencia y la diferencia entre equivalencia estructural y geometría.
- [ ] Ejecutar pruebas, build y `git diff --check` en la rama.
- [ ] Integrar en `main`, publicar GitHub Pages y esperar el workflow.
- [ ] Comparar visualmente L5 con la página 38 y probar un segundo log con elección.
- [ ] Verificar en la web pública que los checks y la selección de nodos funcionan.
