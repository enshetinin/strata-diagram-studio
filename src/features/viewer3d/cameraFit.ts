/**
 * Camera framing math shared by the live view and the PNG exporter.
 * Framing uses the corners of every platform and block (not the global
 * bounding box), so long diagonal layouts fill the frame in isometric view.
 */
import { Box3, Matrix4, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import type { SceneModel, WorldBox } from '../layout/sceneModel';

export function viewDirection(azimuthDeg: number, elevationDeg: number): Vector3 {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  return new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
}

export function sceneBox(model: SceneModel): Box3 {
  const { min, max } = model.bounds;
  return new Box3(new Vector3(min.x, min.y - 0.3, min.z), new Vector3(max.x, max.y + 0.4, max.z));
}

function boxCorners(box: WorldBox, labelHeight: number): Vector3[] {
  const corners: Vector3[] = [];
  for (const dx of [-0.5, 0.5]) {
    for (const dz of [-0.5, 0.5]) {
      for (const y of [box.bottom - 0.1, box.top + labelHeight]) corners.push(new Vector3(box.x + dx * box.sizeX, y, box.z + dz * box.sizeZ));
    }
  }
  return corners;
}

function scenePoints(model: SceneModel): Vector3[] {
  const points = [...model.groups.flatMap((group) => boxCorners(group, 0.1)), ...model.nodes.flatMap((node) => boxCorners(node, 0.45))];
  for (const edge of model.edges) for (const point of edge.points) points.push(new Vector3(point.x, point.y, point.z));
  if (points.length === 0) {
    const box = sceneBox(model);
    points.push(box.min.clone(), box.max.clone());
  }
  return points;
}

export interface Framing {
  /** World point at the centre of the projected content. */
  center: Vector3;
  /** Projected content size in world units, as seen from `direction`. */
  width: number;
  height: number;
}

export function frameScene(model: SceneModel, direction: Vector3): Framing {
  const box = sceneBox(model);
  const pivot = box.getCenter(new Vector3());
  const probe = new OrthographicCamera();
  probe.position.copy(pivot).addScaledVector(direction, 50);
  probe.lookAt(pivot);
  probe.updateMatrixWorld();
  const toCamera = probe.matrixWorldInverse;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let depth = 0;
  const points = scenePoints(model);
  for (const point of points) {
    const local = point.clone().applyMatrix4(toCamera);
    minX = Math.min(minX, local.x);
    maxX = Math.max(maxX, local.x);
    minY = Math.min(minY, local.y);
    maxY = Math.max(maxY, local.y);
    depth += local.z;
  }
  const centerLocal = new Vector3((minX + maxX) / 2, (minY + maxY) / 2, depth / points.length);
  const center = centerLocal.applyMatrix4(new Matrix4().copy(probe.matrixWorld));
  return { center, width: maxX - minX, height: maxY - minY };
}

/** Zoom for an R3F orthographic camera whose frustum is the viewport in pixels. */
export function fitOrthoZoom(framing: Framing, viewport: { width: number; height: number }, margin = 1.1): number {
  return Math.min(viewport.width / (framing.width * margin), viewport.height / (framing.height * margin));
}

export function fitPerspectiveDistance(framing: Framing, fovDeg: number, aspect: number, margin = 1.08): number {
  const vfov = (fovDeg * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const forHeight = (framing.height * margin) / 2 / Math.tan(vfov / 2);
  const forWidth = (framing.width * margin) / 2 / Math.tan(hfov / 2);
  // Extra distance compensates for the near half of the scene being closer.
  return Math.max(forHeight, forWidth) * 1.06;
}

/** Stand-alone camera for an off-screen render at a given aspect ratio. */
export function exportCamera(model: SceneModel, projection: 'orthographic' | 'perspective', direction: Vector3, fov: number, aspect: number) {
  const framing = frameScene(model, direction);
  if (projection === 'orthographic') {
    const margin = 1.06;
    let halfW = (framing.width * margin) / 2;
    let halfH = (framing.height * margin) / 2;
    if (halfW / halfH > aspect) halfH = halfW / aspect;
    else halfW = halfH * aspect;
    const camera = new OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 400);
    camera.position.copy(framing.center).addScaledVector(direction, 60);
    camera.lookAt(framing.center);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    return camera;
  }
  const camera = new PerspectiveCamera(fov, aspect, 0.1, 400);
  camera.position.copy(framing.center).addScaledVector(direction, fitPerspectiveDistance(framing, fov, aspect));
  camera.lookAt(framing.center);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}

export interface DefaultView {
  center: Vector3;
  zoom: number;
  distance: number;
  /** World units covered by one CSS pixel at the default framing. */
  worldPerPixel: number;
}

/**
 * Default framing for the live canvas: fits the content inside the area not
 * covered by the title (top) and legend / captions (bottom). `measured`
 * carries the overlay's real footprint; without it, typical values are used.
 */
export function computeDefaultView(
  model: SceneModel,
  direction: Vector3,
  projection: 'orthographic' | 'perspective',
  fov: number,
  size: { width: number; height: number },
  presenting: boolean,
  measured: { top: number; bottom: number } | null = null,
): DefaultView {
  const framing = frameScene(model, direction);
  const narrow = size.width < 700;
  const insets = presenting ? { top: 24, bottom: 170, left: 24, right: 24 } : narrow ? { top: 118, bottom: 70, left: 12, right: 12 } : { top: 200, bottom: 128, left: 32, right: 32 };
  if (measured && !presenting) {
    // Never let the overlay squeeze the scene below ~40% of the stage height.
    const room = Math.max(0, size.height * 0.6);
    const total = measured.top + measured.bottom;
    const k = total > room ? room / total : 1;
    insets.top = measured.top * k;
    insets.bottom = measured.bottom * k;
  }
  const usable = { width: Math.max(120, size.width - insets.left - insets.right), height: Math.max(120, size.height - insets.top - insets.bottom) };
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize();
  const up = new Vector3().crossVectors(direction, right).normalize();
  const shiftX = (insets.left - insets.right) / 2;
  const shiftY = (insets.top - insets.bottom) / 2;
  if (projection === 'orthographic') {
    const zoom = fitOrthoZoom(framing, usable, 1.04);
    const center = framing.center.clone().addScaledVector(right, -shiftX / zoom).addScaledVector(up, shiftY / zoom);
    return { center, zoom, distance: 60, worldPerPixel: 1 / zoom };
  }
  const scaled = { ...framing, width: (framing.width * size.width) / usable.width, height: (framing.height * size.height) / usable.height };
  const distance = fitPerspectiveDistance(scaled, fov, size.width / Math.max(1, size.height));
  const worldPerPixel = (2 * distance * Math.tan((fov * Math.PI) / 360)) / Math.max(1, size.height);
  const center = framing.center.clone().addScaledVector(right, -shiftX * worldPerPixel).addScaledVector(up, shiftY * worldPerPixel);
  return { center, zoom: 1, distance, worldPerPixel };
}
