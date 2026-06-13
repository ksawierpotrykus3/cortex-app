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

  updateStream: (agentId, token) => set((state) => {
    // Find the most recent streaming entry for this agent to avoid updating stale entries
    const lastIdx = state.entries.findIndex((e) => e.agentId === agentId && e.isStreaming);
    if (lastIdx === -1) return state;
    const entries = [...state.entries];
    const entry = { ...entries[lastIdx], streamedContent: entries[lastIdx].streamedContent + token };
    entries[lastIdx] = entry;
    return { entries };
  }),

  completeEntry: (agentId, output) => set((state) => {
    const lastIdx = state.entries.findIndex((e) => e.agentId === agentId && e.isStreaming);
    if (lastIdx === -1) return state;
    const entries = [...state.entries];
    const entry = {
      ...entries[lastIdx],
      isStreaming: false,
      streamedContent: output.content,
      output,
    };
    entries[lastIdx] = entry;
    return { entries };
  }),

  setEntryError: (agentId, error) => set((state) => {
    const lastIdx = state.entries.findIndex((e) => e.agentId === agentId && e.isStreaming);
    if (lastIdx === -1) return state;
    const entries = [...state.entries];
    const entry = {
      ...entries[lastIdx],
      isStreaming: false,
      output: entries[lastIdx].output
        ? { ...entries[lastIdx].output!, error, status: AgentStatus.CRASHED }
        : undefined,
    };
    entries[lastIdx] = entry;
    return { entries };
  }),

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
