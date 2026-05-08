import { STORAGE_KEY } from './constants.js';

class Store {
  constructor() {
    this.state = this.load();
  }

  load() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return {
      nodes: [],
      links: [],
      parking: []
    };
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    // Dispatch event for UI updates if needed
    window.dispatchEvent(new CustomEvent('store-updated', { detail: this.state }));
  }

  getNodes() {
    return this.state.nodes;
  }

  getLinks() {
    return this.state.links;
  }

  getParking() {
    return this.state.parking;
  }

  addNode(node) {
    const newNode = {
      id: node.id || crypto.randomUUID(),
      title: node.title || 'Bez tytułu',
      content: node.content || '',
      type: node.type || 'rozrzutka',
      createdAt: new Date().toISOString(),
      ...node
    };
    this.state.nodes.push(newNode);
    this.save();
    return newNode;
  }

  updateNode(id, data) {
    const index = this.state.nodes.findIndex(n => n.id === id);
    if (index !== -1) {
      this.state.nodes[index] = { ...this.state.nodes[index], ...data };
      this.save();
    }
  }

  deleteNode(id) {
    this.state.nodes = this.state.nodes.filter(n => n.id !== id);
    this.state.links = this.state.links.filter(l => l.source !== id && l.target !== id);
    this.save();
  }

  addLink(sourceId, targetId) {
    // Avoid duplicates
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
      // Remove link if BOTH ends are in the selection
      return !(ids.includes(s) && ids.includes(t));
    });
    this.save();
  }

  clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    this.state = { nodes: [], links: [], parking: [] };
  }

  parkNode(id) {
    const node = this.state.nodes.find(n => n.id === id);
    if (node) {
      this.state.parking.push({ ...node, parkedAt: new Date().toISOString() });
      this.deleteNode(id); // Removes from nodes and links
      this.save();
    }
  }

  restoreNode(id) {
    const index = this.state.parking.findIndex(n => n.id === id);
    if (index !== -1) {
      const node = this.state.parking.splice(index, 1)[0];
      delete node.parkedAt;
      this.state.nodes.push(node);
      this.save();
    }
  }

  importData(data) {
    if (data && data.nodes && data.links) {
      this.state = data;
      this.save();
      location.reload(); // Hard reset for simplicity
    }
  }

  exportData() {
    const blob = new Blob([JSON.stringify(this.state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cortex-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  }
}

export const store = new Store();
