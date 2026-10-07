/**
 * Lazy-loaded 3D view. One Canvas, demand rendering, limited DPR, automatic
 * quality degradation and a 2D fallback when WebGL is missing, fails or the
 * context is lost. The document is never touched by any of these states.
 */
import { PerformanceMonitor } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Component, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ACESFilmicToneMapping, PCFShadowMap } from 'three';
import { useReducedMotion } from '../../components/ui/useReducedMotion';
import { type Quality, usePreferences } from '../../state/preferencesStore';
import { useUiStore } from '../../state/uiStore';
import { Scene } from './Scene';
import { SCENE_DESCRIPTION_ID, ViewerOverlay } from './ViewerOverlay';
import { WebglFallback } from './WebglFallback';

const DPR: Record<Quality, [number, number]> = { low: [1, 1], medium: [1, 1.5], high: [1, 2] };
const DOWNGRADE: Record<Quality, Quality | null> = { high: 'medium', medium: 'low', low: null };

export function detectWebgl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

class CanvasBoundary extends Component<{ children: ReactNode; onError: (error: Error) => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function Viewer3D() {
  const quality = usePreferences((state) => state.quality);
  const setQuality = usePreferences((state) => state.setQuality);
  const webgl = useUiStore((state) => state.webgl);
  const setWebgl = useUiStore((state) => state.setWebgl);
  const reducedMotion = useReducedMotion();
  const [attempt, setAttempt] = useState(0);
  const [stats, setStats] = useState({ nodes: 0, edges: 0, groups: 0 });
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!detectWebgl()) setWebgl('unsupported', 'Este navegador no ofrece WebGL.');
    else setWebgl('ok');
  }, [setWebgl, attempt]);

  const onError = useCallback((error: Error) => setWebgl('error', error.message), [setWebgl]);
  const onStats = useCallback((next: typeof stats) => setStats(next), []);

  if (webgl === 'unsupported' || webgl === 'error' || webgl === 'lost') {
    return <WebglFallback onRetry={webgl === 'unsupported' ? null : () => setAttempt((value) => value + 1)} />;
  }

  return (
    <div
      className="viewer3d"
      ref={container}
      data-rendered-nodes={stats.nodes}
      data-rendered-edges={stats.edges}
      data-rendered-groups={stats.groups}
    >
      <CanvasBoundary key={attempt} onError={onError}>
        <Canvas
          frameloop="demand"
          dpr={DPR[quality]}
          shadows={quality === 'low' ? false : { type: PCFShadowMap }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
          onCreated={({ gl }) => {
            gl.toneMapping = ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.0;
            gl.domElement.setAttribute('aria-label', 'Escena 3D del diagrama');
            gl.domElement.setAttribute('role', 'img');
            gl.domElement.setAttribute('aria-describedby', SCENE_DESCRIPTION_ID);
            gl.domElement.addEventListener('webglcontextlost', (event) => {
              event.preventDefault();
              setWebgl('lost', 'Se perdió el contexto WebGL.');
            });
          }}
          onPointerMissed={(event) => {
            if (event.type === 'click') useUiStore.getState().clearSelection();
          }}
        >
          <PerformanceMonitor
            onDecline={() => {
              const next = DOWNGRADE[usePreferences.getState().quality];
              if (!next) return;
              setQuality(next, true);
              useUiStore.getState().notify('info', `Calidad 3D reducida a «${next}» para mantener la fluidez.`);
            }}
          />
          <Scene quality={quality} reducedMotion={reducedMotion} onStats={onStats} />
        </Canvas>
      </CanvasBoundary>
      <ViewerOverlay />
    </div>
  );
}
