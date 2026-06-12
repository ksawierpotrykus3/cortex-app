// ============================================================================
// NEXUS — Changelog Store (Zustand)
// Transient updates dla changeloga — strumieniowanie tokenów w czasie rzeczywistym
// Używa useStore.getState() bez re-rendera dla wysokiej częstotliwości
// ============================================================================

import { create } from 'zustand';
import { ChangelogEntry, AgentOutput, AgentStatus } from '../../shared/types/schema';

// === Store Types ===========================================================
interface ChangelogStoreState {
  // Data
  entries: ChangelogEntry[];
  maxEntries: number; // Limit w UI, starsze są przycinane

  // Actions
  addEntry: (entry: ChangelogEntry) => void;
  updateStream: (agentId: string, token: string) => void;
  completeEntry: (agentId: string, output: AgentOutput) => void;
  setEntryError: (agentId: string, error: string) => void;
  approveEntry: (entryId: string) => void;
  rejectEntry: (entryId: string) => void;
  clearEntries: () => void;
  removeEntry: (entryId: string) => void;

  // Utils
  getEntriesForAgent: (agentId: string) => ChangelogEntry[];
}

export const useChangelogStore = create<ChangelogStoreState>((set, get) => ({
  // === Initial State =======================================================
  entries: [],
  maxEntries: 200, // Przycinamy po 200 wpisach

  // === Actions =============================================================

  addEntry: (entry) => set((state) => {
    const newEntries = [entry, ...state.entries];
    // Przycinanie po przekroczeniu limitu
    if (newEntries.length > state.maxEntries) {
      return { entries: newEntries.slice(0, state.maxEntries) };
    }
    return { entries: newEntries };
  }),

  updateStream: (agentId, token) => set((state) => ({
    entries: state.entries.map((e) =>
      e.agentId === agentId && e.isStreaming
        ? { ...e, streamedContent: e.streamedContent + token }
        : e
    ),
  })),

  completeEntry: (agentId, output) => set((state) => ({
    entries: state.entries.map((e) =>
      e.agentId === agentId && e.isStreaming
        ? {
            ...e,
            isStreaming: false,
            streamedContent: output.content,
            output,
          }
        : e
    ),
  })),

  setEntryError: (agentId, error) => set((state) => ({
    entries: state.entries.map((e) =>
      e.agentId === agentId && e.isStreaming
        ? {
            ...e,
            isStreaming: false,
            output: e.output
              ? { ...e.output, error, status: AgentStatus.CRASHED }
              : undefined,
          }
        : e
    ),
  })),

  approveEntry: (entryId) => set((state) => ({
    entries: state.entries.map((e) =>
      e.id === entryId && e.output
        ? {
            ...e,
            output: { ...e.output, approved: true, rating: 10 },
          }
        : e
    ),
  })),

  rejectEntry: (entryId) => set((state) => ({
    entries: state.entries.map((e) =>
      e.id === entryId && e.output
        ? {
            ...e,
            output: { ...e.output, approved: false, rating: 0 },
          }
        : e
    ),
  })),

  clearEntries: () => set({ entries: [] }),

  removeEntry: (entryId) => set((state) => ({
    entries: state.entries.filter((e) => e.id !== entryId),
  })),

  // === Utils ===============================================================

  getEntriesForAgent: (agentId) => {
    return get().entries.filter((e) => e.agentId === agentId);
  },
}));
