# QA y verificación

Fecha: 2026-10-08 (v1.0.0). Equipo: MacBook Air (Apple M3, 8 GB), macOS 27.0.1, Node 24.21, pnpm 12.9.1,
Chromium de Playwright 1.63 (headless shell 153).

## Checks automáticos

| Comando | Resultado |
| --- | --- |
| `pnpm typecheck` | sin errores |
| `pnpm check` | sin errores ni avisos (formato, imports y lint de Biome) |
| `pnpm test` | 145 tests en 18 ficheros, todos pasan |
| `pnpm build` | correcto; chunk inicial 160 kB gzip, 3D/2D/ELK/SVG en chunks diferidos |
| `pnpm test:e2e` | 30 tests, todos pasan (WebGL por SwiftShader) |
| `pnpm qa:screens` | 4 tests, capturas en `docs/qa/` (con `QA_GPU=metal`) |
| `pnpm audit --prod` | sin vulnerabilidades conocidas |

El CI (`.github/workflows/ci.yml`) ejecuta en cada pull request y en `main` todo lo anterior salvo
`qa:screens` y `audit`: lint, typecheck, unitarios y build en el job `validate`, y los E2E con
accesibilidad en el job `e2e` (Chromium con SwiftShader, un reintento en CI).

### Unit (Vitest)

Schema/invariantes (IDs duplicados, extremos/puertos inexistentes, puertos incompatibles, ciclos de
grupo, versión desconocida, límite de tamaño), roundtrip JSON, coordenadas de grupos anidados,
transformación 2D→3D, rutas que no atraviesan volúmenes (6 plantillas × 2 estilos de ruta),
conservación semántica al cambiar de estilo, comandos (borrado con aristas, grupos que conservan
hijos, agrupar/desagrupar, duplicar, puertos), historial (undo/redo, drag = 1 entrada, redo
invalidado, comandos rechazados sin efecto), variaciones deterministas (6 categorías × 3
complejidades × 25 seeds sin solapes), ELK, validación de salida remota, persistencia (corrupción,
versión, cuota), énfasis 3D y fixture de rendimiento. Además: copiar/pegar fragmentos, notas,
biblioteca de componentes, recorridos narrativos, encuadre inicial del 2D, exportación SVG, enlaces
compartidos y sesión de solo lectura, modelos 3D por arquetipo, descripción textual de la escena y
contraste de los tokens de diagrama.

### Accesibilidad (WCAG 2.2 AA)

`tests/e2e/a11y.spec.ts` pasa axe-core (etiquetas `wcag2a` a `wcag22aa`) sobre AWS Load Testing en
los cuatro estilos, con la app en claro y en oscuro, en 3D y en 2D; también sobre el inspector,
Apariencia, Estructura y el layout de móvil (390 px). Comprueba además las alternativas sin
arrastre (2.5.7: botones de cámara y «Conectar con…»), la pausa de las partículas (2.2.2) y la
lista textual enlazada al lienzo 3D con `aria-describedby` (1.1.1). Los contrastes de la paleta de
diagramas los verifica `diagramTokens.test.ts`. axe no sustituye una revisión manual con lector de
pantalla.

### E2E (Playwright)

Edición (`editor.spec.ts`):

1. Primer arranque: título, leyenda, «Editar en 2D» y escena con 16 nodos / 17 relaciones.
2. Añadir componente, renombrar en el inspector, conectar arrastrando puertos en 2D → la escena 3D
   contiene 17/18 (conteo leído del grafo de escena real); Ctrl+Z / Ctrl+Shift+Z.
3. Copiar, cortar y pegar un nodo y un grupo con sus subgrupos y relaciones internas; un solo
   deshacer revierte el pegado.
4. Recorrido: crear un paso, reordenarlo con teclado, presentar desde él y sacarlo del recorrido
   desde el inspector (con deshacer).
5. Borrar grupo «VPC» → diálogo → conservar hijos (16 nodos, 4 grupos).
6. Cambiar a Blueprint conserva IDs, pertenencia y conexiones.
7. Generador local: vista previa → insertar.
8. Pérdida de contexto WebGL → «Continuar en 2D» con el documento intacto.
9. Reconectar el extremo de una relación en 2D conserva su ID y cambia el destino.
10. Marco de selección de esquina a esquina selecciona 16 nodos y 5 grupos; clic en vacío limpia.
11. Arrastrar una arista seleccionada desplaza su tramo central; doble clic lo restaura.
12. Una nota señala al componente seleccionado, se edita en línea, no cuenta como componente y
    sobrevive sin línea guía al borrar su destino.

