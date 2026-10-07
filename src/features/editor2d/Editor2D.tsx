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
import { findPreset, presetSeed } from '../../domain/library';
import type { EdgeEndpoint, ElementRef } from '../../domain/types';
import { addNodeAt, connect, reconnect } from '../../state/actions';
import { useDocumentStore } from '../../state/documentStore';
import { usePreferences } from '../../state/preferencesStore';
import { useUiStore } from '../../state/uiStore';
import { refForFlowNode, toFlowEdges, toFlowNodes, type FlowEdge, type FlowNode } from './adapter';
import { GroupNode } from './GroupNode';
import { NoteNode } from './NoteNode';
import { registerPasteAnchor } from './pasteAnchor';
import { EdgeMarkers, StrataEdge } from './StrataEdge';
import { StrataNode } from './StrataNode';
import { accent2d } from './visual';
import { EditorToolbar } from './EditorToolbar';
import { initialViewport } from './viewport';
import { LIBRARY_MIME } from './dnd';
import { CanvasEmpty } from '../../components/ui/CanvasEmpty';

// Stable references outside render, as React Flow requires.
const nodeTypes: NodeTypes = { strata: StrataNode, group: GroupNode, note: NoteNode };
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

const SMALL_SCREEN_NOTE = 'strata:note:small-screen-2d';

/** Phones get a heads-up once: viewing works, building is easier with a pointer. Shown by CSS below 600px. */
function SmallScreenNote() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(SMALL_SCREEN_NOTE) === '1';
    } catch {
      return false;
    }
  });
  if (dismissed) return null;
  return (
    <p className="editor2d__small-note" role="note">
      <span>Editar es más cómodo en una pantalla grande. Aquí puedes revisar, mover componentes y presentar.</span>
      <button
        type="button"
        className="link-button"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(SMALL_SCREEN_NOTE, '1');
          } catch {
            // Private mode: the note simply comes back next time.
          }
        }}
      >
        Entendido
      </button>
    </p>
  );
}

function Canvas2D() {
  const doc = useDocumentStore((state) => state.doc);
  const readOnly = useDocumentStore((state) => state.readOnly !== null);
  const selection = useUiStore((state) => state.selection);
  const isolated = useUiStore((state) => state.isolatedGroupId);
  const focusRequest = useUiStore((state) => state.focusRequest);
  const snap = usePreferences((state) => state.snapToGrid);
  const { fitView, screenToFlowPosition, setViewport } = useReactFlow();
  const [invalidReason, setInvalidReason] = useState<string | null>(null);

  const derivedNodes = useMemo(() => toFlowNodes(doc, selection, isolated), [doc, selection, isolated]);
  const edges = useMemo(() => toFlowEdges(doc, selection), [doc, selection]);
  // Local copy only for in-flight drags/resizes; rebuilt from the document on every change.
  const [nodes, setNodes] = useState<FlowNode[]>(derivedNodes);
  useEffect(() => setNodes(derivedNodes), [derivedNodes]);

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    const transient = changes.filter((change) => change.type === 'position' || change.type === 'dimensions');
    if (transient.length > 0) setNodes((current) => applyNodeChanges(transient, current));
    const doc = useDocumentStore.getState().doc;
    applySelectChanges(changes.flatMap((change) => (change.type === 'select' ? [{ ref: refForFlowNode(doc, change.id), selected: change.selected }] : [])));
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
    const bucket = { node: current.layout.nodes, group: current.layout.groups, annotation: current.layout.annotations };
    const moves: Move[] = dragged
      .map((node): Move => ({ type: node.type === 'group' ? 'group' : node.type === 'note' ? 'annotation' : 'node', id: node.id, x: node.position.x, y: node.position.y }))
      .filter((move) => {
        const rect = bucket[move.type][move.id];
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
      const preset = findPreset(event.dataTransfer.getData(LIBRARY_MIME));
      if (!preset) return;
      event.preventDefault();
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      // Deepest group under the cursor becomes the container.
      const target = deepestGroupAt(resolveAbsoluteLayout(useDocumentStore.getState().doc), point);
      addNodeAt(presetSeed(preset), { x: point.x - 88, y: point.y - 40 }, target);
    },
    [screenToFlowPosition],
  );

  // Pastes land under the pointer while it is over the canvas.
  const pointer = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    registerPasteAnchor(() => (pointer.current ? screenToFlowPosition(pointer.current) : null));
    return () => registerPasteAnchor(null);
  }, [screenToFlowPosition]);

  // Opening view: legible zoom, framed on the content (or its start when it is large).
  const wrapper = useRef<HTMLDivElement>(null);
  const applyInitialViewport = useCallback(() => {
    const element = wrapper.current;
    if (!element) return;
    const abs = resolveAbsoluteLayout(useDocumentStore.getState().doc);
    const view = initialViewport([...abs.nodes.values(), ...abs.groups.values(), ...abs.annotations.values()], { width: element.clientWidth, height: element.clientHeight });
    if (view) void setViewport(view);
  }, [setViewport]);
  // A replaced document (template, import, undo of it) opens the same way.
  const resetNonce = useUiStore((state) => state.cameraResetNonce);
  const seenReset = useRef(resetNonce);
  useEffect(() => {
    if (seenReset.current === resetNonce) return;
    seenReset.current = resetNonce;
    applyInitialViewport();
  }, [resetNonce, applyInitialViewport]);

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
      ref={wrapper}
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
        onInit={applyInitialViewport}
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
          // Orientation only: small enough not to cover the components it maps.
          style={{ width: 168, height: 112 }}
          nodeColor={(node) => {
            const flow = node as FlowNode;
            if (flow.type === 'group') return 'transparent';
            if (flow.type === 'note') return 'var(--sheet-edge)';
            return accent2d(flow.data.accent);
          }}
          nodeStrokeColor={(node) => (node.type === 'group' ? 'var(--edge)' : 'transparent')}
          maskColor="var(--minimap-mask)"
        />
        <Controls showInteractive={false} aria-label="Zoom y encuadre" />
      </ReactFlow>
      {!invalidReason && !readOnly && doc.nodes.length >= 2 && doc.edges.length === 0 ? (
        <p className="editor2d__hint" role="status">
          Para conectar, pasa el ratón por un componente y arrastra desde uno de sus puntos hasta otro.
        </p>
      ) : null}
      {invalidReason ? (
        <p className="editor2d__invalid" role="status">
          Conexión no válida: {invalidReason}
        </p>
      ) : null}
      {doc.nodes.length === 0 && doc.groups.length === 0 ? (
        <CanvasEmpty
          title="Empieza por un componente"
          text="Pulsa «Añadir» o arrastra componentes desde Biblioteca. Después conéctalos arrastrando desde los puntos que aparecen al pasar el ratón."
          action={{ label: 'Abrir Biblioteca', onClick: () => useUiStore.getState().setLeft(true, 'library') }}
        />
      ) : null}
      <EditorToolbar />
      {!readOnly ? <SmallScreenNote /> : null}
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
