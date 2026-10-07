# QA y verificación

Fecha: 2026-10-05. Equipo: MacBook Air (Apple M3, 8 GB), macOS 27.0.1, Node 24.21, pnpm 12.9.1,
Chromium de Playwright 1.63 (headless shell 153).

## Checks automáticos

| Comando | Resultado |
| --- | --- |
| `pnpm typecheck` | sin errores |
| `pnpm check` | sin errores ni avisos (formato, imports y lint de Biome) |
| `pnpm test` | 52 tests en 7 ficheros, todos pasan |
| `pnpm build` | correcto; chunk inicial 137 kB gzip, 3D/2D/ELK/SVG en chunks diferidos |
| `pnpm test:e2e` | 12 tests, todos pasan (WebGL por SwiftShader) |
| `pnpm qa:screens` | 4 tests, capturas en `docs/qa/` (con `QA_GPU=metal`) |

### Unit (Vitest)

Schema/invariantes (IDs duplicados, extremos/puertos inexistentes, puertos incompatibles, ciclos de
grupo, versión desconocida, límite de tamaño), roundtrip JSON, coordenadas de grupos anidados,
transformación 2D→3D, rutas que no atraviesan volúmenes (6 plantillas × 2 estilos de ruta),
conservación semántica al cambiar de estilo, comandos (borrado con aristas, grupos que conservan
hijos, agrupar/desagrupar, duplicar, puertos), historial (undo/redo, drag = 1 entrada, redo
invalidado, comandos rechazados sin efecto), variaciones deterministas (6 categorías × 3
complejidades × 25 seeds sin solapes), ELK, validación de salida remota, persistencia (corrupción,
versión, cuota), énfasis 3D y fixture de rendimiento.

### Accesibilidad (WCAG 2.2 AA)

`tests/e2e/a11y.spec.ts` pasa axe-core (etiquetas `wcag2a` a `wcag22aa`) sobre AWS Load Testing en
los cuatro estilos, con la app en claro y en oscuro, en 3D y en 2D; también sobre el inspector,
Apariencia, Estructura y el layout de móvil (390 px). Comprueba además las alternativas sin
arrastre (2.5.7: botones de cámara y «Conectar con…»), la pausa de las partículas (2.2.2) y la
lista textual enlazada al lienzo 3D con `aria-describedby` (1.1.1). Los contrastes de la paleta de
diagramas los verifica `diagramTokens.test.ts`. axe no sustituye una revisión manual con lector de
pantalla.

### E2E (Playwright)

1. Primer arranque: título, leyenda, «Editar en 2D» y escena con 16 nodos / 17 relaciones.
2. Añadir componente, renombrar en el inspector, conectar arrastrando puertos en 2D → la escena 3D
   contiene 17/18 (conteo leído del grafo de escena real); Ctrl+Z / Ctrl+Shift+Z.
3. Borrar grupo «VPC» → diálogo → conservar hijos (16 nodos, 4 grupos).
4. Cambiar a Blueprint conserva IDs, pertenencia y conexiones.
5. Generador local: vista previa → insertar.
6. Pérdida de contexto WebGL → «Continuar en 2D» con el documento intacto.
7. Autosave → recarga sin parámetros → documento recuperado.
8. Guardado corrupto → aviso, copia de seguridad `strata:recovered:*`, plantilla por defecto.
9. Exportar JSON → reimportar; `schemaVersion: 99` y referencias rotas se rechazan sin mutar.
10. SVG: dimensiones > 0, 12 nodos, 15 relaciones, fuentes incrustadas.
11. PNG 3D: firma PNG, 1920×1080, > 40 colores muestreados; versión transparente con píxeles alpha 0.
12. Reconectar el extremo de una relación en 2D conserva su ID y cambia el destino.

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
