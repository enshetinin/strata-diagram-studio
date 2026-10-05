import { createContext, useContext } from 'react';
import { MeshBasicMaterial } from 'three';
import type { SceneModel } from '../layout/sceneModel';
import type { HighlightState } from './highlight';
import type { MaterialLibrary } from './materials';
import type { ThemeTokens } from './themes';

export interface SceneContextValue {
  theme: ThemeTokens;
  materials: MaterialLibrary;
  model: SceneModel;
  highlight: HighlightState;
  shadows: boolean;
  reducedMotion: boolean;
  /** World size of label text, derived from the default framing (≈13 px on screen). */
  labelSize: number;
  /** True when the framing is so compressed that only key labels fit. */
  crowded: boolean;
}

export const SceneContext = createContext<SceneContextValue | null>(null);

export function useScene(): SceneContextValue {
  const value = useContext(SceneContext);
  if (!value) throw new Error('useScene must be used inside <SceneContext>');
  return value;
}

export const FONT_REGULAR = `${import.meta.env.BASE_URL}assets/fonts/figtree-latin-500-normal.woff`;
export const FONT_BOLD = `${import.meta.env.BASE_URL}assets/fonts/figtree-latin-700-normal.woff`;

/** How strongly each emphasis level is mixed into the background colour. */
export const DIM_AMOUNT = { selected: 0, related: 0, normal: 0, dimmed: 0.55, isolatedOut: 0.82 } as const;

/**
 * Base material for every WebGL label: drawn on top of geometry so blocks
 * never hide text. Shared for the app lifetime (troika derives per-text
 * materials from it).
 */
export const LABEL_MATERIAL = new MeshBasicMaterial({ depthTest: false, depthWrite: false, transparent: true, toneMapped: false });
