import { STORAGE_KEY } from './constants.js';
import { buildSemanticContext, buildSemanticExport } from './semanticExport.js';

class Store {
  constructor() {
    this.state = this.load();
    this._listeners = [];
  }

  load() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        return {
          nodes: parsed.nodes || [],
          links: parsed.links || [],
          parking: parsed.parking || [],
          strokes: parsed.strokes || [],
          categories: parsed.categories || this._defaultCategories()
        };
      } catch {
        return { nodes: [], links: [], parking: [], strokes: [], categories: this._defaultCategories() };
      }
    }
    return { nodes: [], links: [], parking: [], strokes: [], categories: this._defaultCategories() };
  }

  _defaultCategories() {
    return [
      { id: 'aksjomat',   name: 'Aksjomat',   color: '#e5a54b', order: 0 },
      { id: 'pewnik',     name: 'Pewnik',     color: '#c4a43a', order: 1 },
      { id: 'przeblysk',  name: 'Przebłysk',  color: '#4da8a0', order: 2 },
      { id: 'rozrzutka',  name: 'Rozrzutka',  color: '#7c6cb5', order: 3 },
      { id: 'problem',    name: 'Problem',    color: '#c45c5c', order: 4 },
    ];
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    this._notify();
  }

  onChange(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(l => l !== fn); };
  }

  _notify() {
    this._listeners.forEach(fn => fn(this.state));
  }

  getNodes() { return this.state.nodes; }
  getLinks() { return this.state.links; }
  getParking() { return this.state.parking; }
  getNodeById(id) { return this.state.nodes.find(n => n.id === id); }

  addNode(node) {
    const newNode = {
      id: crypto.randomUUID(),
      title: node.title || '',
      content: node.content || '',
      type: node.type || 'rozrzutka',
      x: node.x ?? 200 + Math.random() * 400,
      y: node.y ?? 200 + Math.random() * 400,
      createdAt: new Date().toISOString(),
    };
    // Screenshot fields
    if (node.image) newNode.image = node.image;
    if (node.imageDescription) newNode.imageDescription = node.imageDescription;
    if (node.imageWidth) newNode.imageWidth = node.imageWidth;
    if (node.imageHeight) newNode.imageHeight = node.imageHeight;
    this.state.nodes.push(newNode);
    this.save();
    return newNode;
  }

  updateNode(id, data) {
    const idx = this.state.nodes.findIndex(n => n.id === id);
    if (idx !== -1) {
      this.state.nodes[idx] = { ...this.state.nodes[idx], ...data };
      this.save();
    }
  }

  /** Lightweight position update — saves but doesn't fire full re-render */
  updateNodePosition(id, x, y) {
    const node = this.state.nodes.find(n => n.id === id);
    if (node) {
      node.x = x;
      node.y = y;
      // Debounced save — don't spam localStorage during drag
      clearTimeout(this._posSaveTimer);
      this._posSaveTimer = setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }, 300);
    }
  }

  deleteNode(id) {
    this.state.nodes = this.state.nodes.filter(n => n.id !== id);
    this.state.links = this.state.links.filter(l => l.source !== id && l.target !== id);
    this.save();
  }

  addLink(sourceId, targetId) {
    const exists = this.state.links.find(l =>
      (l.source === sourceId && l.target === targetId) ||
      (l.source === targetId && l.target === sourceId)
    );
    if (!exists && sourceId !== targetId) {
      this.state.links.push({ source: sourceId, target: targetId });
      this.save();
    }
  }

  deleteLink(sourceId, targetId) {
    this.state.links = this.state.links.filter(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      return !(s === sourceId && t === targetId) && !(s === targetId && t === sourceId);
    });
    this.save();
  }

  deleteLinksBetween(ids) {
    this.state.links = this.state.links.filter(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      return !(ids.includes(s) && ids.includes(t));
    });
    this.save();
  }

  clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    this.state = { nodes: [], links: [], parking: [], strokes: [], categories: this._defaultCategories() };
    this._notify();
  }

  // --- Strokes (drawing) ---
  getStrokes() { return this.state.strokes || []; }

  addStroke(stroke) {
    if (!this.state.strokes) this.state.strokes = [];
    this.state.strokes.push({
      id: crypto.randomUUID(),
      points: stroke.points,
      color: stroke.color || '#ffffff',
      width: stroke.width || 2,
      createdAt: new Date().toISOString(),
    });
    this.save();
  }

  undoStroke() {
    if (this.state.strokes && this.state.strokes.length > 0) {
      this.state.strokes.pop();
      this.save();
    }
  }

  clearStrokes() {
    this.state.strokes = [];
    this.save();
  }

  parkNode(id) {
    if (!this.state.parking) this.state.parking = [];
    const node = this.state.nodes.find(n => n.id === id);
    if (node) {
      this.state.parking.push({ ...node, parkedAt: new Date().toISOString() });
      this.deleteNode(id);
    }
  }

  restoreNode(id) {
    const idx = this.state.parking.findIndex(n => n.id === id);
    if (idx !== -1) {
      const node = this.state.parking.splice(idx, 1)[0];
      delete node.parkedAt;
      this.state.nodes.push(node);
      this.save();
    }
  }

  importData(data) {
    if (data && data.nodes && data.links) {
      this.state = {
        nodes: data.nodes,
        links: data.links,
        parking: data.parking || [],
        strokes: data.strokes || [],
        categories: data.categories || this.state.categories || this._defaultCategories()
      };
      this.save();
    }
  }

  buildSemanticExport() {
    return buildSemanticExport(this.state);
  }

  buildSemanticContext() {
    return buildSemanticContext(this.state);
  }

  exportData(options = {}) {
    const full = options.full === true;
    const data = full ? this.state : this.buildSemanticExport();
    const filenamePrefix = full ? 'cortex-backup' : 'cortex-ai';
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Categories ---
  getCategories() {
    if (!this.state.categories || this.state.categories.length === 0) {
      this.state.categories = this._defaultCategories();
    }
    return [...this.state.categories].sort((a, b) => a.order - b.order);
  }

  getCategoryColor(type) {
    const cat = (this.state.categories || []).find(c => c.id === type);
    return cat ? cat.color : '#7c6cb5'; // fallback to rozrzutka color
  }

  getCategoryName(type) {
    const cat = (this.state.categories || []).find(c => c.id === type);
    return cat ? cat.name : type;
  }

  addCategory(name, color) {
    const id = name.toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]/g, '_').replace(/_+/g, '_');
    const exists = (this.state.categories || []).find(c => c.id === id);
    if (exists) return null;
    const maxOrder = Math.max(0, ...(this.state.categories || []).map(c => c.order));
    const cat = { id, name, color, order: maxOrder + 1 };
    this.state.categories.push(cat);
    this.save();
    return cat;
  }

  updateCategory(id, data) {
    const cat = (this.state.categories || []).find(c => c.id === id);
    if (cat) {
      if (data.name !== undefined) cat.name = data.name;
      if (data.color !== undefined) cat.color = data.color;
      if (data.order !== undefined) cat.order = data.order;
      this.save();
    }
  }

  deleteCategory(id) {
    // Don't allow deleting if it's the last category
    if ((this.state.categories || []).length <= 1) return;
    this.state.categories = this.state.categories.filter(c => c.id !== id);
    // Migrate nodes to 'rozrzutka' (or first available category)
    const fallback = this.state.categories[0]?.id || 'rozrzutka';
    this.state.nodes.forEach(n => {
      if (n.type === id) n.type = fallback;
    });
    this.save();
  }

  reorderCategories(orderedIds) {
    orderedIds.forEach((id, i) => {
      const cat = this.state.categories.find(c => c.id === id);
      if (cat) cat.order = i;
    });
    this.save();
  }
}

export const store = new Store();
