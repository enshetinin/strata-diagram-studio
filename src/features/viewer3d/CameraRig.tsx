/**
 * Isometric orthographic camera by default, moderate perspective on request.
 * Orbit is limited around the preset angle; framing never touches the
 * document and camera moves are not recorded in history.
 */
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { type ComponentRef, useCallback, useEffect, useMemo, useRef } from 'react';
import { Spherical, OrthographicCamera as ThreeOrtho, PerspectiveCamera as ThreePerspective, Vector3 } from 'three';
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

/** One button press: 15° around, 8° of tilt, ×1.25 zoom. */
const NUDGE_AZIMUTH = Math.PI / 12;
const NUDGE_POLAR = (8 * Math.PI) / 180;
const NUDGE_ZOOM = 1.25;
const MIN_ZOOM_FACTOR = 0.35;
const MAX_ZOOM_FACTOR = 6;
const MIN_DISTANCE_FACTOR = 0.2;
const MAX_DISTANCE_FACTOR = 2.5;

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
  const cameraNudge = useUiStore((state) => state.cameraNudge);
  const presenting = useUiStore((state) => state.presenting);
  const insets = useUiStore((state) => state.overlayInsets);

  const direction = useMemo(
    () => viewDirection(theme.camera.azimuthDeg, theme.camera.elevationDeg),
    [theme.camera.azimuthDeg, theme.camera.elevationDeg],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: refit only on explicit triggers, not on every model edit.
  const fit = useMemo(
    () => computeDefaultView(model, direction, projection, theme.camera.fov, size, presenting, insets),
    [
      projection,
      direction,
      size.width,
      size.height,
      presenting,
      resetNonce,
      theme.camera.fov,
      insets?.top,
      insets?.bottom,
    ],
  );

  const frameAll = useCallback(
    (animate: boolean) => {
      const to = {
        target: fit.center.clone(),
        position: fit.center.clone().addScaledVector(direction, fit.distance),
        zoom: fit.zoom,
      };
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: frameAll changes with every fit; only these triggers reframe.
  useEffect(() => {
    userMoved.current = false;
    frameAll(false);
  }, [resetNonce, projection, presenting, direction]);

  // Keep framing on resize (stage or overlay) unless the user has navigated.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reframe on resize only.
  useEffect(() => {
    if (!userMoved.current) frameAll(false);
  }, [size.width, size.height, insets?.top, insets?.bottom]);

  // Focus a node or group requested from the inspector, outline or double click.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once per focus request, reading the latest camera state.
  useEffect(() => {
    if (!focusRequest) return;
    const { ref } = focusRequest;
    const element =
      ref.type === 'node'
        ? model.nodes.find((node) => node.id === ref.id)
        : ref.type === 'group'
          ? model.groups.find((group) => group.id === ref.id)
          : ref.type === 'annotation'
            ? model.annotations.find((annotation) => annotation.id === ref.id)
            : null;
    if (!element) return;
    const target = new Vector3(element.x, element.top, element.z);
    const span = Math.max(element.sizeX, element.sizeZ, 1.5);
    const toZoom =
      camera instanceof ThreeOrtho ? Math.min(fit.zoom * 4, Math.max(fit.zoom, size.height / (span * 2.6))) : 1;
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
  }, [focusRequest]);

  // Rotate, tilt and zoom from buttons: the same limits as dragging, applied instantly.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once per nudge, reading the latest camera state.
  useEffect(() => {
    if (!cameraNudge) return;
    const target = controls.current?.target ?? fit.center;
    tween.current = null;
    userMoved.current = true;
    const { action } = cameraNudge;
    if (action === 'zoomIn' || action === 'zoomOut') {
      const factor = action === 'zoomIn' ? NUDGE_ZOOM : 1 / NUDGE_ZOOM;
      if (camera instanceof ThreeOrtho) {
        camera.zoom = Math.min(fit.zoom * MAX_ZOOM_FACTOR, Math.max(fit.zoom * MIN_ZOOM_FACTOR, camera.zoom * factor));
        camera.updateProjectionMatrix();
      } else {
        const offset = camera.position.clone().sub(target);
        const distance = Math.min(
          fit.distance * MAX_DISTANCE_FACTOR,
          Math.max(fit.distance * MIN_DISTANCE_FACTOR, offset.length() / factor),
        );
        camera.position.copy(target).addScaledVector(offset.normalize(), distance);
      }
    } else {
      const spherical = new Spherical().setFromVector3(camera.position.clone().sub(target));
      if (action === 'rotateLeft') spherical.theta -= NUDGE_AZIMUTH;
      if (action === 'rotateRight') spherical.theta += NUDGE_AZIMUTH;
      if (action === 'tiltUp') spherical.phi -= NUDGE_POLAR;
      if (action === 'tiltDown') spherical.phi += NUDGE_POLAR;
      camera.position.copy(target).add(new Vector3().setFromSpherical(spherical));
      camera.lookAt(target);
    }
    // OrbitControls clamps the angles to the same range the pointer can reach.
    controls.current?.update();
    invalidate();
  }, [cameraNudge]);

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
        <PerspectiveCamera
          key="persp"
          makeDefault
          position={initialPosition}
          fov={theme.camera.fov}
          near={0.1}
          far={400}
        />
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
        minZoom={fit.zoom * MIN_ZOOM_FACTOR}
        maxZoom={fit.zoom * MAX_ZOOM_FACTOR}
        minDistance={fit.distance * MIN_DISTANCE_FACTOR}
        maxDistance={fit.distance * MAX_DISTANCE_FACTOR}
        onStart={() => {
          userMoved.current = true;
          tween.current = null;
        }}
      />
    </>
  );
}
