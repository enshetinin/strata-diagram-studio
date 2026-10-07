# Strata Frontend Patterns

## Contents

- Derived state vs duplicated state
- Effects vs events
- Zustand selectors
- Domain/UI separation
- React Flow transient state
- Stable React Flow props
- Async stale-result guards
- Three.js/R3F frame behavior
- Shared Three.js resources
- Boundary validation with Zod
- Exhaustive domain variants
- Naming and extraction

## Derived state vs duplicated state

### Avoid

```tsx
function Inspector({ node }: { node: DiagramNode }) {
  const [title, setTitle] = useState('')

  useEffect(() => {
    setTitle(`${node.kind}: ${node.label}`)
  }, [node.kind, node.label])

  return <h2>{title}</h2>
}
```

This creates a second source of truth and an unnecessary Effect.

### Prefer

```tsx
function Inspector({ node }: { node: DiagramNode }) {
  const title = `${node.kind}: ${node.label}`
  return <h2>{title}</h2>
}
```

Keep state only for information the UI must remember independently.

## Effects vs events

### Avoid

```tsx
function SaveButton({ shouldSave }: { shouldSave: boolean }) {
  useEffect(() => {
    if (shouldSave) saveDocument()
  }, [shouldSave])

  return <button>Save</button>
}
```

A user action should be handled where the action occurs.

### Prefer

```tsx
function SaveButton() {
  return <button onClick={saveDocument}>Save</button>
}
```

Use Effects for synchronization with external systems whose lifetime follows rendering, such as event listeners, renderer integration, or subscriptions.

## Zustand selectors

### Avoid: whole-store subscription

```tsx
const store = useUiStore()
const selectedId = store.selectedNodeIds[0]
```

Every unrelated UI-store update can rerender this component.

### Prefer: narrow subscription

```tsx
const selectedId = useUiStore((state) => state.selectedNodeIds[0])
```

### Avoid: unstable selector result in Zustand 5

```tsx
const { mode, selectedNodeIds } = useUiStore((state) => ({
  mode: state.mode,
  selectedNodeIds: state.selectedNodeIds,
}))
```

### Prefer: separate selectors

```tsx
const mode = useUiStore((state) => state.mode)
const selectedNodeIds = useUiStore((state) => state.selectedNodeIds)
```

Or when grouping is useful:

```tsx
import { useShallow } from 'zustand/react/shallow'

const { mode, selectedNodeIds } = useUiStore(
  useShallow((state) => ({
    mode: state.mode,
    selectedNodeIds: state.selectedNodeIds,
  })),
)
```

## Domain/UI separation

### Avoid: framework types in domain logic

```ts
// src/domain/connect.ts
import type { Connection } from '@xyflow/react'

export function connect(document: DiagramDocument, connection: Connection) {
  // domain rules mixed with React Flow representation
}
```

### Prefer: domain command + adapter mapping

```ts
// src/domain/commands/connect-nodes.ts
export interface ConnectNodesInput {
  source: Endpoint
  target: Endpoint
  relation: RelationKind
}

export function connectNodes(
  document: DiagramDocument,
  input: ConnectNodesInput,
): DiagramDocument {
  assertConnectionAllowed(document, input)
  return addEdge(document, createEdge(input))
}
```

```ts
// src/features/editor2d/toConnectNodesInput.ts
import type { Connection } from '@xyflow/react'

export function toConnectNodesInput(connection: Connection): ConnectNodesInput | null {
  if (!connection.source || !connection.target) return null
  // Map adapter data into the canonical domain representation.
}
```

The domain does not know React Flow exists.

## React Flow transient state

### Avoid: committing every drag frame

```tsx
const onNodeDrag = (_event: MouseEvent, node: Node) => {
  execute(moveElements(document, [{ id: node.id, position: node.position }]))
}
```

This pollutes history and fans high-frequency updates into all consumers.

### Prefer: transient adapter state, one semantic commit

```tsx
const onNodeDrag = useCallback((_event: MouseEvent, node: Node) => {
  setTransientPositions((current) => ({
    ...current,
    [node.id]: node.position,
  }))
}, [])

const onNodeDragStop = useCallback((_event: MouseEvent, node: Node) => {
  actions.moveElements([{ id: node.id, position: node.position }])
  setTransientPositions({})
}, [actions])
```

Adapt the exact code to existing editor conventions; the important boundary is transient movement vs committed document change.

## Stable React Flow props

### Avoid

