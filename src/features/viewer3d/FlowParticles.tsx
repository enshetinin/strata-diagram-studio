/**
 * Illustrative flow markers along the selected / narrated relations.
 * They do not represent real traffic. Animated through refs only (no React
 * state per frame); static when the user prefers reduced motion or pauses
 * them from the viewer (WCAG 2.2.2).
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { type CurvePath, type InstancedMesh, Object3D, SphereGeometry, type Vector3 } from 'three';
import { useUiStore } from '../../state/uiStore';
import { buildCurve } from './SceneConnectors';
import { useScene } from './sceneContext';

const PER_EDGE = 3;
const SPEED = 0.35; // fraction of the path per second
const temp = new Object3D();

export function FlowParticles() {
  const { model, highlight, theme, materials, reducedMotion } = useScene();
  const paused = useUiStore((state) => state.particlesPaused);
  const still = reducedMotion || paused;
  const invalidate = useThree((state) => state.invalidate);
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new SphereGeometry(0.045, 12, 8), []);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  const curves = useMemo(() => {
    const active = new Set(highlight.activeEdges);
    return model.edges
      .filter((edge) => active.has(edge.id))
      .map((edge) => buildCurve(edge.points)) as CurvePath<Vector3>[];
  }, [model.edges, highlight.activeEdges]);
  const count = curves.length * PER_EDGE;

  const place = (time: number) => {
    const mesh = ref.current;
    if (!mesh) return;
    curves.forEach((curve, curveIndex) => {
      for (let i = 0; i < PER_EDGE; i += 1) {
        const t = still ? (i + 1) / (PER_EDGE + 1) : (time * SPEED + i / PER_EDGE) % 1;
        temp.position.copy(curve.getPointAt(t));
        temp.updateMatrix();
        mesh.setMatrixAt(curveIndex * PER_EDGE + i, temp.matrix);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-place particles only when curves or motion preference change.
  useLayoutEffect(() => {
    place(0);
    invalidate();
  }, [curves, still]);

  useFrame((state) => {
    if (still || count === 0) return;
    place(state.clock.elapsedTime);
    invalidate();
  });

  if (count === 0) return null;
  return (
    <instancedMesh
      key={count}
      ref={ref}
      args={[geometry, materials.flat(theme.particles), count]}
      frustumCulled={false}
      renderOrder={15}
      userData={{ illustrative: true }}
    />
  );
}
