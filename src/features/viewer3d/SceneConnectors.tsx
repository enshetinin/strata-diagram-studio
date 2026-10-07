import { Line } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Color,
  ConeGeometry,
  CurvePath,
  type InstancedMesh,
  LineCurve3,
  Matrix4,
  Object3D,
  QuadraticBezierCurve3,
  TubeGeometry,
  Vector3,
} from 'three';
import { RELATION_INFO } from '../../domain/catalog';
import { useUiStore } from '../../state/uiStore';
import type { SceneEdge, Vec3 } from '../layout/sceneModel';
import { dimColor } from './materials';
import { DIM_AMOUNT, useScene } from './sceneContext';
import { connectorColor } from './themes';

const ARROW_LENGTH = 0.16;

const toVector = (point: Vec3) => new Vector3(point.x, point.y, point.z);

/** Polyline with softly rounded corners; arcs already come densely sampled. */
export function buildCurve(points: Vec3[], radius = 0.08): CurvePath<Vector3> {
  const path = new CurvePath<Vector3>();
  const vectors = points.map(toVector);
  if (vectors.length < 2) return path;
  let cursor = vectors[0]!.clone();
  for (let index = 1; index < vectors.length - 1; index += 1) {
    const corner = vectors[index]!;
    const next = vectors[index + 1]!;
    const inLength = corner.distanceTo(cursor);
    const outLength = corner.distanceTo(next);
    const r = Math.min(radius, inLength / 2, outLength / 2);
    const before = corner.clone().add(cursor.clone().sub(corner).setLength(r));
    const after = corner.clone().add(next.clone().sub(corner).setLength(r));
    if (r > 1e-4) {
      path.add(new LineCurve3(cursor, before));
      path.add(new QuadraticBezierCurve3(before, corner, after));
      cursor = after;
    } else {
      path.add(new LineCurve3(cursor, corner));
      cursor = corner.clone();
    }
  }
  path.add(new LineCurve3(cursor, vectors[vectors.length - 1]!));
  return path;
}

/** Shortens the last (and optionally first) segment so the arrowhead sits on the port. */
function trimForArrows(points: Vec3[], start: boolean): Vec3[] {
  const result = points.map((point) => ({ ...point }));
  const trim = (from: Vec3, to: Vec3) => {
    const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    const t = Math.max(0, (length - ARROW_LENGTH * 0.9) / length);
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t };
  };
  const n = result.length;
  if (n >= 2) result[n - 1] = trim(result[n - 2]!, result[n - 1]!);
  if (start && n >= 2) result[0] = trim(result[1]!, result[0]!);
  return result;
}

function selectEdge(event: ThreeEvent<MouseEvent>, id: string) {
  event.stopPropagation();
  useUiStore.getState().select([{ type: 'edge', id }]);
}

function edgeColor(edge: SceneEdge, emphasis: keyof typeof DIM_AMOUNT, theme: ReturnType<typeof useScene>['theme']) {
  const base = emphasis === 'selected' ? theme.selection : connectorColor(theme, edge.relation);
  return dimColor(base, theme.background, DIM_AMOUNT[emphasis]);
}

const Connector = memo(function Connector({ edge }: { edge: SceneEdge }) {
  const { theme, materials, highlight } = useScene();
  const emphasis = highlight.edge(edge.id);
  const color = edgeColor(edge, emphasis, theme);
  const dashed = RELATION_INFO[edge.relation].dashed;
  const trimmed = useMemo(() => trimForArrows(edge.points, edge.bidirectional), [edge]);
  const curve = useMemo(() => buildCurve(trimmed), [trimmed]);
  const radius = theme.connector.radius * (emphasis === 'selected' ? 1.6 : 1);
  const tube = useMemo(
    () =>
      theme.connector.render === 'tube' && !dashed
        ? new TubeGeometry(curve, Math.max(24, trimmed.length * 10), radius, 6, false)
        : null,
    [curve, dashed, radius, theme.connector.render, trimmed.length],
  );
  useLayoutEffect(() => () => tube?.dispose(), [tube]);
  const linePoints = useMemo(
    () => (tube ? null : curve.getSpacedPoints(Math.max(16, trimmed.length * 8))),
    [curve, tube, trimmed.length],
  );

  if (tube) {
    return (
      <mesh
        geometry={tube}
        material={materials.tube(color, theme.connector.opacity)}
        onClick={(event) => selectEdge(event, edge.id)}
        userData={{ strataEdgeId: edge.id }}
      />
    );
  }
  return (
    <Line
      points={linePoints ?? []}
      color={color}
      lineWidth={emphasis === 'selected' ? 3 : theme.connector.render === 'line' ? 1.6 : 2.2}
      dashed={dashed}
      dashSize={0.09}
      gapSize={0.06}
      onClick={(event) => selectEdge(event, edge.id)}
      userData={{ strataEdgeId: edge.id }}
    />
  );
});

