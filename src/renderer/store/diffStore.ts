// ============================================================================
// NEXUS — DiffStore (#5)
// Zustand store dla EntitySnapshot + DiffModal state
// ============================================================================

import { create } from 'zustand';
import { EntitySnapshot } from '../../utils/diffEngine';
import { uid } from '../../utils/ids';

interface DiffModalState {
  open: boolean;
  entityId: string;
  entityType: EntitySnapshot['entityType'];
  title: string;
  currentContent: string;
}

interface DiffState {
  snapshots: EntitySnapshot[];

  // Diff modal state
  diffModal: DiffModalState;

  /** Otwiera DiffModal dla encji */
  openDiff: (params: Omit<DiffModalState, 'open'>) => void;

  /** Zamyka DiffModal */
  closeDiff: () => void;

  /** Dodaje snapshot (z automatycznym version) */
  addSnapshot: (snapshot: Omit<EntitySnapshot, 'version'>) => void;

  /** Zwraca wszystkie snapshoty dla encji (od najnowszych) */
  getSnapshots: (entityId: string) => EntitySnapshot[];

  /** Zwraca ostatni snapshot dla encji */
  getLatestSnapshot: (entityId: string) => EntitySnapshot | undefined;

  /** Zastępuje całą tablicę (do load z workspace) */
  setSnapshots: (snapshots: EntitySnapshot[]) => void;

  /** Tworzy snapshot przed edycją — wywołaj BEFORE zmiany */
  snapshotBeforeEdit: (entityId: string, entityType: EntitySnapshot['entityType'], content: string, title: string) => void;

  /** Czy dana encja ma co najmniej jeden snapshot */
  hasSnapshot: (entityId: string) => boolean;
}

const defaultModal: DiffModalState = {
  open: false,
  entityId: '',
  entityType: 'node',
  title: '',
  currentContent: '',
};

export const useDiffStore = create<DiffState>((set, get) => ({
  snapshots: [],
  diffModal: { ...defaultModal },

  openDiff: (params) =>
    set({ diffModal: { ...params, open: true } }),

  closeDiff: () =>
    set({ diffModal: { ...defaultModal } }),

  addSnapshot: (partial) =>
    set((state) => {
      const existing = state.snapshots.filter((s) => s.entityId === partial.entityId);
      const maxVer = existing.length > 0 ? Math.max(...existing.map((s) => s.version)) : 0;
      const snapshot: EntitySnapshot = {
        ...partial,
        id: uid(),
        version: maxVer + 1,
      };
      return { snapshots: [...state.snapshots, snapshot] };
    }),

  getSnapshots: (entityId) => {
    return get()
      .snapshots.filter((s) => s.entityId === entityId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  },

  getLatestSnapshot: (entityId) => {
    const snaps = get()
      .snapshots.filter((s) => s.entityId === entityId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return snaps[0];
  },

  setSnapshots: (snapshots) => set({ snapshots }),

  hasSnapshot: (entityId) => {
    return get().snapshots.some((s) => s.entityId === entityId);
  },

  snapshotBeforeEdit: (entityId, entityType, content, title) => {
    if (!content && !title) return; // Don't snapshot empty
    get().addSnapshot({
      id: uid(),
      entityId,
      entityType,
      content,
      title,
      timestamp: new Date().toISOString(),
    });
  },
}));
