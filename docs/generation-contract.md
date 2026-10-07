# Contrato de generación

La aplicación funciona sin claves. Hay dos acciones separadas:

| Acción | Qué cambia | Implementación |
| --- | --- | --- |
| **Nueva arquitectura** | Topología (nodos, grupos, relaciones) | `LocalRuleGenerator` (reglas + seed) o un proveedor remoto |
| **Nueva apariencia** | Estilo, altura de capas, espaciado y dirección del layout | `appearanceVariant(seed)` + ELK; conserva grafo e IDs |

## Interfaz

```ts
interface DiagramGenerator {
  readonly info: { id: string; label: string; kind: 'local' | 'remote' };
  supports(request: GenerationRequest): boolean;
  generate(request: GenerationRequest, signal: AbortSignal): Promise<GenerationResult>;
}

type GenerationRequest =
  | { mode: 'rules'; category: TemplateCategory; seed: number; complexity: 1 | 2 | 3 }
  | { mode: 'prompt'; prompt: string };
```

Errores tipados (`GenerationError.code`): `cancelled`, `unsupported`, `provider-unavailable`,
`network`, `http`, `invalid-output`, `limits`, `timeout`. Cada error puede adjuntar `issues`
(ruta + mensaje) de la validación.

## Flujo

```
texto/reglas → salida estructurada → Zod (generatedGraphSchema)
            → normalización (puertos por defecto, narrativa)
            → validación referencial (IDs únicos, extremos y puertos existentes, grupos sin ciclos)
            → layout ELK (solo salida remota) → vista previa → confirmación → inserción (1 entrada de historial)
```

Nada toca el documento activo antes de confirmar. Si el usuario edita mientras llega una respuesta,
la vista previa lo avisa; insertar reemplaza el documento pero «Deshacer» recupera la versión
anterior.

## Proveedor remoto (HTTP)

Se activa definiendo `VITE_STRATA_GENERATOR_URL` con la URL de **tu** backend. Es una URL pública:
las claves del modelo viven solo en el servidor. Nunca uses `VITE_*` para secretos.

### Petición

`POST <VITE_STRATA_GENERATOR_URL>` con `Content-Type: application/json`

```json
{
  "schemaVersion": 1,
  "prompt": "pipeline de eventos con pagos e inventario",
  "limits": { "maxNodes": 80, "maxEdges": 160, "maxGroups": 24 },
  "nodeKinds": ["client", "human", "device", "frontend", "mobile", "api", "service", "container", "vm", "function", "scheduler", "workflow", "database", "vector", "search", "warehouse", "storage", "document", "registry", "repo", "queue", "stream", "notification", "cache", "agent", "model", "guardrail", "tool", "notebook", "gateway", "balancer", "cdn", "dns", "firewall", "identity", "secret", "observability", "external", "generic"],
  "relationKinds": ["request", "response", "data", "event", "async", "dependency", "telemetry", "control", "auth", "stream", "replication", "sync", "backup", "deploy"]
}
```

### Respuesta correcta (200)

```json
{
  "graph": {
    "name": "Comercio por eventos",
    "description": "…",
    "groups": [{ "id": "g-core", "label": "Pedidos", "kind": "domain", "parentGroupId": null }],
    "nodes": [{ "id": "n-api", "kind": "api", "label": "API", "groupId": "g-core" }],
    "edges": [{ "id": "e-1", "source": "n-api", "target": "n-db", "relation": "data", "label": "SQL", "order": 1 }]
  }
}
```

Sin coordenadas: el cliente calcula el layout. IDs: `[A-Za-z0-9_.:-]{1,80}`.

### Error

```json
{ "error": { "code": "rate_limited", "message": "Inténtalo más tarde" } }
```

con un estado HTTP ≠ 2xx. El cliente muestra el mensaje (truncado a 200 caracteres).

### Recomendaciones para el backend

- Usa la salida estructurada / JSON schema del proveedor que elijas; el modelo concreto es una
  decisión del backend y puede cambiar sin tocar el cliente.
- Trata `prompt` como dato: no ejecutes herramientas, código ni HTML derivados de él.
- Aplica límites de tamaño y tiempo (el cliente corta a los 60 s y rechaza respuestas > 1 MB).
- La aplicación ilustra sistemas: el backend no debe crear infraestructura ni ejecutar agentes.

## Sin proveedor

El campo de descripción explica que la generación libre requiere un proveedor y solo ofrece
**ejemplos compatibles** por coincidencia de palabras clave (`suggest.ts`), etiquetados como tales.
No se presenta ningún resultado simulado como respuesta de un LLM.
