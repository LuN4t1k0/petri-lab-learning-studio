# PetriLab Learning Studio

Laboratorio educativo e interactivo para aprender los fundamentos de minería de procesos:

- event logs y variantes de trazas;
- los ocho pasos formales del algoritmo Alpha;
- matriz footprint (`→`, `←`, `∥`, `#`);
- construcción manual de redes de Petri;
- simulación de tokens y disparo de transiciones;
- comprobación estructural de Workflow Nets;
- exploración acotada de alcanzabilidad y transiciones muertas.

Todo funciona localmente en el navegador, sin enviar el event log a un servidor.

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
