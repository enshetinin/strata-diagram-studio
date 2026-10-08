# Changelog

Todos los cambios relevantes de este proyecto se documentan en este fichero.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/).

## [Sin publicar]

## [1.0.0] - 2026-10-08

Primera versión estable.

### Añadido

- **Un documento, dos vistas:** un único `DiagramDocument` en JSON (`schemaVersion: 1`) alimenta el
  editor 2D (React Flow) y la escena 3D isométrica (Three.js / React Three Fiber).
- **Editor 2D:** puertos tipados con validación de conexiones, grupos anidados, marco de
  selección, segmentos de arista arrastrables, reconexión de extremos, minimapa, ajuste a rejilla,
  auto-layout con ELK, copiar/cortar/pegar nodos y grupos, deshacer/rehacer.
- **Escena 3D:** cuatro estilos visuales, plataformas por grupo, rutas que evitan volúmenes,
  partículas de flujo que se pueden pausar, aislamiento de grupos y vuelta a 2D si se pierde el
  contexto WebGL.
- **Modelo:** 24 arquetipos de nodo con glifos y modelos 3D, tipos de grupo (incluida la frontera
  de confianza), 6 tipos de relación y notas en el lienzo con línea guía.
- **Biblioteca de componentes** con categorías y búsqueda insensible a acentos.
- **Recorridos narrativos** con editor de pasos y modo presentación a pantalla completa.
- **Compartir sin servidor:** enlaces de solo lectura y de presentación con el diagrama comprimido
  en el fragmento de la URL.
- **Persistencia:** autoguardado local, aviso y copia de seguridad ante datos corruptos.
- **Importación y exportación:** JSON validado con esquema, SVG vectorial (2D) y PNG 3D con título
  y leyenda en varios formatos (hasta 4K, 1:1, 4:5, fondo transparente).
- **Nuevo diagrama:** diagrama en blanco, seis plantillas de arquitecturas reales y un generador
  local basado en reglas; cliente para un generador remoto opcional
  (`VITE_STRATA_GENERATOR_URL`).
- **Diseño:** modo claro y oscuro, layout móvil con menú y cajón lateral.
- **Accesibilidad WCAG 2.2 AA** verificada con axe-core: todo el grafo se puede editar sin el
  lienzo 3D, alternativas sin arrastre y descripción textual de la escena.
- **Calidad:** Biome, TypeScript strict, tests unitarios con Vitest, E2E y accesibilidad con
  Playwright, e integración continua en GitHub Actions.
- **Demo pública** en GitHub Pages, desplegada automáticamente tras el CI en `main`.

[Sin publicar]: https://github.com/enshetinin/strata-diagram-studio/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/enshetinin/strata-diagram-studio/releases/tag/v1.0.0
