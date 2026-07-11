// ============================================================================
// NEXUS — KeyDir Bindings (#8)
// Domyślne skróty klawiszowe dla wszystkich widoków i akcji
// ============================================================================

import { useKeydirStore, KeyBinding } from '../renderer/store/keydirStore';
import type { ViewMode } from '../types';

type NavigateFn = (mode: ViewMode) => void;
type ActionFns = {
  newNote: () => void;
  newTask: () => void;
  newDraft: () => void;
  save: () => void;
  export: () => void;
  delete: () => void;
  find: () => void;
  escape: () => void;
  goBack: () => void;
  openPalette: () => void;
  openKeydir: () => void;
  toggleSidebar: () => void;
};

export function registerDefaultKeybindings(navigate: NavigateFn, actions: ActionFns): void {
  const G = (id: string, label: string, keys: string, handler: () => void): KeyBinding => ({
    id: `keydir:${id}`, label, keys, context: '*', handler,
  });

  const store = useKeydirStore.getState();

  store.registerMany([
    // ====================================================================
    // Global — nawigacja między widokami (Ctrl+1..9)
    // ====================================================================
    G('nav-nexus', 'Nexus Canvas', 'Ctrl+1', () => navigate('nexus')),
    G('nav-lab-todo', 'Lab — Taski', 'Ctrl+2', () => navigate('lab-todo')),
    G('nav-lab-writing', 'Lab — Pisanie', 'Ctrl+3', () => navigate('lab-writing')),
    G('nav-agents', 'Agenci AI', 'Ctrl+4', () => navigate('projekty' /* was agents */)),
    G('nav-wiki', 'Wiki', 'Ctrl+5', () => navigate('wiki')),
    G('nav-changes', 'Zmiany', 'Ctrl+8', () => navigate('changes')),

    // ====================================================================
    // Global — akcje
    // ====================================================================
    G('new-note', 'Nowa notatka', 'Ctrl+N', actions.newNote),
    G('save', 'Zapisz', 'Ctrl+S', actions.save),
    G('export', 'Eksportuj', 'Ctrl+E', actions.export),
    G('find', 'Szukaj', 'Ctrl+F', actions.find),
    G('open-palette', 'Command Palette', 'Ctrl+K', actions.openPalette),
    G('open-keydir', 'KeyDir — skróty', 'Ctrl+/', actions.openKeydir),
    G('toggle-sidebar', 'Schowaj/pokaż sidebar', 'Ctrl+B', actions.toggleSidebar),
    G('escape', 'Anuluj / zamknij', 'Escape', actions.escape),

    // ====================================================================
    // NexusCanvas
    // ====================================================================
    { id: 'keydir:canvas-new', label: 'Nowa notatka (canvas)', keys: 'N', context: 'nexus', handler: actions.newNote },
    { id: 'keydir:canvas-delete', label: 'Usuń zaznaczoną notatkę', keys: 'Delete', context: 'nexus', handler: actions.delete },
    { id: 'keydir:canvas-back', label: 'Odznacz / wróć', keys: 'Escape', context: 'nexus', handler: actions.escape },
  ]);
}
