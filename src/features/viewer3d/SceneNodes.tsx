import { Edges, Line } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { memo, useMemo } from 'react';
import { useUiStore } from '../../state/uiStore';
import type { SceneNode } from '../layout/sceneModel';
import { dimColor } from './materials';
import { MODEL_ROLES, nodeModel, type ModelRole } from './nodeModels';
import { DIM_AMOUNT, useScene } from './sceneContext';
import { accentColor } from './themes';

function selectNode(event: ThreeEvent<MouseEvent>, id: string) {
  event.stopPropagation();
  const ui = useUiStore.getState();
  if (event.shiftKey || event.metaKey || event.ctrlKey) ui.toggleSelect({ type: 'node', id });
  else ui.select([{ type: 'node', id }]);
}

const NodeMesh = memo(function NodeMesh({ node }: { node: SceneNode }) {
  const { theme, materials, highlight, shadows } = useScene();
  const emphasis = highlight.node(node.id);
  const dim = DIM_AMOUNT[emphasis];
  // Bevels only where no outline is drawn: outlined styles keep crisp edges.
  const soft = !theme.node.edges;
  const model = useMemo(() => nodeModel(node.kind, node.sizeX, node.sizeZ, node.top - node.bottom, soft), [node.kind, node.sizeX, node.sizeZ, node.top, node.bottom, soft]);

  const body = dimColor(theme.node.body, theme.background, dim);
  // Accents and glass carry the domain colour in every style except the ink one.
  const domain = theme.node.finish === 'ink' ? theme.node.cap : accentColor(theme, node.accent);
  const cap = dimColor(domain, theme.background, dim);
  const glass = cap;
  const detail = dimColor(theme.node.detail, theme.background, dim);
  const edgeColor = dimColor(theme.node.edgeColor, theme.background, dim);
  const glassOpacity = theme.node.glassOpacity * (dim > 0.5 ? 0.5 : 1);
  const material = (role: ModelRole) =>
    role === 'body' ? materials.surface(body, 1, theme.node.finish) : role === 'accent' ? materials.gloss(cap) : role === 'glass' ? materials.glass(glass, glassOpacity) : materials.surface(detail, 1, theme.node.finish);
  const selected = emphasis === 'selected';
  const halfX = node.sizeX / 2 + 0.06;
  const halfZ = node.sizeZ / 2 + 0.06;

  return (
    <group
      position={[node.x, node.bottom, node.z]}
      userData={{ strataNodeId: node.id }}
      onClick={(event) => selectNode(event, node.id)}
      onDoubleClick={(event) => {
        event.stopPropagation();
        useUiStore.getState().focus({ type: 'node', id: node.id });
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
      }}
    >
      {MODEL_ROLES.map((role) => {
        const geometry = model[role];
        if (!geometry) return null;
        return (
          <mesh key={role} geometry={geometry} material={material(role)} castShadow={shadows && role !== 'glass'} receiveShadow={shadows} renderOrder={role === 'glass' ? 1 : 0}>
            {theme.node.edges && (role === 'body' || role === 'accent') ? <Edges threshold={24} color={edgeColor} transparent={theme.node.edgeOpacity < 1} opacity={theme.node.edgeOpacity} /> : null}
          </mesh>
        );
      })}
      {selected ? (
        <Line
          points={[
            [-halfX, 0.012, -halfZ],
            [halfX, 0.012, -halfZ],
            [halfX, 0.012, halfZ],
            [-halfX, 0.012, halfZ],
            [-halfX, 0.012, -halfZ],
          ]}
          color={theme.selection}
          lineWidth={2.5}
        />
      ) : null}
    </group>
  );
});

export function SceneNodes() {
  const { model } = useScene();
  return (
    <group name="nodes">
      {model.nodes.map((node) => (
        <NodeMesh key={node.id} node={node} />
      ))}
    </group>
  );
}
