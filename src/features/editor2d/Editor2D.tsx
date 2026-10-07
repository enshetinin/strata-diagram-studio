import '@xyflow/react/dist/style.css';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type EdgeTypes,
  type IsValidConnection,
  type NodeChange,
  type NodeTypes,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { moveElements, type Move } from '../../domain/commands';
import { deepestGroupAt, resolveAbsoluteLayout } from '../../domain/geometry';
import { checkConnection } from '../../domain/invariants';
import { NODE_KINDS, type EdgeEndpoint, type ElementRef, type NodeKind } from '../../domain/types';
import { addNodeAt, connect, reconnect } from '../../state/actions';
import { useDocumentStore } from '../../state/documentStore';
import { usePreferences } from '../../state/preferencesStore';
import { useUiStore } from '../../state/uiStore';
import { toFlowEdges, toFlowNodes, type FlowEdge, type FlowNode } from './adapter';
import { GroupNode } from './GroupNode';
import { registerPasteAnchor } from './pasteAnchor';
import { EdgeMarkers, StrataEdge } from './StrataEdge';
import { StrataNode } from './StrataNode';
import { accent2d } from './visual';
import { EditorToolbar } from './EditorToolbar';
import { LIBRARY_MIME } from './dnd';
import { CanvasEmpty } from '../../components/ui/CanvasEmpty';

// Stable references outside render, as React Flow requires.
const nodeTypes: NodeTypes = { strata: StrataNode, group: GroupNode };
const edgeTypes: EdgeTypes = { strata: StrataEdge };

function endpoints(connection: Connection): { source: EdgeEndpoint; target: EdgeEndpoint } | null {
  if (!connection.sourceHandle || !connection.targetHandle) return null;
  return {
    source: { nodeId: connection.source, portId: connection.sourceHandle },
    target: { nodeId: connection.target, portId: connection.targetHandle },
  };
}

/** Loose mode lets users drag from either end; swap when only the reverse is valid. */
function orient(connection: Connection): { source: EdgeEndpoint; target: EdgeEndpoint } | null {
  const ends = endpoints(connection);
  if (!ends) return null;
  const doc = useDocumentStore.getState().doc;
  if (checkConnection(doc, ends.source, ends.target).ok) return ends;
  if (checkConnection(doc, ends.target, ends.source).ok) return { source: ends.target, target: ends.source };
  return ends;
}

/**
 * Selection follows user-driven `select` changes only. React Flow's own
 * selection state lags behind controlled props on mount, so it is never read
 * back as the source of truth.
 */
function applySelectChanges(changes: { ref: ElementRef; selected: boolean }[]) {
  if (changes.length === 0) return;
  const ui = useUiStore.getState();
  let next = [...ui.selection];
  for (const { ref, selected } of changes) {
    const present = next.some((item) => item.type === ref.type && item.id === ref.id);
    if (selected && !present) next.push(ref);
    if (!selected && present) next = next.filter((item) => !(item.type === ref.type && item.id === ref.id));
  }
  const same = next.length === ui.selection.length && next.every((ref, index) => ui.selection[index]?.id === ref.id && ui.selection[index]?.type === ref.type);
  if (!same) ui.select(next);
}

