export const META_STORAGE_KEY = 'cortex.meta';
export const STORAGE_KEY_PREFIX = 'cortex-data-v2-board-';
export const LEGACY_STORAGE_KEY = 'cortex-data-v2';

function generateId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

class MetaStore {
  constructor() {
    this.storage = globalThis.localStorage || createMemoryStorage();
    this.state = this.load();
  }

  load() {
    const metaStr = this.storage.getItem(META_STORAGE_KEY);
    if (!metaStr) {
      // First time loading the multi-board system.
      // We will create the default "Tablica 1" and point it to the legacy storage key
      // to guarantee zero data loss and perfect backwards compatibility.
      const state = {
        activeBoardId: '1',
        boards: [
          { id: '1', name: 'Tablica 1', storageKey: LEGACY_STORAGE_KEY }
        ]
      };
      this.save(state);
      return state;
    }
    
    try {
      return JSON.parse(metaStr);
    } catch {
      return { activeBoardId: '1', boards: [{ id: '1', name: 'Tablica 1', storageKey: LEGACY_STORAGE_KEY }] };
    }
  }

  save(state) {
    this.state = state;
    this.storage.setItem(META_STORAGE_KEY, JSON.stringify(state));
  }

  getBoards() {
    return this.state.boards || [];
  }

  getActiveBoardId() {
    return this.state.activeBoardId || '1';
  }

  getActiveStorageKey() {
    const board = this.getBoards().find(b => b.id === this.getActiveBoardId());
    return board ? board.storageKey : LEGACY_STORAGE_KEY;
  }

  getStorageKeyForBoard(boardId) {
    const board = this.getBoards().find(b => b.id === boardId);
    return board ? board.storageKey : null;
  }

  addBoard(name) {
    const id = generateId();
    this.state.boards.push({
      id,
      name: name || 'Nowa tablica',
      storageKey: STORAGE_KEY_PREFIX + id
    });
    this.save(this.state);
    return id;
  }

  renameBoard(id, newName) {
    const board = this.state.boards.find(b => b.id === id);
    if (board && newName.trim()) {
      board.name = newName.trim();
      this.save(this.state);
      return true;
    }
    return false;
  }

  deleteBoard(id) {
    if (this.state.boards.length <= 1) return false; // Nie można usunąć ostatniej
    const board = this.state.boards.find(b => b.id === id);
    if (!board) return false;

    this.state.boards = this.state.boards.filter(b => b.id !== id);
    
    // Zabezpieczenie przed usunięciem aktywnej
    if (this.state.activeBoardId === id) {
      this.state.activeBoardId = this.state.boards[0].id;
    }

    // Usunięcie danych (o ile to nie jest klucz legacy, chociaż w teorii możemy usuwać)
    if (board.storageKey !== LEGACY_STORAGE_KEY) {
      this.storage.removeItem(board.storageKey);
    }

    this.save(this.state);
    return true;
  }

  switchBoard(id) {
    if (this.state.boards.some(b => b.id === id)) {
      this.state.activeBoardId = id;
      this.save(this.state);
      return true;
    }
    return false;
  }

  getAllBoardsData() {
    const result = [];
    for (const board of this.state.boards) {
      const dataStr = this.storage.getItem(board.storageKey);
      if (dataStr) {
        try {
          result.push({ board, data: JSON.parse(dataStr) });
        } catch { /* ignore */ }
      }
    }
    return result;
  }
}

function createMemoryStorage() {
  let value = null;
  return {
    getItem() { return value; },
    setItem(_key, next) { value = next; },
    removeItem() { value = null; },
  };
}

export const metaStore = new MetaStore();
