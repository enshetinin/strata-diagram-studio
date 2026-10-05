/**
 * Isometric orthographic camera by default, moderate perspective on request.
 * Orbit is limited around the preset angle; framing never touches the
 * document and camera moves are not recorded in history.
 */
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, type ComponentRef } from 'react';
import { OrthographicCamera as ThreeOrtho, PerspectiveCamera as ThreePerspective, Vector3 } from 'three';
import { useUiStore } from '../../state/uiStore';
import { computeDefaultView, viewDirection } from './cameraFit';
import { useScene } from './sceneContext';

interface Tween {
  fromTarget: Vector3;
  toTarget: Vector3;
  fromPosition: Vector3;
  toPosition: Vector3;
  fromZoom: number;
  toZoom: number;
  start: number;
  duration: number;
}

const ease = (t: number) => 1 - (1 - t) ** 3;

export function CameraRig({ projection }: { projection: 'orthographic' | 'perspective' }) {
  const { theme, model, reducedMotion } = useScene();
  const size = useThree((state) => state.size);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const tween = useRef<Tween | null>(null);
  const userMoved = useRef(false);
  const resetNonce = useUiStore((state) => state.cameraResetNonce);
  const focusRequest = useUiStore((state) => state.focusRequest);
  const presenting = useUiStore((state) => state.presenting);

  const direction = useMemo(() => viewDirection(theme.camera.azimuthDeg, theme.camera.elevationDeg), [theme.camera.azimuthDeg, theme.camera.elevationDeg]);
  const fit = useMemo(
    () => computeDefaultView(model, direction, projection, theme.camera.fov, size, presenting),
    // Refit only on explicit triggers, not on every model edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projection, direction, size.width, size.height, presenting, resetNonce, theme.camera.fov],
  );

  const frameAll = useCallback(
    (animate: boolean) => {
      const to = { target: fit.center.clone(), position: fit.center.clone().addScaledVector(direction, fit.distance), zoom: fit.zoom };
      if (!animate || reducedMotion) {
        camera.position.copy(to.position);
        if (camera instanceof ThreeOrtho) camera.zoom = to.zoom;
        camera.lookAt(to.target);
        camera.updateProjectionMatrix();
        controls.current?.target.copy(to.target);
        controls.current?.update();
        invalidate();
        return;
      }
      tween.current = {
        fromTarget: controls.current?.target.clone() ?? to.target,
        toTarget: to.target,
        fromPosition: camera.position.clone(),
        toPosition: to.position,
        fromZoom: camera.zoom,
        toZoom: to.zoom,
        start: performance.now(),
        duration: 450,
      };
      invalidate();
    },
    [camera, direction, fit, invalidate, reducedMotion],
  );

  // Initial framing and explicit resets.
  useEffect(() => {
    userMoved.current = false;
    frameAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetNonce, projection, presenting, direction]);

  // Keep framing on resize unless the user has navigated.
  useEffect(() => {
    if (!userMoved.current) frameAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  // Focus a node or group requested from the inspector, outline or double click.
  useEffect(() => {
    if (!focusRequest) return;
    const { ref } = focusRequest;
    const element = ref.type === 'node' ? model.nodes.find((node) => node.id === ref.id) : ref.type === 'group' ? model.groups.find((group) => group.id === ref.id) : null;
    if (!element) return;
    const target = new Vector3(element.x, element.top, element.z);
    const span = Math.max(element.sizeX, element.sizeZ, 1.5);
    const toZoom = camera instanceof ThreeOrtho ? Math.min(fit.zoom * 4, Math.max(fit.zoom, size.height / (span * 2.6))) : 1;
    const offset = camera.position.clone().sub(controls.current?.target ?? fit.center);
    const distance = camera instanceof ThreePerspective ? Math.max(span * 2.4, 4) : offset.length();
    const toPosition = target.clone().addScaledVector(offset.normalize(), distance);
    userMoved.current = true;
    if (reducedMotion) {
      camera.position.copy(toPosition);
      camera.zoom = toZoom;
      camera.updateProjectionMatrix();
      controls.current?.target.copy(target);
      controls.current?.update();
      invalidate();
      return;
    }
    tween.current = {
      fromTarget: controls.current?.target.clone() ?? fit.center.clone(),
      toTarget: target,
      fromPosition: camera.position.clone(),
      toPosition,
      fromZoom: camera.zoom,
      toZoom,
      start: performance.now(),
      duration: 500,
    };
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  useFrame(() => {
    const active = tween.current;
    if (!active) return;
    const t = Math.min(1, (performance.now() - active.start) / active.duration);
    const k = ease(t);
    camera.position.lerpVectors(active.fromPosition, active.toPosition, k);
    camera.zoom = active.fromZoom + (active.toZoom - active.fromZoom) * k;
    camera.updateProjectionMatrix();
    controls.current?.target.lerpVectors(active.fromTarget, active.toTarget, k);
    controls.current?.update();
    if (t < 1) invalidate();
    else tween.current = null;
  });

  const az = (theme.camera.azimuthDeg * Math.PI) / 180;
  const polar = Math.PI / 2 - (theme.camera.elevationDeg * Math.PI) / 180;
  const initialPosition = fit.center.clone().addScaledVector(direction, fit.distance).toArray();

  return (
    <>
      {projection === 'orthographic' ? (
        <OrthographicCamera key="ortho" makeDefault position={initialPosition} zoom={fit.zoom} near={0.1} far={400} />
      ) : (
        <PerspectiveCamera key="persp" makeDefault position={initialPosition} fov={theme.camera.fov} near={0.1} far={400} />
      )}
      <OrbitControls
        key={projection}
        ref={controls}
        makeDefault
        target={fit.center}
        enableDamping={false}
        screenSpacePanning
        minAzimuthAngle={az - Math.PI / 3}
        maxAzimuthAngle={az + Math.PI / 3}
        minPolarAngle={Math.max(0.35, polar - 0.45)}
        maxPolarAngle={Math.min(1.35, polar + 0.35)}
        minZoom={fit.zoom * 0.35}
        maxZoom={fit.zoom * 6}
        minDistance={fit.distance * 0.2}
        maxDistance={fit.distance * 2.5}
        onStart={() => {
          userMoved.current = true;
          tween.current = null;
        }}
      />
    </>
  );
}
