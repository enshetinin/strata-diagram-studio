import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useDocumentStore } from '../../state/documentStore';
import type { Quality } from '../../state/preferencesStore';
import { useUiStore } from '../../state/uiStore';
import { buildSceneModel } from '../layout/sceneModel';
import { CameraRig } from './CameraRig';
import { computeDefaultView, viewDirection } from './cameraFit';
import { FlowParticles } from './FlowParticles';
import { computeHighlight } from './highlight';
import { MaterialLibrary } from './materials';
import { PngExporter } from './PngExporter';
import { SceneConnectors } from './SceneConnectors';
import { SceneContext, useScene, type SceneContextValue } from './sceneContext';
import { SceneEnvironment } from './SceneEnvironment';
import { SceneLabels } from './SceneLabels';
import { SceneNodes } from './SceneNodes';
import { SceneNotes } from './SceneNotes';
import { ScenePlatforms } from './ScenePlatforms';
import { THEMES } from './themes';

/** Publishes what the scene graph actually contains, for tests and assistive summaries. */
function SceneProbe({ onStats }: { onStats: (stats: { nodes: number; edges: number; groups: number }) => void }) {
  const scene = useThree((state) => state.scene);
  const { model } = useScene();
  useEffect(() => {
    let nodes = 0;
    let edges = 0;
    let groups = 0;
    scene.traverse((object) => {
      if (object.userData.strataNodeId) nodes += 1;
      if (object.userData.strataEdgeId) edges += 1;
      if (object.userData.strataGroupId) groups += 1;
    });
    onStats({ nodes, edges, groups });
  }, [scene, model, onStats]);
  return null;
}

export function Scene({ quality, reducedMotion, onStats }: { quality: Quality; reducedMotion: boolean; onStats: (stats: { nodes: number; edges: number; groups: number }) => void }) {
  const doc = useDocumentStore((state) => state.doc);
  const selection = useUiStore((state) => state.selection);
  const isolated = useUiStore((state) => state.isolatedGroupId);
  const presenting = useUiStore((state) => state.presenting);
  const step = useUiStore((state) => state.presentationStep);
  const insets = useUiStore((state) => state.overlayInsets);
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);

  const theme = THEMES[doc.presentation.styleId];
  const appearance = doc.presentation.appearance;
  const projection = doc.presentation.camera.projection === 'style' ? theme.camera.projection : doc.presentation.camera.projection;

  const model = useMemo(
    () => buildSceneModel(doc, { layerHeight: appearance.layerHeight, heightScale: theme.node.heightScale, routeStyle: theme.connector.route }),
    // Only geometry-relevant parts of the document rebuild the model.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc.nodes, doc.groups, doc.edges, doc.annotations, doc.layout, appearance.layerHeight, theme.node.heightScale, theme.connector.route],
  );
  const highlight = useMemo(() => computeHighlight(doc, selection, isolated, presenting ? step : null), [doc, selection, isolated, presenting, step]);
  const materials = useMemo(() => new MaterialLibrary(theme, quality), [theme, quality]);
  useLayoutEffect(() => () => materials.dispose(), [materials]);
  const shadows = quality !== 'low' && theme.light.shadows;

  const { labelSize, crowded } = useMemo(() => {
    const view = computeDefaultView(model, viewDirection(theme.camera.azimuthDeg, theme.camera.elevationDeg), projection, theme.camera.fov, size, presenting, insets);
    const ideal = 12 * view.worldPerPixel;
    return { labelSize: Math.min(0.6, Math.max(0.12, ideal)) * (theme.label.size / 0.15), crowded: ideal > 0.42 };
  }, [model, projection, size, presenting, theme, insets]);

  const value = useMemo<SceneContextValue>(() => ({ theme, materials, model, highlight, shadows, reducedMotion, labelSize, crowded }), [theme, materials, model, highlight, shadows, reducedMotion, labelSize, crowded]);

  // Demand rendering: draw once whenever the inputs change.
  useEffect(() => invalidate(), [value, invalidate]);

  return (
    <SceneContext.Provider value={value}>
      <SceneEnvironment />
      <CameraRig projection={projection} />
      <ScenePlatforms />
      <SceneNodes />
      <SceneConnectors />
      <SceneNotes />
      <SceneLabels mode={appearance.labelMode} />
      {appearance.flowParticles ? <FlowParticles /> : null}
      <PngExporter projection={projection} />
      <SceneProbe onStats={onStats} />
    </SceneContext.Provider>
  );
}
