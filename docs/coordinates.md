# Coordenadas y layout

## Layout canónico (2D)

- Unidades: píxeles de lienzo. Origen arriba a la izquierda, `+x` a la derecha, `+y` hacia abajo.
- `layout.nodes[id]` y `layout.groups[id]` guardan `{ x, y, width, height }` **locales al contenedor**:
  un nodo con `groupId` se mide desde la esquina superior izquierda de su grupo; un grupo con
  `parentGroupId`, desde la de su padre. Sin contenedor, desde el lienzo.
- `resolveAbsoluteLayout` (`src/domain/geometry.ts`) recorre la cadena de padres una sola vez por
  grupo (memoizado), así un grupo anidado nunca suma su offset dos veces.
- Padding de grupo (`GROUP_PADDING`): 56 px arriba (título), 32 px en los demás lados. Mover o
  añadir un hijo fuera del área hace crecer el grupo y sus ancestros sin mover posiciones absolutas.
- Los puertos se reparten uniformemente en su lado (`portOffset`); React Flow (handles), el SVG y
  la escena 3D usan la misma función.
- `layout.annotations[id]` (notas) es **absoluto**: las notas nunca pertenecen a un grupo. Su línea
  guía sale de `leaderLine` (borde de la nota → borde del nodo, por la recta entre centros), que
  usan el editor 2D, el SVG y la escena 3D. En 3D la nota es una tarjeta a ras de suelo y la guía
  termina a media altura del cuerpo del nodo.

## React Flow

`toFlowNodes` emite grupos ordenados por profundidad (padres antes que hijos) con `parentId` y
posiciones relativas, tal como están en el documento. No hay conversión adicional.

## Mundo 3D

| Concepto | Convención |
| --- | --- |
| Plano | X/Z; Y es altura |
| Escala | `WORLD_SCALE = 0.01` → 1 unidad = 100 px |
| Ejes | `+x` del lienzo → `+x` del mundo; `+y` del lienzo → `+z` del mundo |
| Centro | centro de los bounds absolutos del documento → origen |
| Volumen | centro del volumen = centro del rectángulo absoluto; la altura depende del tipo (`KIND_INFO.height × heightScale` del estilo) |

`createWorldTransform` es la **única** transformación y se aplica a grupos, nodos, puertos y puntos
de ruta (`src/features/layout/sceneModel.ts`).

### Capas

Un grupo de profundidad `d` es una plataforma de grosor `0.08` cuya cara superior está en
`(d + 1) · 0.08 + d · layerHeight`. Los nodos descansan sobre la plataforma de su grupo (o en
`y = 0` si no tienen grupo). `layerHeight` (0–1.5) es puramente visual: no altera pertenencia ni
conexiones.

### Rutas 3D

Cada relación sale del punto de su puerto, avanza un tramo corto (`0.24`) en la normal del lado y:

1. **plana**: si origen y destino están al mismo nivel y un recorrido en L a la altura del puerto no
   cruza ningún volumen;
2. **elevada ortogonal**: si no, sube a una altura de crucero = máximo de los volúmenes bajo el
   rectángulo de la ruta + holgura, recorre en L y baja junto al puerto destino;
3. **arco** (Orbit Atlas): curva cúbica elevada entre los mismos tramos de salida y llegada.

La reparación ocurre en el adaptador de rutas; nunca se mueven componentes. El test
`layout.test.ts` comprueba que ningún punto intermedio queda dentro de un volumen ajeno en las seis
plantillas y ambos estilos de ruta.

## Cámara

- Por defecto ortográfica isométrica (azimut 45°, elevación 35,264°); cada estilo puede variarla.
  Orbit Atlas usa perspectiva moderada (fov 32°).
- El encuadre proyecta las esquinas de todas las plataformas, bloques y rutas (no la caja global),
  reservando la franja del título y de la leyenda. La misma matemática (`cameraFit.ts`) alimenta el
  exportador PNG, que ajusta un frustum propio al aspecto 16:9.
- La órbita está limitada (±60° de azimut, ángulo polar acotado) y nunca se registra en el historial.
