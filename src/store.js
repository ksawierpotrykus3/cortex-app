import { STORAGE_KEY } from './constants.js';
import { buildSemanticContext, buildSemanticExport } from './semanticExport.js';
import {
  PLAN_KINDS,
  ROOT_LAYER_ID,
  buildLayerPath,
  categorySlug,
  currentScope,
  defaultCategories,
  emptyState,
  getEndpointId,
  migrateState,
  nodeMatchesView,
  resolveLayerTitle,
  strokeMatchesScope,
} from './schema.js';

export class Store {
  constructor(options = {}) {
    this.storage = options.storage || globalThis.localStorage || createMemoryStorage();
    this.state = this.load();
    this._listeners = [];
  }

  load() {
    const data = this.storage.getItem(STORAGE_KEY);
    if (data) {
      try {
        return migrateState(JSON.parse(data));
      } catch {
        return emptyState();
      }
    }
    return emptyState();
  }

  _defaultCategories() {
    return defaultCategories();
  }

  save(options = {}) {
    this.state = migrateState(this.state);
    this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    if (options.notify !== false) this._notify();
  }

  onChange(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(listener => listener !== fn); };
  }

  _notify() {
    this._listeners.forEach(fn => fn(this.state));
  }

  getNodes() { return this.state.nodes; }
  getLinks() { return this.state.links; }
  getParking() { return this.state.parking; }
  getInboxMessages() { return this.state.inboxMessages || []; }
  getSemanticConfig() { return this.state.semanticConfig || {}; }
  getProjects() { return this.state.projects || []; }
  getLayers() { return this.state.layers || []; }
  getActiveProjectId() { return this.state.activeProjectId || 'all'; }
  getActiveLayerId() { return this.state.activeLayerId || ROOT_LAYER_ID; }
  getProjectById(id) { return this.getProjects().find(project => project.id === id); }
  getLayerById(id) { return this.getLayers().find(layer => layer.id === id); }
  getNodeById(id) { return this.state.nodes.find(node => node.id === id); }
  getCurrentScope() { return currentScope(this.state); }

  getVisibleNodes() {
    return this.state.nodes.filter(node => nodeMatchesView(node, this.state));
  }

  getVisibleLinks() {
    const visibleIds = new Set(this.getVisibleNodes().map(node => node.id));
    return this.state.links.filter(link => {
      const source = getEndpointId(link.source);
      const target = getEndpointId(link.target);
      return visibleIds.has(source) && visibleIds.has(target);
    });
  }

  getAllConnectionsForNode(nodeId) {
    const node = this.getNodeById(nodeId);
    if (!node) return [];

    return this.state.links
      .map(link => {
        const source = getEndpointId(link.source);
        const target = getEndpointId(link.target);
        if (source !== nodeId && target !== nodeId) return null;
        const otherId = source === nodeId ? target : source;
        const otherNode = this.getNodeById(otherId);
        if (!otherNode) return null;
        const project = otherNode.projectId ? this.getProjectById(otherNode.projectId) : null;
        return {
          nodeId: otherNode.id,
          title: otherNode.title || otherNode.content || otherNode.id,
          type: otherNode.type,
          projectId: otherNode.projectId || null,
          projectName: project?.name || (otherNode.projectId ? otherNode.projectId : 'Workspace'),
          layerId: otherNode.layerId || ROOT_LAYER_ID,
          isVisible: nodeMatchesView(otherNode, this.state),
        };
      })
      .filter(Boolean);
  }

  getStrokes() { return this.state.strokes || []; }

  getVisibleStrokes() {
    const scope = this.getCurrentScope();
    return this.getStrokes().filter(stroke => strokeMatchesScope(stroke, scope));
  }

  addNode(node = {}) {
    const now = new Date().toISOString();
    const type = node.type || this.getDefaultCategoryId();
    const category = this.getCategories().find(item => item.id === type);
    const activeLayerId = this.getActiveLayerId();
    const newNode = {
      id: uuid(),
      title: node.title !== undefined ? node.title : (category?.autoTitle || ''),
      content: node.content || '',
      type,
      stage: node.stage || 'robocze',
      planKind: PLAN_KINDS.includes(node.planKind) ? node.planKind : '',
      priority: clampPriority(node.priority),
      rawState: node.rawState || 'raw',
      projectId: node.projectId !== undefined ? normalizeProjectValue(node.projectId) : this._projectIdForNewNode(),
      layerId: node.layerId || activeLayerId,
      sourceIds: Array.isArray(node.sourceIds) ? node.sourceIds : [],
      x: node.x ?? 200 + Math.random() * 400,
      y: node.y ?? 200 + Math.random() * 400,
      createdAt: node.createdAt || now,
      updatedAt: node.updatedAt || now,
    };

    if (node.image) newNode.image = node.image;
    if (node.imageDescription) {
      newNode.imageDescription = node.imageDescription;
      if (!node.rawState) newNode.rawState = 'extracted';
    }
    if (node.imageWidth) newNode.imageWidth = node.imageWidth;
    if (node.imageHeight) newNode.imageHeight = node.imageHeight;
    if (node.cardScale) newNode.cardScale = node.cardScale;

    this.state.nodes.push(newNode);
    this.save();
    return newNode;
  }

  updateNode(id, data) {
    const idx = this.state.nodes.findIndex(node => node.id === id);
    if (idx === -1) return false;
    this.state.nodes[idx] = {
      ...this.state.nodes[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return true;
  }

  updateNodePosition(id, x, y) {
    const node = this.state.nodes.find(item => item.id === id);
    if (!node) return;
    node.x = x;
    node.y = y;
    node.updatedAt = new Date().toISOString();
    clearTimeout(this._posSaveTimer);
    this._posSaveTimer = setTimeout(() => {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    }, 300);
  }

  deleteNode(id, options = {}) {
    const node = this.getNodeById(id);
    if (!node) return false;

    const originLayers = this.getLayers().filter(layer => layer.originNodeId === id);
    if (originLayers.length) {
      const action = options.originLayerAction || 'detach';
      if (action === 'cancel') return false;
      if (action === 'delete-layers') {
        originLayers.forEach(layer => this._deleteLayer(layer.id, { deferSave: true }));
      } else {
        originLayers.forEach(layer => {
          layer.originNodeId = null;
          layer.titleMode = 'custom';
          layer.title = node.title || layer.fallbackTitle || 'Warstwa';
          layer.fallbackTitle = layer.title;
          layer.updatedAt = new Date().toISOString();
        });
      }
    }

    this.state.nodes = this.state.nodes.filter(item => item.id !== id);
    this.state.links = this.state.links.filter(link => {
      const source = getEndpointId(link.source);
      const target = getEndpointId(link.target);
      return source !== id && target !== id;
    });
    this.save();
    return true;
  }

  addLink(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return false;
    const exists = this.state.links.find(link => {
      const source = getEndpointId(link.source);
      const target = getEndpointId(link.target);
      return (source === sourceId && target === targetId) || (source === targetId && target === sourceId);
    });
    if (exists) return false;
    this.state.links.push({ source: sourceId, target: targetId });
    this.save();
    return true;
  }

  deleteLink(sourceId, targetId) {
    this.state.links = this.state.links.filter(link => {
      const source = getEndpointId(link.source);
      const target = getEndpointId(link.target);
      return !(source === sourceId && target === targetId) && !(source === targetId && target === sourceId);
    });
    this.save();
  }

  deleteLinksBetween(ids) {
    const selected = new Set(ids);
    this.state.links = this.state.links.filter(link => {
      const source = getEndpointId(link.source);
      const target = getEndpointId(link.target);
      return !(selected.has(source) && selected.has(target));
    });
    this.save();
  }

  clearAll() {
    this.storage.removeItem(STORAGE_KEY);
    this.state = emptyState();
    this._notify();
  }

  addStroke(stroke) {
    const scope = this.getCurrentScope();
    const item = {
      id: uuid(),
      points: stroke.points,
      color: stroke.color || '#ffffff',
      width: stroke.width || 2,
      scope: scope.type,
      projectId: scope.type === 'project' ? scope.projectId : null,
      layerId: scope.type === 'layer' ? scope.layerId : null,
      createdAt: new Date().toISOString(),
    };

    if (!this.state.strokes) this.state.strokes = [];
    this.state.strokes.push(item);
    this.save();
    return item;
  }

  undoStroke() {
    const visible = new Set(this.getVisibleStrokes().map(stroke => stroke.id));
    for (let i = this.state.strokes.length - 1; i >= 0; i -= 1) {
      if (visible.has(this.state.strokes[i].id)) {
        this.state.strokes.splice(i, 1);
        this.save();
        return true;
      }
    }
    return false;
  }

  clearStrokes(options = {}) {
    const scope = options.scope || this.getCurrentScope();
    this.state.strokes = this.getStrokes().filter(stroke => !strokeMatchesScope(stroke, scope));
    this.save();
  }

  clearAllStrokes() {
    this.state.strokes = [];
    this.save();
  }

  addInboxMessage(text) {
    const clean = cleanText(text);
    if (!clean) return null;
    const now = new Date().toISOString();
    const message = {
      id: uuid(),
      text: clean,
      createdAt: now,
    };
    if (!this.state.inboxMessages) this.state.inboxMessages = [];
    this.state.inboxMessages.push(message);
    this.save();
    return message;
  }

  deleteInboxMessage(id) {
    const before = this.getInboxMessages().length;
    this.state.inboxMessages = this.getInboxMessages().filter(message => message.id !== id);
    if (this.state.inboxMessages.length === before) return false;
    this.save();
    return true;
  }

  copyInboxContext(options = {}) {
    const messages = options.onlyUncopied
      ? this.getInboxMessages().filter(message => !message.copiedAt)
      : this.getInboxMessages();
    const payload = {
      schema: 'cortex.inbox.v1',
      purpose: 'Szybki inbox Cortex: surowe mysli do przetworzenia przez AI albo uzytkownika.',
      messages: messages.map(message => ({
        id: message.id,
        text: message.text,
        createdAt: message.createdAt,
      })),
    };

    if (options.markCopied && messages.length) {
      const copiedAt = new Date().toISOString();
      const ids = new Set(messages.map(message => message.id));
      this.state.inboxMessages = this.getInboxMessages().map(message => (
        ids.has(message.id) ? { ...message, copiedAt } : message
      ));
      this.save();
    }

    return [
      'CORTEX_INBOX_CONTEXT',
      'Traktuj te wpisy jako szybkie, surowe notatki z zakladki. Nie sa jeszcze planem.',
      JSON.stringify(payload, null, 2),
    ].join('\n\n');
  }

  selectNodesInRect(rect) {
    const left = Math.min(Number(rect?.left) || 0, Number(rect?.right) || 0);
    const right = Math.max(Number(rect?.left) || 0, Number(rect?.right) || 0);
    const top = Math.min(Number(rect?.top) || 0, Number(rect?.bottom) || 0);
    const bottom = Math.max(Number(rect?.top) || 0, Number(rect?.bottom) || 0);
    return this.getVisibleNodes()
      .filter(node => rectsIntersect(getNodeBounds(node), { left, top, right, bottom }))
      .map(node => node.id);
  }

  moveNodesBy(nodeIds, dx, dy) {
    const ids = new Set(Array.isArray(nodeIds) ? nodeIds : []);
    if (!ids.size) return [];
    const deltaX = Number(dx) || 0;
    const deltaY = Number(dy) || 0;
    const now = new Date().toISOString();
    const moved = [];

    this.state.nodes.forEach(node => {
      if (!ids.has(node.id)) return;
      node.x = (Number(node.x) || 0) + deltaX;
      node.y = (Number(node.y) || 0) + deltaY;
      node.updatedAt = now;
      moved.push(node.id);
    });

    if (moved.length) this.save();
    return moved;
  }

  parkNode(id) {
    if (!this.state.parking) this.state.parking = [];
    const node = this.state.nodes.find(item => item.id === id);
    if (node) {
      this.state.parking.push({ ...node, parkedAt: new Date().toISOString() });
      this.deleteNode(id);
    }
  }

  restoreNode(id) {
    const idx = this.state.parking.findIndex(node => node.id === id);
    if (idx !== -1) {
      const node = this.state.parking.splice(idx, 1)[0];
      delete node.parkedAt;
      this.state.nodes.push(node);
      this.save();
    }
  }

  importData(data) {
    if (data?.schema && String(data.schema).startsWith('cortex.visible')) {
      console.warn('Semantic AI exports are read-only context and cannot replace the editable Cortex database.');
      return false;
    }

    if (data && data.nodes && data.links) {
      this.state = migrateState({
        ...data,
        categories: data.categories || this.state.categories,
        projects: data.projects || this.state.projects,
        layers: data.layers || this.state.layers,
        activeProjectId: data.activeProjectId || this.state.activeProjectId,
        activeLayerId: data.activeLayerId || this.state.activeLayerId,
      });
      this.save();
      return true;
    }
    return false;
  }

  createProject(name) {
    const cleanName = String(name || '').trim();
    if (!cleanName) return null;

    const now = new Date().toISOString();
    const project = {
      id: uuid(),
      name: cleanName,
      createdAt: now,
      updatedAt: now,
    };
    this.state.projects.push(project);
    this.state.activeProjectId = project.id;
    this.state.activeLayerId = ROOT_LAYER_ID;
    this.save();
    return project;
  }

  renameProject(id, name) {
    const project = this.getProjectById(id);
    const cleanName = String(name || '').trim();
    if (!project || !cleanName) return false;
    project.name = cleanName;
    project.updatedAt = new Date().toISOString();
    this.save();
    return true;
  }

  deleteProject(id) {
    const project = this.getProjectById(id);
    if (!project) return false;
    this.state.projects = this.state.projects.filter(item => item.id !== id);
    this.state.nodes.forEach(node => {
      if (node.projectId === id) {
        node.projectId = null;
        node.updatedAt = new Date().toISOString();
      }
    });
    this.state.layers.forEach(layer => {
      if (layer.projectId === id) layer.projectId = null;
    });
    this.state.strokes = this.getStrokes().filter(stroke => !(stroke.scope === 'project' && stroke.projectId === id));
    if (this.state.activeProjectId === id) this.state.activeProjectId = 'all';
    this.save();
    return true;
  }

  setActiveProjectId(id) {
    this.state.activeProjectId = id || 'all';
    if (this.state.activeProjectId !== 'all' && this.state.activeProjectId !== 'dirty') {
      this.state.activeLayerId = ROOT_LAYER_ID;
    }
    this.save();
  }

  assignNodeToProject(nodeId, projectId) {
    return this.assignNodesToProject([nodeId], projectId);
  }

  assignNodesToProject(nodeIds, projectId, options = {}) {
    const ids = options.includeConnected ? this.expandConnectedIds(nodeIds) : new Set(nodeIds);
    const normalized = normalizeProjectValue(projectId);
    this.state.nodes.forEach(node => {
      if (ids.has(node.id)) {
        node.projectId = normalized;
        node.updatedAt = new Date().toISOString();
      }
    });
    this.save();
    return [...ids];
  }

  expandConnectedIds(nodeIds) {
    const result = new Set(nodeIds);
    let changed = true;
    while (changed) {
      changed = false;
      for (const link of this.state.links) {
        const source = getEndpointId(link.source);
        const target = getEndpointId(link.target);
        if (result.has(source) && !result.has(target)) {
          result.add(target);
          changed = true;
        }
        if (result.has(target) && !result.has(source)) {
          result.add(source);
          changed = true;
        }
      }
    }
    return result;
  }

  setNodeStage(nodeId, stage, planKind = '') {
    const nextStage = stage === 'plan' ? 'plan' : 'robocze';
    const planKindIds = new Set((this.state.semanticConfig?.planKinds || []).map(kind => kind.id));
    PLAN_KINDS.forEach(kind => planKindIds.add(kind));
    const nextKind = nextStage === 'plan' && planKindIds.has(planKind) ? planKind : '';
    return this.updateNode(nodeId, { stage: nextStage, planKind: nextKind });
  }

  setNodePriority(nodeId, priority) {
    return this.updateNode(nodeId, { priority: clampPriority(priority) });
  }

  setNodeRawState(nodeId, rawState) {
    const allowed = ['raw', 'extracted', 'hidden', 'archived'];
    return this.updateNode(nodeId, { rawState: allowed.includes(rawState) ? rawState : 'raw' });
  }

  updateSemanticConfig(config = {}) {
    const current = this.state.semanticConfig || {};
    this.state.semanticConfig = {
      ...current,
      ...config,
      rawStates: {
        ...(current.rawStates || {}),
        ...(config.rawStates || {}),
      },
      stages: {
        ...(current.stages || {}),
        ...(config.stages || {}),
      },
      planKinds: Array.isArray(config.planKinds) ? config.planKinds : current.planKinds,
    };
    this.save();
    return this.state.semanticConfig;
  }

  createLayerFromNode(nodeId) {
    const node = this.getNodeById(nodeId);
    if (!node) return null;
    const existing = this.getLayers().find(layer => layer.originNodeId === nodeId);
    if (existing) return existing;

    const now = new Date().toISOString();
    const layer = {
      id: uuid(),
      parentLayerId: node.layerId || this.getActiveLayerId(),
      originNodeId: nodeId,
      titleMode: 'bound',
      title: '',
      fallbackTitle: node.title || 'Warstwa',
      projectId: node.projectId || null,
      createdAt: now,
      updatedAt: now,
    };
    this.state.layers.push(layer);
    this.save();
    return layer;
  }

  setActiveLayerId(id) {
    const nextId = this.getLayerById(id) ? id : ROOT_LAYER_ID;
    this.state.activeLayerId = nextId;
    if (nextId !== ROOT_LAYER_ID) this.state.activeProjectId = 'all';
    this.save();
  }

  backToParentLayer() {
    const active = this.getLayerById(this.getActiveLayerId());
    const nextLayerId = active?.parentLayerId || ROOT_LAYER_ID;

    let targetProjectId = null;
    if (nextLayerId === ROOT_LAYER_ID && active?.originNodeId) {
      const originNode = this.getNodeById(active.originNodeId);
      if (originNode && originNode.projectId) {
        targetProjectId = originNode.projectId;
      }
    }

    this.setActiveLayerId(nextLayerId);

    if (targetProjectId) {
      this.state.activeProjectId = targetProjectId;
      this.save();
    }
  }

  getLayerTitle(id) {
    const layer = this.getLayerById(id);
    return resolveLayerTitle(layer, this.state);
  }

  getActiveLayerPath() {
    return buildLayerPath(this.getActiveLayerId(), this.state);
  }

  getLayerPreview(originNodeIdOrLayerId) {
    const layer = this.getLayerById(originNodeIdOrLayerId) ||
      this.getLayers().find(item => item.originNodeId === originNodeIdOrLayerId);
    if (!layer) return null;

    const items = this.state.nodes
      .filter(node => (node.layerId || ROOT_LAYER_ID) === layer.id)
      .sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0))
      .map(node => ({
        id: node.id,
        title: node.title || node.content || node.id,
        type: node.type,
        rawState: node.rawState || 'raw',
        x: Number(node.x) || 0,
        y: Number(node.y) || 0,
      }));

    const itemIds = new Set(items.map(item => item.id));
    const connections = this.state.links
      .map(link => {
        const source = getEndpointId(link.source);
        const target = getEndpointId(link.target);
        return itemIds.has(source) && itemIds.has(target) ? { source, target } : null;
      })
      .filter(Boolean);

    return {
      layerId: layer.id,
      title: resolveLayerTitle(layer, this.state),
      originNodeId: layer.originNodeId || null,
      counts: {
        items: items.length,
        connections: connections.length,
      },
      items,
      connections,
    };
  }

  renameLayer(id, title) {
    const layer = this.getLayerById(id);
    const cleanTitle = String(title || '').trim();
    if (!layer || !cleanTitle || id === ROOT_LAYER_ID) return false;
    layer.title = cleanTitle;
    layer.fallbackTitle = cleanTitle;
    layer.titleMode = 'custom';
    layer.updatedAt = new Date().toISOString();
    this.save();
    return true;
  }

  deleteLayer(id) {
    return this._deleteLayer(id, { deferSave: false });
  }

  _deleteLayer(id, options = {}) {
    if (!id || id === ROOT_LAYER_ID || !this.getLayerById(id)) return false;
    const layerIds = this._collectLayerIds(id);
    const nodeIds = new Set(this.state.nodes.filter(node => layerIds.has(node.layerId)).map(node => node.id));

    this.state.layers = this.state.layers.filter(layer => !layerIds.has(layer.id));
    this.state.nodes = this.state.nodes.filter(node => !layerIds.has(node.layerId));
    this.state.links = this.state.links.filter(link => {
      const source = getEndpointId(link.source);
      const target = getEndpointId(link.target);
      return !nodeIds.has(source) && !nodeIds.has(target);
    });
    this.state.strokes = this.getStrokes().filter(stroke => !(stroke.scope === 'layer' && layerIds.has(stroke.layerId)));
    if (layerIds.has(this.state.activeLayerId)) this.state.activeLayerId = ROOT_LAYER_ID;

    if (!options.deferSave) this.save();
    return true;
  }

  _collectLayerIds(rootId) {
    const result = new Set([rootId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const layer of this.getLayers()) {
        if (layer.parentLayerId && result.has(layer.parentLayerId) && !result.has(layer.id)) {
          result.add(layer.id);
          changed = true;
        }
      }
    }
    return result;
  }

  buildSemanticExport(options = {}) {
    return buildSemanticExport(this.state, options);
  }

  buildSemanticContext(options = {}) {
    return buildSemanticContext(this.state, options);
  }

  exportData(options = {}) {
    const full = options.full === true;
    const data = full ? this.state : this.buildSemanticExport(options);
    const filenamePrefix = full ? 'cortex-backup' : 'cortex-ai';
    const blob = new Blob([JSON.stringify(data, null, full ? 2 : 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  getCategories() {
    if (!this.state.categories || this.state.categories.length === 0) {
      this.state.categories = this._defaultCategories();
    }
    return [...this.state.categories].sort((a, b) => a.order - b.order);
  }

  getDefaultCategoryId() {
    return this.getCategories().find(category => category.isDefault)?.id || this.getCategories()[0]?.id || 'rozrzutka';
  }

  getCategoryColor(type) {
    const cat = (this.state.categories || []).find(category => category.id === type);
    return cat ? cat.color : '#7c6cb5';
  }

  getCategoryName(type) {
    const cat = (this.state.categories || []).find(category => category.id === type);
    return cat ? cat.name : type;
  }

  addCategory(name, color, options = {}) {
    const id = categorySlug(name);
    const exists = (this.state.categories || []).find(category => category.id === id);
    if (!id || exists) return null;
    const maxOrder = Math.max(0, ...(this.state.categories || []).map(category => category.order));
    const cat = {
      id,
      name,
      color,
      order: maxOrder + 1,
      isDefault: options.isDefault === true,
      autoTitle: options.autoTitle || '',
    };
    if (cat.isDefault) this.state.categories.forEach(category => { category.isDefault = false; });
    this.state.categories.push(cat);
    this.save();
    return cat;
  }

  updateCategory(id, data) {
    const cat = (this.state.categories || []).find(category => category.id === id);
    if (!cat) return false;
    if (data.name !== undefined) cat.name = data.name;
    if (data.color !== undefined) cat.color = data.color;
    if (data.order !== undefined) cat.order = data.order;
    if (data.autoTitle !== undefined) cat.autoTitle = data.autoTitle;
    if (data.isDefault === true) {
      this.state.categories.forEach(category => { category.isDefault = category.id === id; });
    }
    this.save();
    return true;
  }

  deleteCategory(id) {
    if ((this.state.categories || []).length <= 1) return false;
    this.state.categories = this.state.categories.filter(category => category.id !== id);
    const fallback = this.getDefaultCategoryId();
    this.state.nodes.forEach(node => {
      if (node.type === id) node.type = fallback;
    });
    this.save();
    return true;
  }

  reorderCategories(orderedIds) {
    orderedIds.forEach((id, index) => {
      const cat = this.state.categories.find(category => category.id === id);
      if (cat) cat.order = index;
    });
    this.save();
  }

  addPlanKind(id, label) {
    const cleanId = String(id || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    const cleanLabel = String(label || '').trim() || cleanId;
    if (!cleanId) return null;

    const config = this.getSemanticConfig();
    const planKinds = [...(config.planKinds || [])];
    if (planKinds.find(kind => kind.id === cleanId)) return null;

    planKinds.push({ id: cleanId, label: cleanLabel });
    this.updateSemanticConfig({ planKinds });
    return { id: cleanId, label: cleanLabel };
  }

  updatePlanKind(oldId, newId, newLabel) {
    const config = this.getSemanticConfig();
    const planKinds = [...(config.planKinds || [])];
    const kindIndex = planKinds.findIndex(k => k.id === oldId);
    if (kindIndex === -1) return false;

    const cleanNewId = String(newId || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    const finalId = cleanNewId || oldId;
    
    if (finalId !== oldId && planKinds.find(k => k.id === finalId)) {
      return false; // Duplicate ID
    }

    const cleanLabel = String(newLabel || '').trim() || finalId;
    
    planKinds[kindIndex] = { id: finalId, label: cleanLabel };
    this.updateSemanticConfig({ planKinds });

    if (finalId !== oldId) {
      this.state.nodes.forEach(node => {
        if (node.planKind === oldId) {
          node.planKind = finalId;
          node.updatedAt = new Date().toISOString();
        }
      });
      this.save();
    }

    return true;
  }

  deletePlanKind(id) {
    const config = this.getSemanticConfig();
    const planKinds = (config.planKinds || []).filter(k => k.id !== id);
    if (planKinds.length === (config.planKinds || []).length) return false;

    // Reset notes that use this planKind to empty string
    this.state.nodes.forEach(node => {
      if (node.planKind === id) {
        node.planKind = '';
        node.updatedAt = new Date().toISOString();
      }
    });

    this.updateSemanticConfig({ planKinds });
    return true;
  }

  reorderPlanKinds(orderedIds) {
    const config = this.getSemanticConfig();
    const planKinds = [...(config.planKinds || [])];
    const newPlanKinds = [];
    
    orderedIds.forEach(id => {
      const kind = planKinds.find(k => k.id === id);
      if (kind) newPlanKinds.push(kind);
    });

    // Add any missing ones at the end
    planKinds.forEach(kind => {
      if (!newPlanKinds.find(k => k.id === kind.id)) {
        newPlanKinds.push(kind);
      }
    });

    this.updateSemanticConfig({ planKinds: newPlanKinds });
  }

  _projectIdForNewNode() {
    const active = this.state.activeProjectId || 'all';
    if (active !== 'all' && active !== 'dirty') return active;
    const activeLayer = this.getLayerById(this.getActiveLayerId());
    return activeLayer?.projectId || null;
  }
}

function normalizeProjectValue(projectId) {
  return projectId && projectId !== 'dirty' && projectId !== 'all' ? projectId : null;
}

function clampPriority(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.max(1, Math.min(10, number)) : 1;
}

function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getNodeBounds(node) {
  const scale = Number.isFinite(Number(node.cardScale)) ? Number(node.cardScale) : 1;
  const isScreen = Boolean(node.image || node.imageDescription || node.imageWidth || node.imageHeight);
  const width = isScreen ? (Number(node.imageWidth) || 400) * scale : 240 * scale;
  let height = isScreen ? (Number(node.imageHeight) || 300) * scale : 80 * scale;
  if (node.rawState === 'hidden') height = Math.min(height, 38);

  const left = Number(node.x) || 0;
  const top = Number(node.y) || 0;
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
  };
}

function rectsIntersect(a, b) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createMemoryStorage() {
  let value = null;
  return {
    getItem() { return value; },
    setItem(_key, next) { value = next; },
    removeItem() { value = null; },
  };
}

export const store = new Store();
