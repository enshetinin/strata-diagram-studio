/**
 * The single canonical document shared by every renderer, plus undo/redo.
 * Only semantic and layout changes go through `execute`; selection, hover and
 * camera never enter history.
 */
import { create } from 'zustand';
import { CommandError } from '../domain/commands';
import { validateInvariants } from '../domain/invariants';
import type { DiagramDocument } from '../domain/types';
import { defaultDocument } from '../features/templates';

const HISTORY_LIMIT = 100;

interface HistoryEntry {
  doc: DiagramDocument;
  label: string;
}

export type CommandResult = { ok: true } | { ok: false; error: string };

interface DocumentState {
  doc: DiagramDocument;
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Increments on every accepted change (including undo/redo). */
  revision: number;
  lastLabel: string | null;
  /** When set, every change is refused with this message (shared links open read-only). */
  readOnly: string | null;
  execute(label: string, command: (doc: DiagramDocument) => DiagramDocument): CommandResult;
  undo(): void;
  redo(): void;
  /** Loads a document without recording history (startup / recovery). */
  load(doc: DiagramDocument): void;
  setReadOnly(reason: string | null): void;
}

export const useDocumentStore = create<DocumentState>()((set, get) => ({
  doc: defaultDocument(),
  past: [],
  future: [],
  revision: 0,
  lastLabel: null,
  readOnly: null,

  execute(label, command) {
    const { doc: current, readOnly } = get();
    if (readOnly) return { ok: false, error: readOnly };
    let next: DiagramDocument;
    try {
      next = command(current);
    } catch (error) {
      if (error instanceof CommandError) return { ok: false, error: error.message };
      throw error;
    }
    if (next === current) return { ok: true };
    const issues = validateInvariants(next);
    if (issues.length > 0) {
      return { ok: false, error: issues[0]?.message ?? 'Cambio rechazado por invariantes.' };
    }
    set((state) => ({
      doc: next,
      past: [...state.past, { doc: current, label }].slice(-HISTORY_LIMIT),
      future: [],
      revision: state.revision + 1,
      lastLabel: label,
    }));
    return { ok: true };
  },

  undo() {
    const { past, doc } = get();
    const previous = past[past.length - 1];
    if (!previous) return;
    set((state) => ({
      doc: previous.doc,
      past: state.past.slice(0, -1),
      future: [{ doc, label: previous.label }, ...state.future],
      revision: state.revision + 1,
      lastLabel: `Deshacer: ${previous.label}`,
    }));
  },

  redo() {
    const { future, doc } = get();
    const next = future[0];
    if (!next) return;
    set((state) => ({
      doc: next.doc,
      past: [...state.past, { doc, label: next.label }],
      future: state.future.slice(1),
      revision: state.revision + 1,
      lastLabel: `Rehacer: ${next.label}`,
    }));
  },

  load(doc) {
    set((state) => ({ doc, past: [], future: [], revision: state.revision + 1, lastLabel: null }));
  },

  setReadOnly(readOnly) {
    set({ readOnly });
  },
}));

export const selectCanUndo = (state: DocumentState) => state.past.length > 0;
export const selectCanRedo = (state: DocumentState) => state.future.length > 0;
export const selectUndoLabel = (state: DocumentState) => state.past[state.past.length - 1]?.label ?? null;
export const selectRedoLabel = (state: DocumentState) => state.future[0]?.label ?? null;
