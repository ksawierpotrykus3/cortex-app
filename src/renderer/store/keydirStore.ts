// ============================================================================
// NEXUS — KeyDir (#8)
// Registry skrótów klawiszowych z kontekstami + customizable
// ============================================================================

import { create } from 'zustand';

export interface KeyBinding {
  id: string;
  label: string;
  keys: string; // np. "Ctrl+Shift+N", "Alt+Left"
  /** Kontekst: '*' = global, 'nexus' = tylko w NexusCanvas, etc. */
  context: string;
  handler: () => void;
}

export interface ShortcutOverride {
  actionId: string;
  keys: string;
}

interface KeyDirState {
  bindings: KeyBinding[];
  overrides: ShortcutOverride[];
  showPanel: boolean;

  register: (binding: KeyBinding) => void;
  registerMany: (bindings: KeyBinding[]) => void;
  unregister: (id: string) => void;

  /** Zwraca binding dla danego eventu klawiszowego */
  match: (e: KeyboardEvent, context: string) => KeyBinding | undefined;

  /** Custom overrides (z workspace) */
  setOverrides: (overrides: ShortcutOverride[]) => void;
  setOverride: (actionId: string, keys: string) => void;
  removeOverride: (actionId: string) => void;

  togglePanel: () => void;
  closePanel: () => void;
}

// Normalizacja klawiszy do formatu "Mod+Key"
function normalizeKeys(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta') {
    // Modifier-only — skip
    return '';
  }
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  parts.push(key);
  return parts.join('+');
}

export const useKeydirStore = create<KeyDirState>((set, get) => ({
  bindings: [],
  overrides: [],
  showPanel: false,

  register: (binding) =>
    set((state) => {
      const existing = state.bindings.findIndex((b) => b.id === binding.id);
      if (existing >= 0) {
        const updated = [...state.bindings];
        updated[existing] = binding;
        return { bindings: updated };
      }
      return { bindings: [...state.bindings, binding] };
    }),

  registerMany: (bindings) =>
    set((state) => {
      const map = new Map(state.bindings.map((b) => [b.id, b]));
      for (const b of bindings) map.set(b.id, b);
      return { bindings: Array.from(map.values()) };
    }),

  unregister: (id) =>
    set((state) => ({
      bindings: state.bindings.filter((b) => b.id !== id),
    })),

  match: (e, context) => {
    const normalized = normalizeKeys(e);
    if (!normalized) return undefined;

    const state = get();

    // Check overrides first
    const override = state.overrides.find((o) => o.keys === normalized);
    if (override) {
      return state.bindings.find((b) => b.id === override.actionId);
    }

    // Find matching binding
    return state.bindings.find((b) => {
      if (b.keys !== normalized) return false;
      if (b.context === '*') return true;
      if (b.context === context) return true;
      return false;
    });
  },

  setOverrides: (overrides) => set({ overrides }),
  setOverride: (actionId, keys) =>
    set((state) => {
      const existing = state.overrides.findIndex((o) => o.actionId === actionId);
      if (existing >= 0) {
        const updated = [...state.overrides];
        updated[existing] = { actionId, keys };
        return { overrides: updated };
      }
      return { overrides: [...state.overrides, { actionId, keys }] };
    }),
  removeOverride: (actionId) =>
    set((state) => ({
      overrides: state.overrides.filter((o) => o.actionId !== actionId),
    })),

  togglePanel: () => set((s) => ({ showPanel: !s.showPanel })),
  closePanel: () => set({ showPanel: false }),
}));

// === Globalny listener — odpala się w App.tsx ===============================
export function createKeydirHandler(getContext: () => string) {
  return (e: KeyboardEvent) => {
    const state = useKeydirStore.getState();

    // Ignore if user is typing in an input/textarea
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const context = getContext();
    const binding = state.match(e, context);
    if (binding) {
      e.preventDefault();
      e.stopPropagation();
      binding.handler();
    }
  };
}
