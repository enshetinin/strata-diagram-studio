/** Device preferences (not part of the portable document). */
import { create } from 'zustand';

export type Quality = 'low' | 'medium' | 'high';
export type Theme = 'light' | 'dark';

interface Preferences {
  quality: Quality;
  /** Set when the performance monitor degraded quality automatically. */
  autoDegraded: boolean;
  snapToGrid: boolean;
  /** Chrome colour scheme; light is the reference design. */
  theme: Theme;
  setQuality(quality: Quality, auto?: boolean): void;
  setSnap(snap: boolean): void;
  setTheme(theme: Theme): void;
}

type Stored = Pick<Preferences, 'quality' | 'snapToGrid' | 'theme'>;

const KEY = 'strata:preferences';

function read(): Partial<Stored> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const value = parsed as Record<string, unknown>;
    return {
      ...(value.quality === 'low' || value.quality === 'medium' || value.quality === 'high' ? { quality: value.quality } : {}),
      ...(typeof value.snapToGrid === 'boolean' ? { snapToGrid: value.snapToGrid } : {}),
      ...(value.theme === 'light' || value.theme === 'dark' ? { theme: value.theme } : {}),
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

export const usePreferences = create<Preferences>()((set, get) => ({
  quality: initial.quality ?? 'medium',
  autoDegraded: false,
  snapToGrid: initial.snapToGrid ?? true,
  theme: initial.theme ?? 'light',
  setQuality: (quality, auto = false) => {
    set({ quality, autoDegraded: auto });
    if (!auto) write({ quality, snapToGrid: get().snapToGrid, theme: get().theme });
  },
  setSnap: (snapToGrid) => {
    set({ snapToGrid });
    write({ quality: get().quality, snapToGrid, theme: get().theme });
  },
  setTheme: (theme) => {
    set({ theme });
    applyTheme(theme);
    write({ quality: get().quality, snapToGrid: get().snapToGrid, theme });
  },
}));
