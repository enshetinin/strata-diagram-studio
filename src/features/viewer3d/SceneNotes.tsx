/**
 * Notes in 3D: a thin card laid on the highest platform beneath it, with a
 * ruled top edge, the text standing above it (WebGL text, so it reaches PNG
 * exports) and a dashed leader to the node it points at. Notes are never dimmed: they explain the
 * scene rather than belong to it.
 */
import { Billboard, Line, Text } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { memo } from 'react';
import { isSelected, useUiStore } from '../../state/uiStore';
import { NOTE_CARD_HEIGHT, type SceneAnnotation } from '../layout/sceneModel';
import { unitGeometry } from './nodeShapes';
import { FONT_BOLD, FONT_REGULAR, LABEL_MATERIAL, useScene } from './sceneContext';

const NOTE_RENDER_ORDER = 21;

function selectNote(event: ThreeEvent<MouseEvent>, id: string) {
  event.stopPropagation();
  const ui = useUiStore.getState();
  if (event.shiftKey || event.metaKey || event.ctrlKey) ui.toggleSelect({ type: 'annotation', id });
  else ui.select([{ type: 'annotation', id }]);
}

const NoteCard = memo(function NoteCard({ note, selected }: { note: SceneAnnotation; selected: boolean }) {
  const { theme, materials, labelSize: size } = useScene();
  const ink = selected ? theme.selection : theme.label.color;
  const minZ = note.z - note.sizeZ / 2;
  return (
    <group userData={{ strataAnnotationId: note.id }}>
      <mesh
        geometry={unitGeometry('box')}
        material={materials.flat(theme.platform.colors[0] ?? theme.background, 0.9)}
        position={[note.x, note.bottom + NOTE_CARD_HEIGHT / 2, note.z]}
        scale={[note.sizeX, NOTE_CARD_HEIGHT, note.sizeZ]}
        onClick={(event) => selectNote(event, note.id)}
      />
      <Line
        points={[
          [note.x - note.sizeX / 2, note.top + 0.002, minZ],
          [note.x + note.sizeX / 2, note.top + 0.002, minZ],
        ]}
        color={ink}
        lineWidth={selected ? 2 : 1}
      />
      {note.leader ? (
        <Line
          points={note.leader.map((point) => [point.x, point.y, point.z] as [number, number, number])}
          color={selected ? theme.selection : theme.label.muted}
          lineWidth={1}
          dashed
          dashSize={0.06}
          gapSize={0.05}
        />
      ) : null}
      <Billboard position={[note.x, note.top + 0.06, note.z]}>
        <Text
          font={FONT_REGULAR}
          fontSize={size * 0.78}
          color={ink}
          outlineWidth={size * 0.12}
          outlineColor={theme.label.outline}
          anchorX="center"
          anchorY="bottom"
          maxWidth={Math.max(1.2, note.sizeX * 1.1)}
          textAlign="left"
          lineHeight={1.2}
          renderOrder={NOTE_RENDER_ORDER}
          material={LABEL_MATERIAL}
          onClick={(event) => selectNote(event, note.id)}
        >
          {note.text}
        </Text>
        <Text
          font={FONT_BOLD}
          fontSize={size * 0.5}
          color={theme.label.muted}
          outlineWidth={size * 0.08}
          outlineColor={theme.label.outline}
          anchorX="center"
          anchorY="top"
          letterSpacing={0.08}
          renderOrder={NOTE_RENDER_ORDER}
          material={LABEL_MATERIAL}
          position={[0, -size * 0.1, 0]}
        >
          NOTA
        </Text>
      </Billboard>
    </group>
  );
});

export function SceneNotes() {
  const { model } = useScene();
  const selection = useUiStore((state) => state.selection);
  return (
    <>
      {model.annotations.map((note) => (
        <NoteCard key={note.id} note={note} selected={isSelected(selection, { type: 'annotation', id: note.id })} />
      ))}
    </>
  );
}
