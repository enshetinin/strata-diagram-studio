/**
 * WebGL text (troika via drei <Text>) so labels appear in PNG exports.
 * Labels ignore depth so blocks never hide them; density rules keep the
 * selection and main elements labelled.
 */
import { Billboard, Text } from '@react-three/drei';
import { memo } from 'react';
import { KIND_INFO } from '../../domain/catalog';
import type { LabelMode } from '../../domain/types';
import type { SceneEdge, SceneNode } from '../layout/sceneModel';
import { dimColor } from './materials';
import { DIM_AMOUNT, FONT_BOLD, FONT_REGULAR, LABEL_MATERIAL, useScene } from './sceneContext';

const LABEL_RENDER_ORDER = 20;

const NodeLabel = memo(function NodeLabel({ node, showKind }: { node: SceneNode; showKind: boolean }) {
  const { theme, highlight, labelSize: size } = useScene();
  const emphasis = highlight.node(node.id);
  const dim = DIM_AMOUNT[emphasis];
  const color = dimColor(emphasis === 'selected' ? theme.selection : theme.label.color, theme.background, dim);
  const muted = dimColor(theme.label.muted, theme.background, dim);
  return (
    <Billboard position={[node.x, node.top + 0.08, node.z]}>
      <Text
        font={theme.label.weight === 700 ? FONT_BOLD : FONT_REGULAR}
        fontSize={size}
        color={color}
        outlineWidth={size * 0.14}
        outlineColor={theme.label.outline}
        outlineOpacity={dim > 0 ? 0.4 : 0.95}
        anchorX="center"
        anchorY="bottom"
        maxWidth={Math.max(2, node.sizeX * 1.2)}
        textAlign="center"
        lineHeight={1.1}
        renderOrder={LABEL_RENDER_ORDER}
        material={LABEL_MATERIAL}
        position={[0, showKind ? size * 0.85 : 0, 0]}
      >
        {node.label}
      </Text>
      {showKind ? (
        <Text
          font={FONT_REGULAR}
          fontSize={size * 0.62}
          color={muted}
          outlineWidth={size * 0.1}
          outlineColor={theme.label.outline}
          anchorX="center"
          anchorY="bottom"
          renderOrder={LABEL_RENDER_ORDER}
          material={LABEL_MATERIAL}
        >
          {KIND_INFO[node.kind].label.toUpperCase()}
        </Text>
      ) : null}
    </Billboard>
  );
});

const EdgeLabel = memo(function EdgeLabel({ edge, compact }: { edge: SceneEdge; compact: boolean }) {
  const { theme, highlight, labelSize: size } = useScene();
  const emphasis = highlight.edge(edge.id);
  const order = edge.order !== undefined ? String(edge.order) : null;
  // Compact mode keeps only the walkthrough number; full text on demand.
  const text = compact ? order : [order, edge.label].filter(Boolean).join(' · ');
  if (!text) return null;
  const dim = DIM_AMOUNT[emphasis];
  return (
    <Billboard position={[edge.labelAt.x, edge.labelAt.y + 0.05, edge.labelAt.z]}>
      <Text
        font={compact ? FONT_BOLD : FONT_REGULAR}
        fontSize={size * (compact ? 0.8 : 0.74)}
        color={dimColor(emphasis === 'selected' ? theme.selection : compact ? theme.label.color : theme.label.muted, theme.background, dim)}
        outlineWidth={size * (compact ? 0.22 : 0.12)}
        outlineColor={theme.label.outline}
        anchorX="center"
        anchorY="bottom"
        renderOrder={LABEL_RENDER_ORDER - 1}
        material={LABEL_MATERIAL}
      >
        {text}
      </Text>
    </Billboard>
  );
});

/** Decides which labels to draw for the current density mode. */
export function visibleLabels(mode: LabelMode, nodes: SceneNode[], edges: SceneEdge[], priority: Set<string>, activeEdges: string[], crowded = false) {
  const degree = new Map<string, number>();
  for (const edge of edges) {
    degree.set(edge.sourceId, (degree.get(edge.sourceId) ?? 0) + 1);
    degree.set(edge.targetId, (degree.get(edge.targetId) ?? 0) + 1);
  }
  const dense = nodes.length > 36 || crowded;
  // In dense scenes keep only the most connected components (deterministic order).
  const budget = Math.max(6, Math.min(20, Math.round(nodes.length * 0.2)));
  const hubs = new Set(
    [...nodes]
      .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.id.localeCompare(b.id))
      .slice(0, budget)
      .map((node) => node.id),
  );
  const nodeVisible = (node: SceneNode) => {
    if (priority.has(node.id)) return true;
    if (mode === 'all') return true;
    if (mode === 'selection') return false;
    return !dense || hubs.has(node.id);
  };
  const active = new Set(activeEdges);
  const edgeLabels = edges.flatMap((edge) => {
    if (active.has(edge.id) || mode === 'all') return [{ edge, compact: false }];
    if (mode === 'selection') return [];
    // Auto: full text for small diagrams, walkthrough numbers otherwise.
    if (edges.length <= 10) return [{ edge, compact: false }];
    return edge.order !== undefined && !dense ? [{ edge, compact: true }] : [];
  });
  return { nodes: nodes.filter(nodeVisible), edges: edgeLabels, showKind: mode === 'all' };
}

export function SceneLabels({ mode }: { mode: LabelMode }) {
  const { model, highlight, crowded } = useScene();
  const visible = visibleLabels(mode, model.nodes, model.edges, highlight.labelPriority, highlight.activeEdges, crowded);
  return (
    <group name="labels">
      {visible.nodes.map((node) => (highlight.node(node.id) === 'isolatedOut' ? null : <NodeLabel key={node.id} node={node} showKind={visible.showKind} />))}
      {visible.edges.map(({ edge, compact }) => (highlight.edge(edge.id) === 'isolatedOut' ? null : <EdgeLabel key={edge.id} edge={edge} compact={compact} />))}
    </group>
  );
}
