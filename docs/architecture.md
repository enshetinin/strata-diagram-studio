# Arquitectura y decisiones

## Capas

```
domain/      tipos, Zod, invariantes, comandos puros, parse/migración, geometría canónica
state/       documentStore (documento + historial), uiStore (selección, modo, paneles),
             preferencesStore (calidad, snapping), actions (intenciones de usuario → comandos)
features/
  layout/    ELK (auto-layout explícito) y sceneModel (2D → mundo 3D, rutas)
  editor2d/  adaptador React Flow (nodos, grupos, aristas, toolbar)
  viewer3d/  escena R3F: temas, materiales, formas, plataformas, conectores, etiquetas, cámara, PNG
  templates/ seis plantillas, DSL de autoría, generador por reglas y fixture de rendimiento
  generation/ DiagramGenerator, proveedor local/remoto, validación y vista previa
  persistence/ autosave con debounce, carga validada con copia de seguridad
  export/    JSON, SVG (desde el documento) y registro del exportador PNG
app/         shell, paneles, diálogos, atajos y arranque
```

## Decisiones

1. **Un documento, dos adaptadores.** `DiagramDocument` es JSON puro. React Flow recibe nodos
   derivados en cada cambio de revisión (copia local solo para arrastres en curso); Three recibe un
   `SceneModel` derivado. Ninguno guarda una segunda copia editable.
2. **Comandos puros + historial por instantáneas.** Cada comando devuelve un documento nuevo o
   lanza `CommandError`; el store valida invariantes antes de aceptar. El historial guarda
   documentos completos (comparten estructura), máx. 100 entradas. Un arrastre = un `moveElements`
   en `onNodeDragStop`; los sliders confirman al soltar; los campos de texto al perder el foco.
3. **Selección controlada en 2D.** Solo se aplican cambios `select` originados por el usuario
   (`onNodesChange`/`onEdgesChange`); el estado interno de React Flow va un render por detrás de las
   props al montar y leerlo provocaba un bucle.
4. **Grupos.** Borrar o desagrupar conserva hijos y posiciones absolutas; borrar contenido es una
   opción explícita del diálogo. Mover hijos fuera hace crecer el grupo (nunca se encoge solo).
5. **Auto-layout explícito.** ELK se carga bajo demanda (`import()`), recibe tamaños, jerarquía y
   puertos con lado fijo, y su resultado se descarta si llegó tarde (id de petición) o si el
   documento cambió mientras se calculaba (revisión).
6. **Render bajo demanda.** `frameloop="demand"`; se invalida al cambiar el modelo, durante tweens
   de cámara y solo mientras hay partículas animadas. Nada de `setState` por frame.
7. **Reutilización.** Geometrías unitarias compartidas por tipo (escaladas por instancia),
   `MaterialLibrary` por tema+calidad (se libera al cambiar), puntas de flecha, studs de puerto y
   partículas en `InstancedMesh`. Los tubos se crean por relación y se liberan al desmontar.
8. **Etiquetas WebGL** (troika vía drei `Text`) con material base sin depth test para que los
   bloques no las tapen; tamaño derivado del encuadre (~12 px). Densidad: en escenas densas solo se
   etiquetan los nodos más conectados, la selección y sus vecinos. Los títulos de grupo se colocan
   en la franja de cabecera evitando colisiones en espacio de cámara.
9. **PNG mediante renderer dedicado.** Un `WebGLRenderer` temporal (con `preserveDrawingBuffer`
   solo en él) renderiza la misma escena a 1920×1080 con una cámara propia ajustada al aspecto; se
   esperan las fuentes, se adapta la resolución de líneas gruesas y todo se restaura y libera. El
   canvas principal nunca cambia de tamaño ni conserva el buffer.
10. **SVG desde el documento**, no desde el DOM: mismas funciones de puertos y de rutas que React
    Flow (`getSmoothStepPath`) y fuentes incrustadas en base64.
11. **Fallback.** Sin WebGL, con error del canvas o con pérdida de contexto se muestra un estado con
    «Continuar en 2D»; el documento no se toca. `PerformanceMonitor` baja la calidad (alta → media →
    baja) y lo notifica.
12. **Aleatoriedad controlada.** Solo `createRng(seed)` (mulberry32). La única seed «nueva» se
    obtiene con `crypto.getRandomValues` en un clic del usuario y queda visible.

## Estilo de la interfaz

Fluid Tech Editorial (ver `CLAUDE.md`): fondo blanco, neutros fríos, Figtree a gran escala
para titulares y UI, JetBrains Mono para detalles de código, retícula fuerte, separadores finos y
acentos azul/cian contenidos (`--accent` para foco, `--signal` para selección y marcadores). Tokens
en `src/styles/tokens.css`. El editor 2D es una hoja blanca en ambos esquemas de color, coherente
con el SVG exportado.
