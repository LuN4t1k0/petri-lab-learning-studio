# PetriLab Learning Studio

Laboratorio educativo e interactivo para aprender los fundamentos de minería de procesos:

- event logs y variantes de trazas;
- recorrido guiado desde el event log hasta la Workflow Net;
- relación Directly Follows con evidencia por variante y frecuencia;
- matriz footprint (`→`, `←`, `∥`, `#`);
- conjuntos `XL`, `YL`, lugares `PL` y flujo `FL` explicados paso a paso;
- construcción manual de redes de Petri;
- simulación de tokens y disparo de transiciones;
- comprobación estructural de Workflow Nets;
- exploración acotada de alcanzabilidad y transiciones muertas.

Todo funciona localmente en el navegador, sin enviar el event log a un servidor.

## Recorrido de aprendizaje

La lección de descubrimiento avanza en orden y no adelanta resultados:

1. variantes, frecuencias, actividades, inicio y fin del event log;
2. conjunto Directly Follows y trazas que justifican cada par;
3. causalidad, paralelismo, ausencia de relación y matriz footprint;
4. candidatos `XL`;
5. pares maximales `YL`;
6. lugares `PL`;
7. arcos `FL`;
8. Workflow Net gráfica, editable, comprobable y simulable.

## Ejecutar localmente

Requiere Node.js 20 o superior y Python 3 para el servidor estático.

```bash
npm test
npm run build
npm run serve
```

Después abre `http://localhost:4173`.

## Estructura

- `src/core`: análisis, simulación, validación y proyectos educativos.
- `src/miners`: algoritmos de descubrimiento.
- `src/ui`: layout, renderizado y editor gráfico.
- `tests`: pruebas del dominio y la interfaz pura.
- `dist`: aplicación estática publicada.

## Alcance académico

La aplicación implementa Alpha clásico y una exploración acotada de estados. No sustituye un verificador formal ilimitado para redes no acotadas. Alpha clásico tiene limitaciones conocidas ante bucles cortos y logs incompletos o con ruido.
