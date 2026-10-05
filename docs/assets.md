# Assets y licencias

| Asset | Origen | Licencia | Uso |
| --- | --- | --- | --- |
| Figtree (300–700; 500/700 en WebGL) | `@fontsource/figtree` | SIL OFL 1.1 | UI y titulares; etiquetas WebGL (`public/assets/fonts/*.woff`); incrustada en el SVG exportado |
| JetBrains Mono 400 | `@fontsource/jetbrains-mono` | SIL OFL 1.1 | Índices, IDs, JSON y metadatos |
| Iconos de interfaz | `lucide-react` | ISC | Botones y controles genéricos |
| Glifos de tipo de nodo | Propios (`src/features/editor2d/visual.ts`) | MIT (este repo) | Formas geométricas genéricas |

- Todo se sirve localmente; no hay CDNs ni fuentes remotas (evita errores CORS en la exportación).
- `public/assets/fonts` se regenera con `pnpm fonts` (también en `postinstall`) desde los paquetes
  instalados.
- **No hay logos oficiales.** Los nodos con proveedor (p. ej. «AWS · Lambda») usan glifos genéricos
  y texto; la descripción de esos nodos lo indica («Icono genérico; no es un logo oficial»).