```tsx
function Diagram() {
  const nodeTypes = { service: ServiceNode, database: DatabaseNode }
  const snapGrid: [number, number] = [16, 16]

  return <ReactFlow nodeTypes={nodeTypes} snapGrid={snapGrid} />
}
```

Both references are recreated on every render.

### Prefer

```tsx
const NODE_TYPES = {
  service: ServiceNode,
  database: DatabaseNode,
} satisfies NodeTypes

const SNAP_GRID: SnapGrid = [16, 16]

function Diagram() {
  return <ReactFlow nodeTypes={NODE_TYPES} snapGrid={SNAP_GRID} />
}
```

For callbacks that close over reactive values, use `useCallback` when stable identity matters to React Flow or memoized children.

## Async stale-result guards

### Avoid

```ts
async function runLayout(document: DiagramDocument) {
  const layout = await calculateElkLayout(document)
  documentStore.getState().replaceDocument(layout)
}
```

The document may have changed while ELK was running.

### Prefer

```ts
async function runLayout() {
  const { document, revision } = documentStore.getState()
  const requestId = beginLayoutRequest()
  const nextLayout = await calculateElkLayout(document)

  const current = documentStore.getState()
  if (requestId !== getLatestLayoutRequestId()) return
  if (current.revision !== revision) return

  current.execute(applyLayout(nextLayout))
}
```

Use the project's existing revision/request-id mechanism rather than introducing a parallel one.

## Three.js/R3F frame behavior

### Avoid: React state per frame

```tsx
function FlowParticle() {
  const [progress, setProgress] = useState(0)

  useFrame((_, delta) => {
    setProgress((value) => (value + delta) % 1)
  })

  return <mesh position-x={progress} />
}
```

### Prefer: mutate a render object/ref for per-frame animation

```tsx
function FlowParticle() {
  const ref = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh) return
    mesh.position.x = (mesh.position.x + delta) % 1
  })

  return <mesh ref={ref} />
}
```

In a `frameloop="demand"` application, animate only while needed and ensure invalidation is active for that period.

## Shared Three.js resources

### Avoid: allocation per repeated component render

```tsx
function Port({ color }: { color: string }) {
  return (
    <mesh
      geometry={new THREE.SphereGeometry(0.04, 12, 12)}
      material={new THREE.MeshBasicMaterial({ color })}
    />
  )
}
```

### Prefer: shared/managed resources or instancing

```tsx
const PORT_GEOMETRY = new THREE.SphereGeometry(0.04, 12, 12)

function Port({ material }: { material: THREE.Material }) {
  return <mesh geometry={PORT_GEOMETRY} material={material} />
}
```

For many identical ports/particles, prefer `InstancedMesh`. If a resource is created for a temporary/export lifecycle, dispose it explicitly when that lifecycle ends.

## Boundary validation with Zod

### Avoid

```ts
const imported = JSON.parse(text) as DiagramDocument
documentStore.getState().replaceDocument(imported)
```

A TypeScript assertion does not validate runtime data.

### Prefer

```ts
const raw: unknown = JSON.parse(text)
const parsed = diagramDocumentSchema.safeParse(raw)

if (!parsed.success) {
  return { ok: false, error: formatImportError(parsed.error) }
}

return { ok: true, document: validateDocumentInvariants(parsed.data) }
```

Keep size/count/reference checks at the untrusted boundary too.

## Exhaustive domain variants

### Avoid

```ts
function nodeHeight(kind: NodeKind) {
  if (kind === 'database') return 1.2
  if (kind === 'queue') return 0.8
  return 1
}
```

A new `NodeKind` silently receives a fallback that may be wrong.

### Prefer when the variant set is intentionally closed

```ts
function assertNever(value: never): never {
  throw new Error(`Unexpected node kind: ${String(value)}`)
}

function nodeHeight(kind: NodeKind): number {
  switch (kind) {
    case 'database':
      return 1.2
    case 'queue':
      return 0.8
    case 'service':
      return 1
    // ...all supported kinds
    default:
      return assertNever(kind)
  }
}
```

If the project already has a canonical `KIND_INFO` map, use that instead of creating a second switch.

## Naming and extraction

### Avoid

```ts
function handleData(data: any) {
  const result = doStuff(data)
  return result
}
```

### Prefer

```ts
function buildSceneModel(
  document: DiagramDocument,
  appearance: DiagramAppearance,
): SceneModel {
  const absoluteLayout = resolveAbsoluteLayout(document)
  return createSceneModel(document, absoluteLayout, appearance)
}
```

Names should expose the domain transformation. Extract a helper when it names a coherent concept or isolates a reason to change—not just to reduce line count.
