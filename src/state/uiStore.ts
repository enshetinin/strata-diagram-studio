/** Interaction state: never persisted inside the document, never in history. */
import { create } from 'zustand';
import type { ElementRef } from '../domain/types';

export type ViewMode = '3d' | '2d';
export type LeftTab = 'templates' | 'library' | 'outline' | 'generate';
export type RightTab = 'inspector' | 'narrative' | 'appearance';
export type WebglStatus = 'unknown' | 'ok' | 'unsupported' | 'lost' | 'error';

export interface Notice {
  id: number;
  tone: 'info' | 'success' | 'warning' | 'error';
  text: string;
}

interface UiState {
  mode: ViewMode;
  selection: ElementRef[];
  leftOpen: boolean;
  rightOpen: boolean;
  leftTab: LeftTab;
  rightTab: RightTab;
  presenting: boolean;
  presentationStep: number;
  /** Step open in the walkthrough editor. */
  narrativeStepId: string | null;
  isolatedGroupId: string | null;
  /** Bumped to ask the active view to frame an element. */
  focusRequest: { ref: ElementRef; nonce: number } | null;
  cameraResetNonce: number;
  notices: Notice[];
  webgl: WebglStatus;
  webglMessage: string | null;
  pendingGroupDeletion: string[] | null;

  setMode(mode: ViewMode): void;
  select(refs: ElementRef[]): void;
  toggleSelect(ref: ElementRef): void;
  clearSelection(): void;
  setLeft(open: boolean, tab?: LeftTab): void;
  setRight(open: boolean, tab?: RightTab): void;
  setPresenting(presenting: boolean): void;
  setPresentationStep(step: number): void;
  setNarrativeStep(id: string | null): void;
  isolateGroup(groupId: string | null): void;
  focus(ref: ElementRef): void;
  resetCamera(): void;
  notify(tone: Notice['tone'], text: string): void;
  dismiss(id: number): void;
  setWebgl(status: WebglStatus, message?: string | null): void;
  requestGroupDeletion(groupIds: string[] | null): void;
}

let noticeId = 0;
const narrow = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 960px)').matches;

export const useUiStore = create<UiState>()((set) => ({
  mode: '3d',
  selection: [],
  leftOpen: !narrow(),
  rightOpen: !narrow(),
  leftTab: 'templates',
  rightTab: 'inspector',
  presenting: false,
  presentationStep: 0,
  narrativeStepId: null,
  isolatedGroupId: null,
  focusRequest: null,
  cameraResetNonce: 0,
  notices: [],
  webgl: 'unknown',
  webglMessage: null,
  pendingGroupDeletion: null,

  setMode: (mode) => set({ mode }),
  select: (refs) => set({ selection: refs }),
  toggleSelect: (ref) =>
    set((state) => {
      const exists = state.selection.some((item) => item.type === ref.type && item.id === ref.id);
      return { selection: exists ? state.selection.filter((item) => !(item.type === ref.type && item.id === ref.id)) : [...state.selection, ref] };
    }),
  clearSelection: () => set({ selection: [] }),
  setLeft: (open, tab) => set((state) => ({ leftOpen: open, leftTab: tab ?? state.leftTab, ...(open && narrow() ? { rightOpen: false } : {}) })),
  setRight: (open, tab) => set((state) => ({ rightOpen: open, rightTab: tab ?? state.rightTab, ...(open && narrow() ? { leftOpen: false } : {}) })),
  setPresenting: (presenting) => set({ presenting, presentationStep: 0, ...(presenting ? { mode: '3d' as const } : {}) }),
  setPresentationStep: (presentationStep) => set({ presentationStep }),
  setNarrativeStep: (narrativeStepId) => set({ narrativeStepId }),
  isolateGroup: (isolatedGroupId) => set({ isolatedGroupId }),
  focus: (ref) => set((state) => ({ focusRequest: { ref, nonce: (state.focusRequest?.nonce ?? 0) + 1 } })),
  resetCamera: () => set((state) => ({ cameraResetNonce: state.cameraResetNonce + 1 })),
  notify: (tone, text) => set((state) => ({ notices: [...state.notices.slice(-3), { id: ++noticeId, tone, text }] })),
  dismiss: (id) => set((state) => ({ notices: state.notices.filter((notice) => notice.id !== id) })),
  setWebgl: (webgl, message = null) => set({ webgl, webglMessage: message }),
  requestGroupDeletion: (pendingGroupDeletion) => set({ pendingGroupDeletion }),
}));

export function isSelected(selection: ElementRef[], ref: ElementRef): boolean {
  return selection.some((item) => item.type === ref.type && item.id === ref.id);
}

export const selectPrimary = (state: UiState): ElementRef | null => state.selection[state.selection.length - 1] ?? null;
