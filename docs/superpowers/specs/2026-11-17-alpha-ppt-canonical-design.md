# Alpha canónico y layout pedagógico

## Intención

PetriLab debe servir como herramienta cotidiana para estudiantes: recibe un event log, reproduce todos los pasos del algoritmo Alpha clásico y permite comprobar cada resultado antes de mostrar la Workflow Net. El material `07.01 - Alpha Algorithm.pdf` es la referencia académica: las páginas 1–31 definen el método y las páginas 32–38 constituyen el caso de aceptación L5.

## Hallazgo de la auditoría

El motor actual produce para L5 los mismos conjuntos `>L`, footprint, `XL`, `YL`, `PL` y `FL` que las diapositivas. La diferencia observada está en la presentación: el layout BFS genérico dibuja el ciclo `b → c → d → b` con cruces y una jerarquía difícil de leer. La red es isomorfa a la de la página 38, pero un alumno no tiene evidencia visual suficiente para reconocerlo.

## Objetivos

- Fijar L5 como prueba de aceptación exacta, no solo por conteos.
- Separar la corrección matemática del layout gráfico.
- Dibujar una ruta principal horizontal y colocar alternativas/ciclos en carriles.
- Mostrar en la interfaz una comprobación de correspondencia entre `YL`, lugares y arcos.
- Explicar que dos dibujos son equivalentes si preservan nodos, arcos y direcciones.
- Mantener funcionamiento para cualquier event log aceptado por el parser.

## No objetivos

- No codificar posiciones especiales para L5.
- No afirmar que Alpha clásico resuelve sus limitaciones conocidas.
- No calcular métricas formales de conformidad en esta iteración.
- No cambiar las reglas matemáticas de Alpha para hacer que un dibujo se parezca a la PPT.

## Enfoques considerados

1. **Posiciones fijas para L5.** Reproduce la diapositiva, pero falla para otros logs y ocultaría el problema real. Rechazado.
2. **Agregar una biblioteca externa de layout.** Puede resolver grafos generales, pero añade peso y complejidad de build a una aplicación estática pequeña. No es necesario para el tamaño educativo actual.
3. **Layout pedagógico propio basado en ruta principal y carriles.** Selecciona una ruta inicio–fin que atraviesa los nodos estructuralmente más informativos; distribuye los componentes restantes como desvíos superiores/inferiores entre sus puntos de anclaje. Es determinista, sin dependencias y generaliza. Elegido.

## Diseño

### Caso de aceptación académico

Una prueba independiente fija exactamente para L5:

- 13 relaciones Directly Follows;
- causalidad, paralelismo y unrelated de la matriz;
- 9 elementos de `XL`;
- 5 elementos de `YL`;
- 7 lugares (`iL`, cinco derivados y `oL`);
- 14 arcos de `FL`;
- correspondencia uno a uno entre `FL` y los arcos del modelo.

### Layout

`layoutPetriNet` conservará su interfaz y devolverá además metadatos de carril por nodo.

1. Se enumeran rutas simples desde cada lugar inicial hasta un lugar final con un límite seguro.
2. Se elige como `spine` la ruta que maximiza cobertura estructural: prioridad a nodos con grado mayor que dos, luego longitud y finalmente orden determinista.
3. La ruta principal se coloca horizontalmente en el centro.
4. Al retirar la ruta principal, cada componente restante se trata como un desvío. Sus nodos se ordenan desde el anclaje de entrada al de salida, incluso si la dirección geométrica va de derecha a izquierda.
5. Los desvíos alternan carriles superiores e inferiores para reducir solapamientos.
6. Si no existe ruta inicio–fin, se usa el layout actual como fallback seguro.

Para L5 la ruta esperada es `iL → a → p({a,d},{b}) → b → p({b},{c,f}) → f → oL`; la rama de `e` queda abajo y el retorno `c,d` arriba, como en la página 38, sin fijar etiquetas concretas en producción.

### Evidencia visible

El paso final incluirá:

- un bloque “Comprobación del resultado” con checks para transiciones, lugares y arcos;
- una leyenda de equivalencia gráfica;
- una vista textual compacta de cada lugar `p(A,B)` y sus arcos de entrada/salida;
- conservación de la selección interactiva de nodos.

## Criterios de aceptación

- El fixture L5 coincide exactamente con las páginas 34–38.
- En L5, los siete nodos de la ruta principal comparten coordenada vertical y avanzan de izquierda a derecha.
- Los nodos del retorno `c,d` están en un carril distinto y sus posiciones siguen el recorrido de derecha a izquierda entre los anclajes.
- La rama `e` ocupa el carril opuesto.
- Ningún event log válido produce coordenadas no finitas o nodos faltantes.
- La web explica que la geometría puede variar sin cambiar la red.