Persistencia y exportación (`persistence.spec.ts`):

13. Autosave → recarga sin parámetros → documento recuperado.
14. Guardado corrupto → aviso, copia de seguridad `strata:recovered:*`, plantilla por defecto.
15. Exportar JSON → reimportar; `schemaVersion: 99` y referencias rotas se rechazan sin mutar.
16. SVG: dimensiones > 0, 12 nodos, 15 relaciones, fuentes incrustadas.
17. PNG 3D en Full HD, 1:1 transparente y 4K: firma PNG, dimensiones exactas, imagen no vacía y
    píxeles con alpha 0 en la versión transparente.

Enlaces compartidos (`share.spec.ts`):

18. Un enlace abre en solo lectura sin tocar el diagrama guardado; «Volver a mi diagrama» limpia el
    fragmento; «Editar una copia» pide confirmación y guarda copia de seguridad `strata:replaced:*`.
19. Un enlace de presentación arranca presentando; un enlace roto muestra aviso y no se carga.

Accesibilidad (`a11y.spec.ts`): 11 tests, descritos en la sección anterior.

## Revisión visual

Capturas en `docs/qa/` (1440×900, GPU real vía ANGLE/Metal):

- `template-*.png`: las seis plantillas en su estilo recomendado.
- `style-*.png` y `style-*-2d.png`: AWS Load Testing en los cuatro estilos, en 3D y en 2D.
- `app-3d-panels.png`, `app-2d-editor.png`, `app-dark-scheme.png`, `narrow-3d.png` (390×844).

Corregido durante la revisión: encuadre demasiado pequeño (ahora se proyectan las esquinas reales
del contenido y se reserva la franja de título/leyenda), etiquetas diminutas (tamaño derivado del
encuadre), títulos de grupo tapados o superpuestos (colocación sin colisiones), etiquetas de
relación que competían con los nodos (números de paso en modo automático), base de las islas de
Orbit deformada, luz de Midnight en caras ocultas, cuadrícula de Blueprint demasiado fuerte,
bucle de selección en React Flow al montar con selección, handles bloqueados por la capa de
aristas.

Limitaciones visuales conocidas: en pantallas muy estrechas la escena es pequeña y solo se
etiquetan los nodos principales; en escenas densas algunas etiquetas de nodos vecinos aún se tocan;
las rutas 2D (smoothstep de React Flow) no esquivan nodos.

## Rendimiento (medido)

`node scripts/measure-perf.mjs <url> [--gpu]` sobre `pnpm build && pnpm preview`, fixture
`?stress=1` (100 nodos, 150 relaciones, 10 grupos), viewport 1440×900, DPR 1, calidad media,
180 movimientos de órbita continuos:

| Renderer | Carga hasta escena | Frame medio | p95 | ≈ FPS |
| --- | --- | --- | --- | --- |
| Apple M3 · ANGLE Metal (headless) | 0,9 s | 16,7 ms | 16,8 ms | 60 (tope de rAF) |
| SwiftShader (CPU, sin GPU) | 3,6 s | 167 ms | 217 ms | ≈ 6 |

Medido con el kit de modelos detallados (`nodeModels.ts`: ≤ 4 mallas fusionadas por nodo,
≈ 2.400 triángulos de media) y la luz de entorno PBR, que se omite en renderizadores por software
y en calidad baja. Antes del kit, SwiftShader daba ≈ 9 fps; con GPU no hay diferencia.
`pnpm qa:screens` usa SwiftShader por defecto (sin luz de entorno); para capturas fieles al
aspecto final usa `QA_GPU=metal pnpm qa:screens`.
Con SwiftShader `PerformanceMonitor` baja la calidad automáticamente. No se ha medido en
Windows/Linux ni con GPU discreta, ni a DPR 2 en pantalla real.

## Pendiente de comprobar manualmente

- Interacción táctil real (pinch/órbita) en tablet/móvil.
- Lector de pantalla real (VoiceOver/NVDA) sobre lista de estructura e inspector.
- Safari y Firefox (los tests usan Chromium).
- Proveedor remoto: no hay backend en este repositorio; el cliente HTTP está cubierto solo por la
  validación de su salida.