const temp = new Object3D();
const forward = new Vector3();
const UP = new Vector3(0, 1, 0);

/** All arrowheads in a single instanced mesh. */
function Arrowheads() {
  const { model, theme, materials, highlight } = useScene();
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => {
    const cone =
      theme.connector.arrow === 'chevron'
        ? new ConeGeometry(0.065, ARROW_LENGTH, 3)
        : new ConeGeometry(0.06, ARROW_LENGTH, 16);
    if (theme.connector.arrow === 'chevron') cone.scale(1.3, 1, 0.45);
    return cone;
  }, [theme.connector.arrow]);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  // Neutral base: each arrow's palette colour comes from its instance colour.
  const material = materials.flat('#ffffff');

  const arrows = useMemo(() => {
    const list: { tip: Vec3; from: Vec3; edge: SceneEdge }[] = [];
    for (const edge of model.edges) {
      const n = edge.points.length;
      if (n < 2) continue;
      list.push({ tip: edge.points[n - 1]!, from: edge.points[n - 2]!, edge });
      if (edge.bidirectional) list.push({ tip: edge.points[0]!, from: edge.points[1]!, edge });
    }
    return list;
  }, [model.edges]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const color = new Color();
    arrows.forEach(({ tip, from, edge }, index) => {
      forward.set(tip.x - from.x, tip.y - from.y, tip.z - from.z).normalize();
      temp.position.set(
        tip.x - forward.x * ARROW_LENGTH * 0.5,
        tip.y - forward.y * ARROW_LENGTH * 0.5,
        tip.z - forward.z * ARROW_LENGTH * 0.5,
      );
      temp.quaternion.setFromUnitVectors(UP, forward);
      if (theme.connector.arrow === 'chevron') {
        // Keep the flat chevron lying parallel to the ground when possible.
        const side = new Vector3().crossVectors(forward, UP);
        if (side.lengthSq() > 1e-6) {
          const m = new Matrix4().makeBasis(
            side.normalize(),
            forward,
            new Vector3().crossVectors(side, forward).normalize(),
          );
          temp.quaternion.setFromRotationMatrix(m);
        }
      }
      temp.updateMatrix();
      mesh.setMatrixAt(index, temp.matrix);
      const emphasis = highlight.edge(edge.id);
      const base =
        emphasis === 'selected'
          ? theme.selection
          : (theme.connector.arrowColor ?? connectorColor(theme, edge.relation));
      mesh.setColorAt(index, color.set(dimColor(base, theme.background, DIM_AMOUNT[emphasis])));
    });
    mesh.count = arrows.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [arrows, highlight, theme]);

  if (arrows.length === 0) return null;
  return (
    <instancedMesh key={arrows.length} ref={ref} args={[geometry, material, arrows.length]} frustumCulled={false} />
  );
}

/** Small studs at every used port, instanced. */
function PortStuds() {
  const { model, theme, materials } = useScene();
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new ConeGeometry(0.035, 0.035, 12).rotateX(Math.PI), []);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    model.ports.forEach((port, index) => {
      temp.position.set(port.position.x, port.position.y, port.position.z);
      temp.quaternion.identity();
      temp.scale.setScalar(1.6);
      temp.updateMatrix();
      mesh.setMatrixAt(index, temp.matrix);
    });
    temp.scale.setScalar(1);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [model.ports]);
  if (model.ports.length === 0) return null;
  return (
    <instancedMesh
      key={model.ports.length}
      ref={ref}
      args={[geometry, materials.flat(theme.connector.colors.default, 0.9), model.ports.length]}
      frustumCulled={false}
    />
  );
}

export function SceneConnectors() {
  const { model } = useScene();
  return (
    <group name="connectors">
      {model.edges.map((edge) => (
        <Connector key={edge.id} edge={edge} />
      ))}
      <Arrowheads />
      <PortStuds />
    </group>
  );
}
