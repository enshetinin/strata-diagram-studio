import { Billboard, Edges, Line, Text } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { memo, useMemo } from 'react';
import { useUiStore } from '../../state/uiStore';
import type { SceneGroup } from '../layout/sceneModel';
import { dimColor } from './materials';
import { unitGeometry } from './nodeShapes';
import { DIM_AMOUNT, FONT_BOLD, FONT_REGULAR, LABEL_MATERIAL, useScene } from './sceneContext';
import { viewDirection } from './cameraFit';
import { placeGroupTitles } from './labelPlacement';
import { accentColor } from './themes';

function selectGroup(event: ThreeEvent<MouseEvent>, id: string) {
  event.stopPropagation();
  useUiStore.getState().select([{ type: 'group', id }]);
}

/** Width annotation along the front edge (Blueprint "cotas"). */
function Dimension({ group, color }: { group: SceneGroup; color: string }) {
  const y = group.top + 0.005;
  const z = group.z + group.sizeZ / 2 + 0.22;
  const left = group.x - group.sizeX / 2;
  const right = group.x + group.sizeX / 2;
  const tick = 0.08;
  return (
    <group>
      <Line points={[[left, y, z], [right, y, z]]} color={color} lineWidth={1} transparent opacity={0.8} />
      <Line points={[[left, y, z - tick], [left, y, z + tick]]} color={color} lineWidth={1} />
      <Line points={[[right, y, z - tick], [right, y, z + tick]]} color={color} lineWidth={1} />
      <Text font={FONT_REGULAR} fontSize={0.09} color={color} position={[group.x, y, z + 0.12]} rotation={[-Math.PI / 2, 0, 0]} anchorX="center" anchorY="middle">
        {`${Math.round(group.sizeX * 100)} px`}
      </Text>
    </group>
  );
}

const Platform = memo(function Platform({ group, titleAt }: { group: SceneGroup; titleAt: [number, number, number] }) {
  const { theme, materials, highlight, shadows, labelSize } = useScene();
  const emphasis = highlight.group(group.id);
  const dim = DIM_AMOUNT[emphasis];
  const treatment = theme.platform.treatment;
  const surface = theme.platform.colors[group.depth % theme.platform.colors.length] ?? theme.platform.colors[0] ?? '#cccccc';
  const accent = accentColor(theme, group.accent);
  const color = dimColor(surface, theme.background, dim);
  const edge = dimColor(emphasis === 'selected' ? theme.selection : theme.platform.edge, theme.background, dim);
  const thickness = group.top - group.bottom;
  const opacity = treatment === 'glass' ? theme.platform.opacity : treatment === 'outline' ? theme.platform.opacity : 1;
  const finish = 'platform' as const;
  const titleColor = dimColor(theme.platform.title, theme.background, dim);
  const minZ = group.z - group.sizeZ / 2;
  const showEdges = treatment !== 'slab' && treatment !== 'island';

  return (
    <group name={`group-${group.id}`} userData={{ strataGroupId: group.id }}>
      <mesh
        geometry={unitGeometry(treatment === 'slab' || treatment === 'island' ? 'rounded' : 'box')}
        material={treatment === 'outline' ? materials.flat(color, opacity) : materials.surface(color, opacity, finish)}
        position={[group.x, group.bottom + thickness / 2, group.z]}
        scale={[group.sizeX, thickness, group.sizeZ]}
        receiveShadow={shadows && treatment !== 'glass'}
        onClick={(event) => selectGroup(event, group.id)}
      >
        {showEdges || emphasis === 'selected' ? <Edges threshold={15} color={edge} transparent opacity={theme.platform.edgeOpacity} /> : null}
      </mesh>
      {treatment === 'island' && group.depth === 0 ? (
        // Tapered underside makes top-level groups read as floating islands.
        <mesh
          geometry={unitGeometry('frustum')}
          material={materials.surface(dimColor(theme.platform.edge, theme.background, dim), 1, finish)}
          position={[group.x, group.bottom - 0.22, group.z]}
          scale={[group.sizeX * 0.98, 0.44, group.sizeZ * 0.98]}
        />
      ) : null}
      {treatment === 'slab' || treatment === 'deck' || treatment === 'island' ? (
        // Domain accent stripe along the title edge.
        <mesh geometry={unitGeometry('box')} material={materials.flat(dimColor(accent, theme.background, dim))} position={[group.x, group.top + 0.002, minZ + 0.03]} scale={[group.sizeX - 0.16, 0.004, 0.06]} />
      ) : null}
      <Billboard position={titleAt}>
        <Text
          font={FONT_BOLD}
          fontSize={titleSize(labelSize, group)}
          letterSpacing={0.04}
          color={titleColor}
          anchorX="left"
          anchorY="middle"
          outlineWidth={labelSize * 0.16}
          outlineColor={theme.background}
          renderOrder={12}
          material={LABEL_MATERIAL}
          onClick={(event) => selectGroup(event, group.id)}
        >
          {group.label.toUpperCase()}
        </Text>
      </Billboard>
      {theme.platform.dimensions && group.depth === 0 ? <Dimension group={group} color={theme.platform.edge} /> : null}
    </group>
  );
});

const titleSize = (labelSize: number, group: SceneGroup) => Math.min(0.5, labelSize * (group.depth === 0 ? 1.05 : 0.95));

export function ScenePlatforms() {
  const { model, theme, labelSize } = useScene();
  const titles = useMemo(
    () => placeGroupTitles(model.groups, model.nodes, viewDirection(theme.camera.azimuthDeg, theme.camera.elevationDeg), labelSize, (group) => titleSize(labelSize, group)),
    [model.groups, model.nodes, theme.camera.azimuthDeg, theme.camera.elevationDeg, labelSize],
  );
  return (
    <group name="platforms">
      {model.groups.map((group) => (
        <Platform key={group.id} group={group} titleAt={titles.get(group.id)?.position ?? [group.x - group.sizeX / 2 + 0.28, group.top + 0.02, group.z - group.sizeZ / 2 + 0.3]} />
      ))}
    </group>
  );
}
