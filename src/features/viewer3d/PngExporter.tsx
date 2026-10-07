/**
 * Dedicated off-screen render for PNG export: its own renderer and camera at
 * the requested size (the scene area of the composed image), fonts awaited,
 * everything disposed afterwards. The live canvas keeps
 * `preserveDrawingBuffer: false`, its camera and its size.
 */
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Color, type Material, Vector2, WebGLRenderer } from 'three';
import { type PngExportOptions, registerPngExporter } from '../export/pngRegistry';
import { exportCamera, viewDirection } from './cameraFit';
import { preloadLabelFonts, useScene } from './sceneContext';

interface ResolutionMaterial extends Material {
  resolution: Vector2;
}

function hasResolution(material: Material): material is ResolutionMaterial {
  return 'resolution' in material && (material as Partial<ResolutionMaterial>).resolution instanceof Vector2;
}

export function PngExporter({ projection }: { projection: 'orthographic' | 'perspective' }) {
  const { theme, model } = useScene();
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const exporter = async ({ width, height, transparent, scale }: PngExportOptions): Promise<HTMLCanvasElement> => {
      await Promise.all([preloadLabelFonts(), document.fonts?.ready]);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      const previousBackground = scene.background;
      const lineMaterials: { material: ResolutionMaterial; resolution: Vector2 }[] = [];
      try {
        renderer.setPixelRatio(1);
        renderer.setSize(width, height, false);
        renderer.outputColorSpace = gl.outputColorSpace;
        renderer.toneMapping = gl.toneMapping;
        renderer.toneMappingExposure = gl.toneMappingExposure;
        renderer.shadowMap.enabled = gl.shadowMap.enabled;
        renderer.shadowMap.type = gl.shadowMap.type;
        if (transparent) {
          scene.background = null;
          renderer.setClearColor(0x000000, 0);
        } else {
          renderer.setClearColor(new Color(theme.background), 1);
        }
        // Fat lines measure width in pixels: adapt them to the export size.
        scene.traverse((object) => {
          const material = (object as { material?: Material | Material[] }).material;
          for (const item of Array.isArray(material) ? material : material ? [material] : []) {
            if (hasResolution(item)) {
              lineMaterials.push({ material: item, resolution: item.resolution.clone() });
              item.resolution.set(width / scale, height / scale);
            }
          }
        });
        const camera = exportCamera(
          model,
          projection,
          viewDirection(theme.camera.azimuthDeg, theme.camera.elevationDeg),
          theme.camera.fov,
          width / height,
        );
        renderer.render(scene, camera);
        // Copy the frame before the WebGL context is released.
        const frame = document.createElement('canvas');
        frame.width = width;
        frame.height = height;
        const context = frame.getContext('2d');
        if (!context) throw new Error('El navegador no permite componer la imagen.');
        context.drawImage(canvas, 0, 0);
        return frame;
      } finally {
        scene.background = previousBackground;
        lineMaterials.forEach(({ material, resolution }) => material.resolution.copy(resolution));
        renderer.dispose();
        renderer.forceContextLoss();
        invalidate();
      }
    };
    registerPngExporter(exporter);
    return () => registerPngExporter(null);
  }, [gl, scene, invalidate, model, projection, theme]);

  return null;
}