function Canvas2D() {
  const doc = useDocumentStore((state) => state.doc);
  const selection = useUiStore((state) => state.selection);
  const isolated = useUiStore((state) => state.isolatedGroupId);
  const focusRequest = useUiStore((state) => state.focusRequest);
  const snap = usePreferences((state) => state.snapToGrid);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const [invalidReason, setInvalidReason] = useState<string | null>(null);

  const derivedNodes = useMemo(() => toFlowNodes(doc, selection, isolated), [doc, selection, isolated]);
  const edges = useMemo(() => toFlowEdges(doc, selection), [doc, selection]);
  // Local copy only for in-flight drags/resizes; rebuilt from the document on every change.
  const [nodes, setNodes] = useState<FlowNode[]>(derivedNodes);
  useEffect(() => setNodes(derivedNodes), [derivedNodes]);

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    const transient = changes.filter((change) => change.type === 'position' || change.type === 'dimensions');
    if (transient.length > 0) setNodes((current) => applyNodeChanges(transient, current));
    const groups = new Set(useDocumentStore.getState().doc.groups.map((group) => group.id));
    applySelectChanges(changes.flatMap((change) => (change.type === 'select' ? [{ ref: { type: groups.has(change.id) ? ('group' as const) : ('node' as const), id: change.id }, selected: change.selected }] : [])));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<FlowEdge>[]) => {
    applySelectChanges(changes.flatMap((change) => (change.type === 'select' ? [{ ref: { type: 'edge' as const, id: change.id }, selected: change.selected }] : [])));
  }, []);

  // Shift + marquee adds to the current selection instead of replacing it (Figma).
  const marqueeBase = useRef<ElementRef[] | null>(null);
  const onSelectionStart = useCallback((event: React.MouseEvent) => {
    marqueeBase.current = event.shiftKey ? useUiStore.getState().selection : null;
  }, []);
  const onSelectionEnd = useCallback(() => {
    const base = marqueeBase.current;
    marqueeBase.current = null;
    if (!base) return;
    const ui = useUiStore.getState();
    const merged = [...base, ...ui.selection.filter((ref) => !base.some((item) => item.type === ref.type && item.id === ref.id))];
    if (merged.length !== ui.selection.length) ui.select(merged);
  }, []);

  const onNodeDragStop = useCallback((_event: unknown, _node: FlowNode | null, dragged: FlowNode[]) => {
    const current = useDocumentStore.getState().doc;
    const moves: Move[] = dragged
      .map((node) => ({ type: node.type === 'group' ? ('group' as const) : ('node' as const), id: node.id, x: node.position.x, y: node.position.y }))
      .filter((move) => {
        const rect = move.type === 'group' ? current.layout.groups[move.id] : current.layout.nodes[move.id];
        return rect && (Math.round(rect.x) !== Math.round(move.x) || Math.round(rect.y) !== Math.round(move.y));
      });
    if (moves.length === 0) return;
    const result = useDocumentStore.getState().execute(moves.length === 1 ? 'Mover' : `Mover ${moves.length} elementos`, (d) => moveElements(d, moves));
    if (!result.ok) {
      useUiStore.getState().notify('error', result.error);
      setNodes(toFlowNodes(current, useUiStore.getState().selection, useUiStore.getState().isolatedGroupId));
    }
  }, []);

  const isValidConnection = useCallback<IsValidConnection<FlowEdge>>((candidate) => {
    const oriented = orient(candidate as Connection);
    if (!oriented) return false;
    const check = checkConnection(useDocumentStore.getState().doc, oriented.source, oriented.target);
    return check.ok;
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    const oriented = orient(connection);
    if (oriented) connect(oriented.source, oriented.target);
  }, []);

  const onConnectEnd = useCallback(() => setInvalidReason(null), []);

  const onReconnect = useCallback((oldEdge: FlowEdge, connection: Connection) => {
    const ends = endpoints(connection);
    if (!ends) return;
    if (!reconnect(oldEdge.id, ends)) return;
    useUiStore.getState().select([{ type: 'edge', id: oldEdge.id }]);
  }, []);

  // Explain why a hovered target is rejected while dragging a connection.
  const onConnectStart = useCallback(() => setInvalidReason(null), []);
  const explain = useCallback((connection: Connection) => {
    const oriented = orient(connection);
    if (!oriented) return;
    const check = checkConnection(useDocumentStore.getState().doc, oriented.source, oriented.target);
    setInvalidReason(check.ok ? null : check.reason);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      const kind = event.dataTransfer.getData(LIBRARY_MIME) as NodeKind;
      if (!NODE_KINDS.includes(kind)) return;
      event.preventDefault();
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      // Deepest group under the cursor becomes the container.
      const target = deepestGroupAt(resolveAbsoluteLayout(useDocumentStore.getState().doc), point);
      addNodeAt(kind, { x: point.x - 88, y: point.y - 40 }, target);
    },
    [screenToFlowPosition],
  );

  // Pastes land under the pointer while it is over the canvas.
  const pointer = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    registerPasteAnchor(() => (pointer.current ? screenToFlowPosition(pointer.current) : null));
    return () => registerPasteAnchor(null);
  }, [screenToFlowPosition]);

  // Frame the requested / selected element when this view mounts or is asked to.
  const mounted = useRef(false);
  useEffect(() => {
    const ref = focusRequest?.ref ?? (!mounted.current ? useUiStore.getState().selection[0] : undefined);
    mounted.current = true;
    if (!ref || ref.type === 'edge') return;
    const frame = requestAnimationFrame(() => {
      void fitView({ nodes: [{ id: ref.id }], duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300, maxZoom: 1.2, padding: 0.6 });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest, fitView]);

  return (
    <div
      className="editor2d"
      onDragOver={(event) => event.dataTransfer.types.includes(LIBRARY_MIME) && event.preventDefault()}
      onDrop={onDrop}
      onPointerMove={(event) => {
        pointer.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerLeave={() => {
        pointer.current = null;
      }}
    >
      <EdgeMarkers />
      <ReactFlow<FlowNode, FlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onSelectionDragStop={(event, dragged) => onNodeDragStop(event, null, dragged)}
        onSelectionStart={onSelectionStart}
        onSelectionEnd={onSelectionEnd}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onReconnect={onReconnect}
        isValidConnection={(connection) => {
          explain(connection as Connection);
          return isValidConnection(connection);
        }}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={28}
        deleteKeyCode={null}
        // Figma-style canvas: drag on empty space draws a marquee; pan with
        // space + drag, middle / right button or trackpad scroll; pinch or
        // ⌘/Ctrl + wheel zooms.
        selectionOnDrag
        selectionMode={SelectionMode.Full}
        panOnDrag={[1, 2]}
        panOnScroll
        selectionKeyCode={null}
        multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
        snapToGrid={snap}
        snapGrid={[16, 16]}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2.5}
        elevateNodesOnSelect={false}
        proOptions={{ hideAttribution: false }}
        aria-label="Lienzo 2D del diagrama"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--grid-dot)" />
        <MiniMap
          pannable
          zoomable
          ariaLabel="Minimapa"
          nodeColor={(node) => (node.type === 'group' ? 'transparent' : accent2d((node as FlowNode).data.accent))}
          nodeStrokeColor={(node) => (node.type === 'group' ? 'var(--edge)' : 'transparent')}
          maskColor="var(--minimap-mask)"
        />
        <Controls showInteractive={false} aria-label="Zoom y encuadre" />
      </ReactFlow>
      {invalidReason ? (
        <p className="editor2d__invalid" role="status">
          Conexión no válida: {invalidReason}
        </p>
      ) : null}
      {doc.nodes.length === 0 && doc.groups.length === 0 ? (
        <CanvasEmpty
          title="Empieza por un componente"
          text="Arrastra componentes desde Biblioteca al lienzo o pulsa «+» junto a cada uno. Después conéctalos arrastrando de un punto de conexión a otro."
          action={{ label: 'Abrir Biblioteca', onClick: () => useUiStore.getState().setLeft(true, 'library') }}
        />
      ) : null}
      <EditorToolbar />
    </div>
  );
}

export default function Editor2D() {
  return (
    <ReactFlowProvider>
      <Canvas2D />
    </ReactFlowProvider>
  );
}
