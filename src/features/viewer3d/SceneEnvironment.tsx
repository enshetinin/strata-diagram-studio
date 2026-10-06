import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, PMREMGenerator, type WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useScene } from './sceneContext';

/** CPU rasterisers (no GPU): keep the lighter lighting path there. */
function isSoftwareRenderer(gl: WebGLRenderer): boolean {
  const context = gl.getContext();
  const info = context.getExtension('WEBGL_debug_renderer_info');
  const name = info ? String(context.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  return /swiftshader|llvmpipe|software/i.test(name);
}

/**
 * Image-based light from a procedural studio room (no downloads): gives glass
 * and lacquered parts real reflections and ceramics a soft gradient. Skipped
 * on low quality and on software renderers.
 */
function StudioEnvironment({ intensity }: { intensity: number }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = intensity;
    invalidate();
    return () => {
      scene.environment = null;
      target.dispose();
      room.dispose();
      generator.dispose();
    };
  }, [gl, scene, intensity, invalidate]);
  return null;
}

function DotGround({ color, y }: { color: string; y: number }) {
  const { model } = useScene();
  const geometry = useMemo(() => {
    const { min, max } = model.bounds;
    const step = 0.4;
    const positions: number[] = [];
    for (let x = Math.floor((min.x - 2) / step) * step; x <= max.x + 2; x += step) {
      for (let z = Math.floor((min.z - 2) / step) * step; z <= max.z + 2; z += step) positions.push(x, y, z);
    }
    const buffer = new BufferGeometry();
    buffer.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return buffer;
  }, [model.bounds, y]);
  return (
    <points geometry={geometry}>
      <pointsMaterial color={color} size={2} sizeAttenuation={false} />
    </points>
  );
}

export function SceneEnvironment() {
  const { theme, model, shadows, materials } = useScene();
  const gl = useThree((state) => state.gl);
  const software = useMemo(() => isSoftwareRenderer(gl), [gl]);
  const { min, max } = model.bounds;
  const width = max.x - min.x;
  const depth = max.z - min.z;
  const span = Math.max(width, depth) + 6;
  const cx = (min.x + max.x) / 2;
  const cz = (min.z + max.z) / 2;
  const key = theme.light.key;
  const shadowExtent = Math.max(width, depth) / 2 + 2;
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    gl.toneMappingExposure = theme.light.exposure;
    invalidate();
  }, [gl, theme.light.exposure, invalidate]);

  return (
    <>
      <color attach="background" args={[theme.background]} />
      {materials.quality !== 'low' && !software && theme.node.finish !== 'wire' ? <StudioEnvironment intensity={theme.dark ? 0.3 : 0.32} /> : null}
      <ambientLight color={theme.light.ambient.color} intensity={theme.light.ambient.intensity} />
      {theme.light.hemi ? <hemisphereLight args={[theme.light.hemi.sky, theme.light.hemi.ground, theme.light.hemi.intensity]} /> : null}
      <directionalLight
        color={key.color}
        intensity={key.intensity}
        position={[cx + key.position[0], key.position[1], cz + key.position[2]]}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-radius={5}
        shadow-normalBias={0.02}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
      >
        <object3D attach="target" position={[cx, 0, cz]} />
      </directionalLight>
      {theme.light.fill ? <directionalLight color={theme.light.fill.color} intensity={theme.light.fill.intensity} position={theme.light.fill.position} /> : null}
      {theme.ground.kind === 'shadow' && shadows ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.001, cz]} receiveShadow>
          <planeGeometry args={[span, span]} />
          <shadowMaterial opacity={theme.ground.opacity} transparent />
        </mesh>
      ) : null}
      {theme.ground.kind === 'grid' ? <gridHelper args={[Math.ceil(span), Math.ceil(span) * 2, theme.ground.color, theme.ground.color]} position={[cx, -0.01, cz]} /> : null}
      {theme.ground.kind === 'dots' ? <DotGround color={theme.ground.color} y={-0.01} /> : null}
    </>
  );
}
