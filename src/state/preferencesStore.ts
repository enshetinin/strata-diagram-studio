/** Device preferences (not part of the portable document). */
import { create } from 'zustand';
import { DEFAULT_PNG_OPTIONS, PNG_FORMAT_IDS, type PngComposeOptions } from '../features/export/pngOptions';

export type Quality = 'low' | 'medium' | 'high';
export type Theme = 'light' | 'dark';

interface Preferences {
  quality: Quality;
  /** Set when the performance monitor degraded quality automatically. */
  autoDegraded: boolean;
  snapToGrid: boolean;
  /** Chrome colour scheme; light is the reference design. */
  theme: Theme;
  /** Last PNG export choices. */
  png: PngComposeOptions;
  setQuality(quality: Quality, auto?: boolean): void;
  setSnap(snap: boolean): void;
  setTheme(theme: Theme): void;
  setPng(patch: Partial<PngComposeOptions>): void;
}

type Stored = Pick<Preferences, 'quality' | 'snapToGrid' | 'theme' | 'png'>;

const KEY = 'strata:preferences';

function readPng(raw: unknown): PngComposeOptions | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;
  return {
    format: PNG_FORMAT_IDS.includes(value.format as PngComposeOptions['format'])
      ? (value.format as PngComposeOptions['format'])
      : DEFAULT_PNG_OPTIONS.format,
    title: typeof value.title === 'boolean' ? value.title : DEFAULT_PNG_OPTIONS.title,
    legend: typeof value.legend === 'boolean' ? value.legend : DEFAULT_PNG_OPTIONS.legend,
    transparent: typeof value.transparent === 'boolean' ? value.transparent : DEFAULT_PNG_OPTIONS.transparent,
  };
}

function read(): Partial<Stored> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const value = parsed as Record<string, unknown>;
    return {
      ...(value.quality === 'low' || value.quality === 'medium' || value.quality === 'high'
        ? { quality: value.quality }
        : {}),
      ...(typeof value.snapToGrid === 'boolean' ? { snapToGrid: value.snapToGrid } : {}),
      ...(value.theme === 'light' || value.theme === 'dark' ? { theme: value.theme } : {}),
      ...(readPng(value.png) ? { png: readPng(value.png)! } : {}),
    };
  } catch {
    return {};
  }
}

function write(state: Stored) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(state));
  } catch {
    // Preferences are a convenience; failing to store them is harmless.
  }
}

/** The tokens switch on :root[data-theme]; set it before the first paint. */
function applyTheme(theme: Theme) {
  globalThis.document?.documentElement.setAttribute('data-theme', theme);
}

const initial = read();
applyTheme(initial.theme ?? 'light');

export const usePreferences = create<Preferences>()((set, get) => {
  const persist = () => {
    const { quality, snapToGrid, theme, png } = get();
    write({ quality, snapToGrid, theme, png });
  };
  return {
    quality: initial.quality ?? 'medium',
    autoDegraded: false,
    snapToGrid: initial.snapToGrid ?? true,
    theme: initial.theme ?? 'light',
    png: initial.png ?? DEFAULT_PNG_OPTIONS,
    setQuality: (quality, auto = false) => {
      set({ quality, autoDegraded: auto });
      if (!auto) persist();
    },
    setSnap: (snapToGrid) => {
      set({ snapToGrid });
      persist();
    },
    setTheme: (theme) => {
      set({ theme });
      applyTheme(theme);
      persist();
    },
    setPng: (patch) => {
      set({ png: { ...get().png, ...patch } });
      persist();
    },
  };
});
