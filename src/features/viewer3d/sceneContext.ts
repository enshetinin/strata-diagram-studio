import { createContext, useContext } from 'react';
import { MeshBasicMaterial } from 'three';
import { preloadFont } from 'troika-three-text';
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
export const FONT_SEMIBOLD = `${import.meta.env.BASE_URL}assets/fonts/figtree-latin-600-normal.woff`;
export const FONT_BOLD = `${import.meta.env.BASE_URL}assets/fonts/figtree-latin-700-normal.woff`;
/** Code-inspired detail: component kinds and walkthrough step numbers. */
export const FONT_MONO = `${import.meta.env.BASE_URL}assets/fonts/jetbrains-mono-latin-500-normal.woff`;

/** Every font a WebGL label can use (titles, names, kinds, step numbers, dimensions). */
export const LABEL_FONTS = [FONT_REGULAR, FONT_SEMIBOLD, FONT_BOLD, FONT_MONO] as const;

/** Resolves once every label font is parsed by troika (used by the PNG export renderer). */
export function preloadLabelFonts(): Promise<void> {
  return Promise.all(
    LABEL_FONTS.map((font) => new Promise<void>((resolve) => preloadFont({ font }, () => resolve()))),
  ).then(() => undefined);
}

/** How strongly each emphasis level is mixed into the background colour. */
export const DIM_AMOUNT = { selected: 0, related: 0, normal: 0, dimmed: 0.55, isolatedOut: 0.82 } as const;

/**
 * Base material for every WebGL label: drawn on top of geometry so blocks
 * never hide text. Shared for the app lifetime (troika derives per-text
 * materials from it).
 */
export const LABEL_MATERIAL = new MeshBasicMaterial({
  depthTest: false,
  depthWrite: false,
  transparent: true,
  toneMapped: false,
});
