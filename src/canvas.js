import { COLORS, NOTE_CONFIG, CANVAS_CONFIG } from './constants.js';
import { store } from './store.js';
import { drawing } from './drawing.js';
import { getEndpointId } from './schema.js';

/**
 * Infinite Canvas — SVG-based pan/zoom/drag engine.
 * Replaces D3 force-directed graph entirely.
 * Nodes have fixed X,Y positions — no physics, no simulation.
 */
class Canvas {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.onNoteClickCallback = null;
    this.onNoteDblClickCallback = null;
    this.onBackgroundClickCallback = null;
    this.onBackgroundDblClickCallback = null;

    // Transform state
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // Interaction state
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.draggedNoteId = null;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.dragGroupIds = [];
    this.dragGroupStartPositions = new Map();
    this.dragStartWorld = null;

    // Selection
    this.selectedIds = new Set();
    this.isRectSelecting = false;
    this.selectionStartWorld = null;
    this.selectionRectEl = null;
    this._suppressNextBackgroundClick = false;
    this._layerPreviewEl = null;

    // Linking
    this.isLinking = false;
    this.linkSourceId = null;
    this.persistentLinking = false;
    this.linkLine = null;

    // Drawing
    this.isDrawing = false;

    // Expand
    this.isExpanded = false;
    this.savedPositions = new Map();

    this._init();
  }

  _init() {
    // Create SVG
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.style.display = 'block';
    this.svg.style.cursor = 'grab';
    this.container.appendChild(this.svg);

    // Main group (transformed)
    this.mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.mainGroup.setAttribute('id', 'canvas-main');
    this.svg.appendChild(this.mainGroup);

    // Layers inside main group
    this.gridLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.gridLayer.setAttribute('id', 'grid-layer');
    this.mainGroup.appendChild(this.gridLayer);

    this.linkLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.linkLayer.setAttribute('id', 'link-layer');
    this.mainGroup.appendChild(this.linkLayer);

    // Drawing layer — between links and notes
    this.drawingLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.drawingLayer.setAttribute('id', 'drawing-layer');
    this.mainGroup.appendChild(this.drawingLayer);

    this.selectionLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.selectionLayer.setAttribute('id', 'selection-layer');
    this.mainGroup.appendChild(this.selectionLayer);

    this.noteLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.noteLayer.setAttribute('id', 'note-layer');
    this.mainGroup.appendChild(this.noteLayer);

    // Attach drawing module
    drawing.attach(this, this.drawingLayer);

    // Temp link line (for linking mode preview)
    this.linkPreview = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.linkPreview.setAttribute('stroke', COLORS.accent);
    this.linkPreview.setAttribute('stroke-width', '2');
    this.linkPreview.setAttribute('stroke-dasharray', '6 4');
    this.linkPreview.setAttribute('opacity', '0');
    this.mainGroup.appendChild(this.linkPreview);

    this._setupEvents();
    this._updateTransform();
  }

  _setupEvents() {
    // Wheel = zoom or card resize
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();

      // Ctrl+Scroll on card = resize card(s)
      if (e.ctrlKey || e.metaKey) {
        const target = e.target.closest('.note-card-group');
        if (target) {
          const id = target.dataset.id;
          const ids = this.selectedIds.has(id) ? [...this.selectedIds] : [id];
          const delta = e.deltaY < 0 ? 0.05 : -0.05;
          ids.forEach(nid => {
            const node = store.getNodeById(nid);
            if (node) {
              node.cardScale = Math.max(0.5, Math.min(3, (node.cardScale || 1) + delta));
              store.updateNode(nid, { cardScale: node.cardScale });
            }
          });
          this.render();
          // Debounced overlap resolution
          clearTimeout(this._resolveSizeTimer);
          this._resolveSizeTimer = setTimeout(() => this._resolveOverlaps(), 400);
          return;
        }
      }

      const rect = this.svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.93;
      const newScale = Math.max(
        CANVAS_CONFIG.zoomRange[0],
        Math.min(CANVAS_CONFIG.zoomRange[1], this.scale * zoomFactor)
      );

      const scaleDiff = newScale / this.scale;
      this.offsetX = mx - (mx - this.offsetX) * scaleDiff;
      this.offsetY = my - (my - this.offsetY) * scaleDiff;
      this.scale = newScale;

      this._updateTransform();
      this._updateSemanticZoom();
    }, { passive: false });

    // Mouse down — start pan, drag, or draw
    this.svg.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;

      // Drawing mode takes priority
      if (this.isDrawing) {
        drawing.startStroke(e.clientX, e.clientY);
        return;
      }

      const target = e.target;
      const noteEl = target.closest('.note-card-group');

      if (noteEl) {
        const id = noteEl.dataset.id;
        if (this.isLinking) {
          this._handleLinkClick(id);
          return;
        }
        e.stopPropagation();
        const node = store.getNodeById(id);
        if (!node) return;
        this.draggedNoteId = id;
        const worldPos = this._screenToWorld(e.clientX, e.clientY);
        this.dragStartWorld = worldPos;
        this.dragGroupIds = this.selectedIds.has(id) ? [...this.selectedIds] : [id];
        this.dragGroupStartPositions.clear();
        this.dragGroupIds.forEach(groupId => {
          const groupNode = store.getNodeById(groupId);
          if (groupNode) this.dragGroupStartPositions.set(groupId, { x: groupNode.x, y: groupNode.y });
        });
        this.dragOffsetX = worldPos.x - node.x;
        this.dragOffsetY = worldPos.y - node.y;
        this.svg.style.cursor = 'grabbing';
        this._dragStartTime = Date.now();
        this._dragMoved = false;
      } else if (target === this.svg || target === this.mainGroup || target.closest('#grid-layer') || target.closest('#link-layer') || target.closest('#drawing-layer')) {
        if (this.isLinking) return;
        if (e.shiftKey) {
          this._startRectSelection(e);
          return;
        }
        this.isPanning = true;
        this.panStartX = e.clientX - this.offsetX;
        this.panStartY = e.clientY - this.offsetY;
        this.svg.style.cursor = 'grabbing';
      }
    });

    this.svg.addEventListener('mousemove', (e) => {
      // Drawing mode
      if (this.isDrawing && drawing.currentStroke) {
        drawing.addPoint(e.clientX, e.clientY);
        return;
      }

      if (this.isPanning) {
        this.offsetX = e.clientX - this.panStartX;
        this.offsetY = e.clientY - this.panStartY;
        this._updateTransform();
      } else if (this.isRectSelecting) {
        this._updateRectSelection(e);
      } else if (this.draggedNoteId) {
        this._dragMoved = true;
        const worldPos = this._screenToWorld(e.clientX, e.clientY);
        if (this.dragGroupIds.length > 1 && this.dragStartWorld) {
          const dx = worldPos.x - this.dragStartWorld.x;
          const dy = worldPos.y - this.dragStartWorld.y;
          this.dragGroupIds.forEach(id => {
            const start = this.dragGroupStartPositions.get(id);
            if (!start) return;
            const nx = start.x + dx;
            const ny = start.y + dy;
            store.updateNodePosition(id, nx, ny);
            this._moveNote(id, nx, ny);
            this._updateLinksForNode(id);
          });
        } else {
          const nx = worldPos.x - this.dragOffsetX;
          const ny = worldPos.y - this.dragOffsetY;
          store.updateNodePosition(this.draggedNoteId, nx, ny);
          this._moveNote(this.draggedNoteId, nx, ny);
          this._updateLinksForNode(this.draggedNoteId);
        }
      }

      if (this.isLinking && this.linkSourceId) {
        const srcNode = store.getNodeById(this.linkSourceId);
        if (srcNode) {
          const worldPos = this._screenToWorld(e.clientX, e.clientY);
          this.linkPreview.setAttribute('x1', srcNode.x + NOTE_CONFIG.width / 2);
          this.linkPreview.setAttribute('y1', srcNode.y + NOTE_CONFIG.minHeight / 2);
          this.linkPreview.setAttribute('x2', worldPos.x);
          this.linkPreview.setAttribute('y2', worldPos.y);
          this.linkPreview.setAttribute('opacity', '0.7');
        }
      }
    });

    this.svg.addEventListener('mouseup', (e) => {
      // End drawing stroke
      if (this.isDrawing && drawing.currentStroke) {
        drawing.endStroke();
        return;
      }

      if (this.isPanning) {
        this.isPanning = false;
        this.svg.style.cursor = this._getCursor();
      } else if (this.isRectSelecting) {
        this._finishRectSelection();
        this.svg.style.cursor = this._getCursor();
      } else if (this.draggedNoteId) {
        const wasClick = !this._dragMoved && (Date.now() - this._dragStartTime) < 250;
        if (wasClick) {
          if (e.shiftKey) {
            this._toggleSelection(this.draggedNoteId);
          } else if (this.onNoteClickCallback) {
            this.onNoteClickCallback(this.draggedNoteId);
          }
        }
        this.draggedNoteId = null;
        this.dragGroupIds = [];
        this.dragGroupStartPositions.clear();
        this.dragStartWorld = null;
        this.svg.style.cursor = this._getCursor();
      }
    });

    // Click on empty space
    this.svg.addEventListener('click', (e) => {
      if (this._suppressNextBackgroundClick) {
        this._suppressNextBackgroundClick = false;
        return;
      }
      const target = e.target;
      if (target === this.svg || target.closest('#grid-layer')) {
        if (this.onBackgroundClickCallback) this.onBackgroundClickCallback();
      }
    });

    // Double-click on empty space — create note
    this.svg.addEventListener('dblclick', (e) => {
      const target = e.target;
      const noteEl = target.closest('.note-card-group');

      if (noteEl) {
        // Double-click on note
        if (this.onNoteDblClickCallback) {
          this.onNoteDblClickCallback(noteEl.dataset.id);
        }
        return;
      }

      if (target === this.svg || target.closest('#grid-layer') || target === this.mainGroup) {
        const worldPos = this._screenToWorld(e.clientX, e.clientY);
        if (this.onBackgroundDblClickCallback) {
          this.onBackgroundDblClickCallback(worldPos.x, worldPos.y);
        }
      }
    });

    // Keyboard
    window.addEventListener('keydown', (e) => {
      // Skip if user is typing in an input/textarea
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Tab') {
        e.preventDefault();
        this.toggleLinkingMode();
      }
      if (e.key === 'Escape') {
        if (this.isDrawing) this.toggleDrawingMode();
        else if (this.isLinking) this.cancelLinking();
        else if (this.isExpanded) this.toggleExpandAll();
      }
      if (e.key === 'd' || e.key === 'D') {
        if (!this.isExpanded) this.toggleDrawingMode();
      }
      if (e.key === 'e' || e.key === 'E') {
        if (!this.isDrawing) this.toggleExpandAll();
      }
      if (e.key === 'x' || e.key === 'X') {
        if (this.isDrawing) drawing.toggleEraser();
      }
      if (e.key === '[') {
        if (this.isDrawing) drawing.changeBrushSize(-1);
      }
      if (e.key === ']') {
        if (this.isDrawing) drawing.changeBrushSize(1);
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        if (this.isDrawing) {
          e.preventDefault();
          drawing.undo();
        }
      }
    });
  }

  _startRectSelection(e) {
    const worldPos = this._screenToWorld(e.clientX, e.clientY);
    this.isRectSelecting = true;
    this.selectionStartWorld = worldPos;
    this._suppressNextBackgroundClick = true;
    this.selectionLayer.innerHTML = '';

    this.selectionRectEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    this.selectionRectEl.classList.add('selection-rect');
    this.selectionRectEl.setAttribute('x', worldPos.x);
    this.selectionRectEl.setAttribute('y', worldPos.y);
    this.selectionRectEl.setAttribute('width', '0');
    this.selectionRectEl.setAttribute('height', '0');
    this.selectionRectEl.style.pointerEvents = 'none';
    this.selectionLayer.appendChild(this.selectionRectEl);
    this.svg.style.cursor = 'crosshair';
  }

  _updateRectSelection(e) {
    if (!this.selectionRectEl || !this.selectionStartWorld) return;
    const current = this._screenToWorld(e.clientX, e.clientY);
    const rect = normalizeRect(this.selectionStartWorld, current);
    this.selectionRectEl.setAttribute('x', rect.left);
    this.selectionRectEl.setAttribute('y', rect.top);
    this.selectionRectEl.setAttribute('width', rect.right - rect.left);
    this.selectionRectEl.setAttribute('height', rect.bottom - rect.top);
  }

  _finishRectSelection() {
    if (!this.selectionStartWorld) return;
    const x = Number(this.selectionRectEl?.getAttribute('x')) || this.selectionStartWorld.x;
    const y = Number(this.selectionRectEl?.getAttribute('y')) || this.selectionStartWorld.y;
    const width = Number(this.selectionRectEl?.getAttribute('width')) || 0;
    const height = Number(this.selectionRectEl?.getAttribute('height')) || 0;
    const selected = width < 4 && height < 4
      ? []
      : store.selectNodesInRect({ left: x, top: y, right: x + width, bottom: y + height });

    this.isRectSelecting = false;
    this.selectionStartWorld = null;
    this.selectionLayer.innerHTML = '';
    this.selectionRectEl = null;
    this.selectedIds = new Set(selected);
    this.render();
    this._emitSelectionChanged();
  }

  // --- Mode Helpers ---

  _getCursor() {
    if (this.isDrawing) return 'crosshair';
    if (this.isLinking) return 'crosshair';
    return 'grab';
  }

  toggleDrawingMode() {
    this.isDrawing = !this.isDrawing;
    if (this.isDrawing) {
      drawing.enable();
    } else {
      drawing.disable();
    }
    this.svg.style.cursor = this._getCursor();
    window.dispatchEvent(new CustomEvent('drawing-changed', { detail: { active: this.isDrawing } }));
  }

  // --- Expand All ---

  toggleExpandAll() {
    if (this.isExpanded) {
      this._collapseAll();
    } else {
      this._expandAll();
    }
  }

  _expandAll() {
    const nodes = store.getVisibleNodes();
    if (nodes.length === 0) return;

    // Save original positions
    this.savedPositions.clear();
    nodes.forEach(n => {
      this.savedPositions.set(n.id, { x: n.x, y: n.y });
    });

    // Calculate expanded heights for each node
    const expandedHeights = new Map();
    nodes.forEach(n => {
      if (n.rawState === 'hidden') {
        expandedHeights.set(n.id, 38);
        return;
      }
      const lines = (n.content || '').split('\n');
      let totalLines = 0;
      lines.forEach(line => {
        totalLines += Math.max(1, Math.ceil(line.length / NOTE_CONFIG.charsPerLine));
      });
      // Height: type label (20) + title (20) + content lines + padding
      const h = 20 + 20 + totalLines * NOTE_CONFIG.lineHeight + 20;
      expandedHeights.set(n.id, Math.max(NOTE_CONFIG.minHeight, h));
    });

    // Sort by Y then X (top-left first)
    const sorted = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x);
    const gap = NOTE_CONFIG.expandGap;
    const w = NOTE_CONFIG.width;

    // Sweep-line: push overlapping notes downward
    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i];
      const curH = expandedHeights.get(cur.id);

      for (let j = 0; j < i; j++) {
        const prev = sorted[j];
        const prevH = expandedHeights.get(prev.id);

        // Check X overlap (horizontal band intersection)
        const xOverlap = cur.x < prev.x + w + gap && cur.x + w + gap > prev.x;
        if (!xOverlap) continue;

        // Check Y overlap
        const minY = prev.y + prevH + gap;
        if (cur.y < minY) {
          cur.y = minY;
        }
      }
    }

    // Apply expanded positions and re-render expanded
    sorted.forEach(n => {
      store.updateNodePosition(n.id, n.x, n.y);
    });

    this.isExpanded = true;
    this._renderExpanded(expandedHeights);
    window.dispatchEvent(new CustomEvent('expand-changed', { detail: { expanded: true } }));
  }

  _collapseAll() {
    // Restore original positions
    this.savedPositions.forEach((pos, id) => {
      store.updateNodePosition(id, pos.x, pos.y);
      const node = store.getNodeById(id);
      if (node) { node.x = pos.x; node.y = pos.y; }
    });
    this.savedPositions.clear();
    this.isExpanded = false;
    this.render();
    window.dispatchEvent(new CustomEvent('expand-changed', { detail: { expanded: false } }));
  }

  _renderExpanded(expandedHeights) {
    const nodes = store.getVisibleNodes();
    const links = store.getVisibleLinks();

    this.linkLayer.innerHTML = '';
    this.noteLayer.innerHTML = '';

    // Render links (use expanded heights for center calc)
    links.forEach(link => {
      const sourceId = getEndpointId(link.source);
      const targetId = getEndpointId(link.target);
      const src = nodes.find(n => n.id === sourceId);
      const tgt = nodes.find(n => n.id === targetId);
      if (!src || !tgt) return;

      const srcH = expandedHeights.get(src.id) || NOTE_CONFIG.minHeight;
      const tgtH = expandedHeights.get(tgt.id) || NOTE_CONFIG.minHeight;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('canvas-link');
      line.setAttribute('x1', src.x + NOTE_CONFIG.width / 2);
      line.setAttribute('y1', src.y + srcH / 2);
      line.setAttribute('x2', tgt.x + NOTE_CONFIG.width / 2);
      line.setAttribute('y2', tgt.y + tgtH / 2);
      line.setAttribute('stroke', COLORS.border);
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('stroke-opacity', '0.4');
      this.linkLayer.appendChild(line);
    });

    // Render expanded notes
    nodes.forEach(node => {
      const h = expandedHeights.get(node.id) || NOTE_CONFIG.minHeight;
      this._renderNoteExpanded(node, h);
    });
  }

  _renderNoteExpanded(node, h) {
    const isHidden = node.rawState === 'hidden';
    const isArchived = node.rawState === 'archived';
    const cardHeight = isHidden ? 38 : h;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('note-card-group');
    if (isHidden) g.classList.add('is-hidden');
    if (isArchived) g.classList.add('is-archived');
    g.dataset.id = node.id;
    g.dataset.hidden = String(isHidden);
    g.dataset.baseHeight = String(cardHeight);
    g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
    g.style.opacity = this._nodeVisualOpacity(node);

    const color = store.getCategoryColor(node.type);
    const w = NOTE_CONFIG.width;

    // Card background
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('note-bg');
    rect.setAttribute('width', w);
    rect.setAttribute('height', cardHeight);
    rect.setAttribute('rx', NOTE_CONFIG.borderRadius);
    rect.setAttribute('ry', NOTE_CONFIG.borderRadius);
    rect.setAttribute('fill', COLORS.surface);
    rect.setAttribute('stroke', COLORS.border);
    rect.setAttribute('stroke-width', '1');
    g.appendChild(rect);

    // Accent bar
    const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bar.setAttribute('x', '0');
    bar.setAttribute('y', '0');
    bar.setAttribute('width', NOTE_CONFIG.accentBarWidth);
    bar.setAttribute('height', cardHeight);
    bar.setAttribute('rx', '0');
    bar.setAttribute('fill', color);
    const clipId = `clip-exp-${node.id}`;
    const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clipPath.setAttribute('id', clipId);
    const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    clipRect.setAttribute('width', w);
    clipRect.setAttribute('height', cardHeight);
    clipRect.setAttribute('rx', NOTE_CONFIG.borderRadius);
    clipPath.appendChild(clipRect);
    g.appendChild(clipPath);
    bar.setAttribute('clip-path', `url(#${clipId})`);
    g.appendChild(bar);

    // Type label
    const typeLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    typeLabel.setAttribute('x', NOTE_CONFIG.padding + NOTE_CONFIG.accentBarWidth);
    typeLabel.setAttribute('y', '16');
    typeLabel.setAttribute('fill', color);
    typeLabel.setAttribute('font-size', '9');
    typeLabel.setAttribute('font-weight', '700');
    typeLabel.style.pointerEvents = 'none';
    typeLabel.style.userSelect = 'none';
    typeLabel.textContent = node.type.toUpperCase();
    g.appendChild(typeLabel);

    const priorityLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    priorityLabel.setAttribute('x', w - NOTE_CONFIG.padding);
    priorityLabel.setAttribute('y', '18');
    priorityLabel.setAttribute('fill', COLORS.textMuted);
    priorityLabel.setAttribute('font-size', '9');
    priorityLabel.setAttribute('font-weight', '700');
    priorityLabel.setAttribute('text-anchor', 'end');
    priorityLabel.style.pointerEvents = 'none';
    priorityLabel.style.userSelect = 'none';
    priorityLabel.textContent = `P${node.priority || 1}`;
    g.appendChild(priorityLabel);

    this._appendLayerBadge(g, node, w, cardHeight);

    if (node.stage === 'plan') {
      const stageLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      stageLabel.classList.add('note-stage-label');
      stageLabel.setAttribute('x', w - NOTE_CONFIG.padding);
      stageLabel.setAttribute('y', '18');
      stageLabel.setAttribute('fill', COLORS.accent);
      stageLabel.setAttribute('font-size', '9');
      stageLabel.setAttribute('font-weight', '700');
      stageLabel.setAttribute('text-anchor', 'end');
      stageLabel.style.pointerEvents = 'none';
      stageLabel.style.userSelect = 'none';
      stageLabel.textContent = 'PLAN';
      g.appendChild(stageLabel);
    }

    // Title
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', NOTE_CONFIG.padding + NOTE_CONFIG.accentBarWidth);
    title.setAttribute('y', isHidden ? '25' : '34');
    title.setAttribute('fill', COLORS.textPrimary);
    title.setAttribute('font-size', NOTE_CONFIG.titleFontSize);
    title.setAttribute('font-weight', '600');
    title.style.pointerEvents = 'none';
    title.style.userSelect = 'none';
    title.textContent = node.title;
    g.appendChild(title);

    // Full content (no truncation)
    if (node.content && !isHidden) {
      const allLines = node.content.split('\n');
      let yOffset = 52;
      allLines.forEach(rawLine => {
        // Word wrap
        const chunks = [];
        if (rawLine.length <= NOTE_CONFIG.charsPerLine) {
          chunks.push(rawLine || ' ');
        } else {
          for (let i = 0; i < rawLine.length; i += NOTE_CONFIG.charsPerLine) {
            chunks.push(rawLine.substring(i, i + NOTE_CONFIG.charsPerLine));
          }
        }
        chunks.forEach(chunk => {
          const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          txt.setAttribute('x', NOTE_CONFIG.padding + NOTE_CONFIG.accentBarWidth);
          txt.setAttribute('y', yOffset);
          txt.setAttribute('fill', COLORS.textSecondary);
          txt.setAttribute('font-size', NOTE_CONFIG.bodyFontSize);
          txt.style.pointerEvents = 'none';
          txt.style.userSelect = 'none';
          txt.textContent = chunk;
          g.appendChild(txt);
          yOffset += NOTE_CONFIG.lineHeight;
        });
      });
    }

    this.noteLayer.appendChild(g);
  }

  // --- Transform ---

  _updateTransform() {
    this.mainGroup.setAttribute('transform',
      `translate(${this.offsetX}, ${this.offsetY}) scale(${this.scale})`
    );
  }

  _screenToWorld(sx, sy) {
    const rect = this.svg.getBoundingClientRect();
    return {
      x: (sx - rect.left - this.offsetX) / this.scale,
      y: (sy - rect.top - this.offsetY) / this.scale,
    };
  }

  // --- Rendering ---

  render() {
    const nodes = store.getVisibleNodes();
    const links = store.getVisibleLinks();

    // Clear
    this.linkLayer.innerHTML = '';
    this.noteLayer.innerHTML = '';

    // Render links
    links.forEach(link => {
      const sourceId = getEndpointId(link.source);
      const targetId = getEndpointId(link.target);
      const src = nodes.find(n => n.id === sourceId);
      const tgt = nodes.find(n => n.id === targetId);
      if (!src || !tgt) return;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('canvas-link');
      line.dataset.source = sourceId;
      line.dataset.target = targetId;
      line.setAttribute('x1', src.x + NOTE_CONFIG.width / 2);
      line.setAttribute('y1', src.y + NOTE_CONFIG.minHeight / 2);
      line.setAttribute('x2', tgt.x + NOTE_CONFIG.width / 2);
      line.setAttribute('y2', tgt.y + NOTE_CONFIG.minHeight / 2);
      line.setAttribute('stroke', '#555560');
      line.setAttribute('stroke-width', '2.5');
      line.setAttribute('stroke-opacity', '0.7');

      // Hit area (invisible, thick)
      const hitLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      hitLine.classList.add('canvas-link-hit');
      hitLine.setAttribute('x1', src.x + NOTE_CONFIG.width / 2);
      hitLine.setAttribute('y1', src.y + NOTE_CONFIG.minHeight / 2);
      hitLine.setAttribute('x2', tgt.x + NOTE_CONFIG.width / 2);
      hitLine.setAttribute('y2', tgt.y + NOTE_CONFIG.minHeight / 2);
      hitLine.setAttribute('stroke', 'transparent');
      hitLine.setAttribute('stroke-width', '14');
      hitLine.style.cursor = 'pointer';

      hitLine.addEventListener('mouseenter', () => {
        line.setAttribute('stroke', '#ef4444');
        line.setAttribute('stroke-opacity', '0.9');
        line.setAttribute('stroke-width', '2.5');
      });
      hitLine.addEventListener('mouseleave', () => {
        line.setAttribute('stroke', '#555560');
        line.setAttribute('stroke-opacity', '0.7');
        line.setAttribute('stroke-width', '2.5');
      });
      hitLine.addEventListener('click', (e) => {
        e.stopPropagation();
        store.deleteLink(sourceId, targetId);
        this.render();
      });

      this.linkLayer.appendChild(line);
      this.linkLayer.appendChild(hitLine);
    });

    // Render notes
    nodes.forEach(node => {
      if (node.image) {
        this._renderScreenshotNote(node);
      } else {
        this._renderNote(node);
      }
    });

    this._updateSemanticZoom();

    // Re-render drawing strokes
    drawing.renderStored();
  }

  _renderNote(node) {
    const s = node.cardScale || 1;
    const isHidden = node.rawState === 'hidden';
    const isArchived = node.rawState === 'archived';
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('note-card-group');
    if (isHidden) g.classList.add('is-hidden');
    if (isArchived) g.classList.add('is-archived');
    g.dataset.id = node.id;
    g.dataset.hidden = String(isHidden);
    g.setAttribute('transform', `translate(${node.x}, ${node.y}) scale(${s})`);
    g.style.opacity = this._nodeVisualOpacity(node);

    const color = store.getCategoryColor(node.type);
    const w = NOTE_CONFIG.width;
    const h = isHidden ? 38 : NOTE_CONFIG.minHeight;
    g.dataset.baseHeight = String(h);

    // Card background
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('note-bg');
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('rx', NOTE_CONFIG.borderRadius);
    rect.setAttribute('ry', NOTE_CONFIG.borderRadius);
    rect.setAttribute('fill', COLORS.surface);
    rect.setAttribute('stroke', COLORS.border);
    rect.setAttribute('stroke-width', '1');
    g.appendChild(rect);

    // Accent bar (left side)
    const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bar.classList.add('note-accent-bar');
    bar.setAttribute('x', '0');
    bar.setAttribute('y', '0');
    bar.setAttribute('width', NOTE_CONFIG.accentBarWidth);
    bar.setAttribute('height', h);
    bar.setAttribute('rx', '0');
    bar.setAttribute('fill', color);
    // Clip to card shape
    const clipId = `clip-${node.id}`;
    const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clipPath.setAttribute('id', clipId);
    const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    clipRect.setAttribute('width', w);
    clipRect.setAttribute('height', h);
    clipRect.setAttribute('rx', NOTE_CONFIG.borderRadius);
    clipPath.appendChild(clipRect);
    g.appendChild(clipPath);
    bar.setAttribute('clip-path', `url(#${clipId})`);
    g.appendChild(bar);

    // Type label
    const typeLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    typeLabel.classList.add('note-type-label');
    typeLabel.setAttribute('x', NOTE_CONFIG.padding + NOTE_CONFIG.accentBarWidth);
    typeLabel.setAttribute('y', '18');
    typeLabel.setAttribute('fill', color);
    typeLabel.setAttribute('font-size', '9');
    typeLabel.setAttribute('font-weight', '700');
    typeLabel.setAttribute('letter-spacing', '0.05em');
    typeLabel.setAttribute('text-transform', 'uppercase');
    typeLabel.style.pointerEvents = 'none';
    typeLabel.style.userSelect = 'none';
    typeLabel.textContent = node.type.toUpperCase();
    g.appendChild(typeLabel);

    const priorityLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    priorityLabel.setAttribute('x', w - NOTE_CONFIG.padding);
    priorityLabel.setAttribute('y', '18');
    priorityLabel.setAttribute('fill', COLORS.textMuted);
    priorityLabel.setAttribute('font-size', '9');
    priorityLabel.setAttribute('font-weight', '700');
    priorityLabel.setAttribute('text-anchor', 'end');
    priorityLabel.style.pointerEvents = 'none';
    priorityLabel.style.userSelect = 'none';
    priorityLabel.textContent = node.stage === 'plan' ? `PLAN P${node.priority || 1}` : `P${node.priority || 1}`;
    g.appendChild(priorityLabel);

    this._appendLayerBadge(g, node, w, h);

    // Title + Content layout
    const hasTitle = node.title && node.title.trim().length > 0;
    let contentStartY = isHidden ? 0 : 54;

    if (hasTitle) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      title.classList.add('note-title');
      title.setAttribute('x', NOTE_CONFIG.padding + NOTE_CONFIG.accentBarWidth);
      title.setAttribute('y', isHidden ? '25' : '36');
      title.setAttribute('fill', COLORS.textPrimary);
      title.setAttribute('font-size', NOTE_CONFIG.titleFontSize);
      title.setAttribute('font-weight', '600');
      title.style.pointerEvents = 'none';
      title.style.userSelect = 'none';
      const truncTitle = node.title.length > 28 ? node.title.substring(0, 25) + '...' : node.title;
      title.textContent = truncTitle;
      g.appendChild(title);
    } else {
      // No title — content takes title's position
      contentStartY = isHidden ? 0 : 34;
    }

    // Content preview (truncated, 2-3 lines)
    if (node.content && !isHidden) {
      const maxLines = hasTitle ? 2 : 3;
      const contentLines = node.content.split('\n').slice(0, maxLines);
      contentLines.forEach((line, i) => {
        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.classList.add('note-content');
        txt.setAttribute('x', NOTE_CONFIG.padding + NOTE_CONFIG.accentBarWidth);
        txt.setAttribute('y', contentStartY + i * 15);
        txt.setAttribute('fill', hasTitle ? COLORS.textSecondary : COLORS.textPrimary);
        txt.setAttribute('font-size', hasTitle ? NOTE_CONFIG.bodyFontSize : NOTE_CONFIG.titleFontSize);
        if (!hasTitle && i === 0) txt.setAttribute('font-weight', '600');
        txt.style.pointerEvents = 'none';
        txt.style.userSelect = 'none';
        const truncLine = line.length > 35 ? line.substring(0, 32) + '...' : line;
        txt.textContent = truncLine;
        g.appendChild(txt);
      });
    }

    // Selection highlight
    if (this.selectedIds.has(node.id)) {
      rect.setAttribute('stroke', '#fbbf24');
      rect.setAttribute('stroke-width', '2.5');
    }

    // Semantic zoom dot (hidden by default, shown when very zoomed out)
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.classList.add('note-dot');
    dot.setAttribute('cx', w / 2);
    dot.setAttribute('cy', h / 2);
    dot.setAttribute('r', '8');
    dot.setAttribute('fill', color);
    dot.setAttribute('opacity', '0');
    dot.style.pointerEvents = 'none';
    g.appendChild(dot);

    this.noteLayer.appendChild(g);
  }

  /** Render a screenshot note card — 1:1 image size */
  _renderScreenshotNote(node) {
    const s = node.cardScale || 1;
    if (node.rawState === 'hidden') {
      this._renderHiddenScreenshotNote(node, s);
      return;
    }
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('note-card-group', 'screenshot-card');
    if (node.rawState === 'archived') g.classList.add('is-archived');
    g.dataset.id = node.id;
    g.dataset.hidden = 'false';
    g.setAttribute('transform', `translate(${node.x}, ${node.y}) scale(${s})`);
    g.style.filter = 'drop-shadow(0 6px 12px rgba(0,0,0,0.35))';
    g.style.opacity = this._nodeVisualOpacity(node);

    const color = store.getCategoryColor(node.type);
    const imgW = node.imageWidth || 400;
    const imgH = node.imageHeight || 300;
    const border = 3;
    const w = imgW + border * 2;
    const h = imgH + border * 2;

    // Border/frame rect
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('note-bg');
    rect.setAttribute('x', -border);
    rect.setAttribute('y', -border);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('rx', '4');
    rect.setAttribute('ry', '4');
    rect.setAttribute('fill', color);
    rect.setAttribute('stroke', 'none');
    g.appendChild(rect);

    if (node.stage === 'plan') {
      rect.setAttribute('stroke', COLORS.accent);
      rect.setAttribute('stroke-width', '4');
    }

    // Image at 1:1
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('x', '0');
    image.setAttribute('y', '0');
    image.setAttribute('width', imgW);
    image.setAttribute('height', imgH);
    image.setAttribute('preserveAspectRatio', 'none');
    image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', node.image);
    image.style.pointerEvents = 'none';
    g.appendChild(image);

    // Selection highlight
    if (this.selectedIds.has(node.id)) {
      rect.setAttribute('stroke', '#fbbf24');
      rect.setAttribute('stroke-width', '3');
    }

    this._appendLayerBadge(g, node, imgW, imgH);
    this.noteLayer.appendChild(g);
  }

  _renderHiddenScreenshotNote(node, scale) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('note-card-group', 'screenshot-card', 'is-hidden');
    g.dataset.id = node.id;
    g.dataset.hidden = 'true';
    g.dataset.baseHeight = '38';
    g.setAttribute('transform', `translate(${node.x}, ${node.y}) scale(${scale})`);

    const color = store.getCategoryColor(node.type);
    const w = NOTE_CONFIG.width;
    const h = 38;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('note-bg');
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('rx', NOTE_CONFIG.borderRadius);
    rect.setAttribute('ry', NOTE_CONFIG.borderRadius);
    rect.setAttribute('fill', COLORS.surface);
    rect.setAttribute('stroke', this.selectedIds.has(node.id) ? '#fbbf24' : COLORS.border);
    rect.setAttribute('stroke-width', this.selectedIds.has(node.id) ? '2.5' : '1');
    g.appendChild(rect);

    const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bar.classList.add('note-accent-bar');
    bar.setAttribute('width', NOTE_CONFIG.accentBarWidth);
    bar.setAttribute('height', h);
    bar.setAttribute('fill', color);
    g.appendChild(bar);

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.classList.add('note-title');
    title.setAttribute('x', NOTE_CONFIG.padding + NOTE_CONFIG.accentBarWidth);
    title.setAttribute('y', '25');
    title.setAttribute('fill', COLORS.textPrimary);
    title.setAttribute('font-size', NOTE_CONFIG.titleFontSize);
    title.setAttribute('font-weight', '600');
    title.style.pointerEvents = 'none';
    title.style.userSelect = 'none';
    title.textContent = node.title || 'Schowany screen';
    g.appendChild(title);

    const state = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    state.setAttribute('x', w - NOTE_CONFIG.padding);
    state.setAttribute('y', '25');
    state.setAttribute('fill', COLORS.textMuted);
    state.setAttribute('font-size', '9');
    state.setAttribute('font-weight', '700');
    state.setAttribute('text-anchor', 'end');
    state.style.pointerEvents = 'none';
    state.style.userSelect = 'none';
    state.textContent = 'SCHOWANE';
    g.appendChild(state);

    this._appendLayerBadge(g, node, w, h);
    this.noteLayer.appendChild(g);
  }

  _appendLayerBadge(group, node, width, height) {
    const preview = store.getLayerPreview(node.id);
    if (!preview) return;

    const count = preview.counts.items;
    const badgeWidth = count > 99 ? 36 : 30;
    const x = Math.max(8, width - badgeWidth - 8);
    const y = Math.max(8, height - 24);

    const badge = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    badge.classList.add('layer-badge');
    badge.setAttribute('x', x);
    badge.setAttribute('y', y);
    badge.setAttribute('width', badgeWidth);
    badge.setAttribute('height', '18');
    badge.setAttribute('rx', '5');
    badge.setAttribute('fill', 'rgba(79, 70, 229, 0.9)');
    badge.style.pointerEvents = 'none';
    group.appendChild(badge);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.classList.add('layer-badge-label');
    label.setAttribute('x', x + badgeWidth / 2);
    label.setAttribute('y', y + 13);
    label.setAttribute('fill', '#ffffff');
    label.setAttribute('font-size', '10');
    label.setAttribute('font-weight', '700');
    label.setAttribute('text-anchor', 'middle');
    label.style.pointerEvents = 'none';
    label.style.userSelect = 'none';
    label.textContent = `Z${count}`;
    group.appendChild(label);

    group.addEventListener('mouseenter', (event) => this._showLayerPreview(node.id, event));
    group.addEventListener('mousemove', (event) => this._positionLayerPreview(event));
    group.addEventListener('mouseleave', () => this._hideLayerPreview());
  }

  _showLayerPreview(nodeId, event) {
    const preview = store.getLayerPreview(nodeId);
    if (!preview) return;
    if (!this._layerPreviewEl) {
      this._layerPreviewEl = document.createElement('div');
      this._layerPreviewEl.className = 'layer-preview-popover';
      document.body.appendChild(this._layerPreviewEl);
    }

    this._layerPreviewEl.innerHTML = `
      <div class="layer-preview-title">${escapeHtml(preview.title)}</div>
      <div class="layer-preview-meta">${preview.counts.items} elementow · ${preview.counts.connections} polaczen</div>
      ${this._renderLayerPreviewSvg(preview)}
    `;
    this._positionLayerPreview(event);
  }

  _renderLayerPreviewSvg(preview) {
    if (!preview.items.length) return '<div class="layer-preview-empty">Pusta warstwa</div>';
    const bounds = preview.items.reduce((acc, item) => ({
      left: Math.min(acc.left, item.x),
      top: Math.min(acc.top, item.y),
      right: Math.max(acc.right, item.x + 80),
      bottom: Math.max(acc.bottom, item.y + 36),
    }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    const width = Math.max(1, bounds.right - bounds.left);
    const height = Math.max(1, bounds.bottom - bounds.top);
    const scale = Math.min(1, 220 / width, 120 / height);
    const offsetX = 10 - bounds.left * scale;
    const offsetY = 10 - bounds.top * scale;
    const byId = new Map(preview.items.map(item => [item.id, item]));
    const lines = preview.connections.map(connection => {
      const source = byId.get(connection.source);
      const target = byId.get(connection.target);
      if (!source || !target) return '';
      const x1 = source.x * scale + offsetX + 40 * scale;
      const y1 = source.y * scale + offsetY + 18 * scale;
      const x2 = target.x * scale + offsetX + 40 * scale;
      const y2 = target.y * scale + offsetY + 18 * scale;
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
    }).join('');
    const notes = preview.items.slice(0, 20).map(item => {
      const x = item.x * scale + offsetX;
      const y = item.y * scale + offsetY;
      const label = escapeHtml((item.title || item.id).slice(0, 18));
      return `<g><rect x="${x}" y="${y}" width="${80 * scale}" height="${36 * scale}" rx="4" /><text x="${x + 6}" y="${y + 16}" font-size="9">${label}</text></g>`;
    }).join('');
    return `<svg class="layer-preview-svg" viewBox="0 0 240 140" aria-hidden="true">${lines}${notes}</svg>`;
  }

  _positionLayerPreview(event) {
    if (!this._layerPreviewEl) return;
    const rect = this._layerPreviewEl.getBoundingClientRect();
    const left = Math.min(window.innerWidth - rect.width - 12, event.clientX + 14);
    const top = Math.min(window.innerHeight - rect.height - 12, event.clientY + 14);
    this._layerPreviewEl.style.left = `${Math.max(12, left)}px`;
    this._layerPreviewEl.style.top = `${Math.max(12, top)}px`;
  }

  _hideLayerPreview() {
    if (this._layerPreviewEl) this._layerPreviewEl.remove();
    this._layerPreviewEl = null;
  }

  _nodeVisualOpacity(node) {
    return node.rawState === 'archived' ? '0.55' : '1';
  }

  /** After card resize, push overlapping cards apart */
  _resolveOverlaps() {
    const nodes = store.getVisibleNodes();
    const gap = NOTE_CONFIG.expandGap;
    const baseW = NOTE_CONFIG.width;
    const baseH = NOTE_CONFIG.minHeight;

    const sorted = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x);

    let moved = false;
    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i];
      const cs = cur.cardScale || 1;
      for (let j = 0; j < i; j++) {
        const prev = sorted[j];
        const ps = prev.cardScale || 1;

        const prevW = baseW * ps;
        const prevH = baseH * ps;
        const curW = baseW * cs;

        const xOverlap = cur.x < prev.x + prevW + gap && cur.x + curW + gap > prev.x;
        if (!xOverlap) continue;

        const minY = prev.y + prevH + gap;
        if (cur.y < minY) {
          cur.y = minY;
          moved = true;
        }
      }
    }
    if (moved) {
      sorted.forEach(n => store.updateNodePosition(n.id, n.x, n.y));
      this.render();
    }
  }

  _moveNote(id, x, y) {
    const el = this.noteLayer.querySelector(`[data-id="${id}"]`);
    if (el) {
      const node = store.getNodeById(id);
      const s = node?.cardScale || 1;
      el.setAttribute('transform', `translate(${x}, ${y}) scale(${s})`);
    }
  }

  _updateLinksForNode(nodeId) {
    const node = store.getNodeById(nodeId);
    if (!node) return;
    const cx = node.x + NOTE_CONFIG.width / 2;
    const cy = node.y + NOTE_CONFIG.minHeight / 2;

    // Update visible links
    this.linkLayer.querySelectorAll('.canvas-link').forEach(line => {
      if (line.dataset.source === nodeId) {
        line.setAttribute('x1', cx);
        line.setAttribute('y1', cy);
      }
      if (line.dataset.target === nodeId) {
        line.setAttribute('x2', cx);
        line.setAttribute('y2', cy);
      }
    });

    // Update hit areas
    this.linkLayer.querySelectorAll('.canvas-link-hit').forEach((hitLine, i) => {
      const visLine = this.linkLayer.querySelectorAll('.canvas-link')[i];
      if (!visLine) return;
      if (visLine.dataset.source === nodeId) {
        hitLine.setAttribute('x1', cx);
        hitLine.setAttribute('y1', cy);
      }
      if (visLine.dataset.target === nodeId) {
        hitLine.setAttribute('x2', cx);
        hitLine.setAttribute('y2', cy);
      }
    });
  }

  // --- Semantic Zoom ---

  _updateSemanticZoom() {
    const notes = this.noteLayer.querySelectorAll('.note-card-group');
    notes.forEach(g => {
      const bg = g.querySelector('.note-bg');
      const bar = g.querySelector('.note-accent-bar');
      const typeLabel = g.querySelector('.note-type-label');
      const title = g.querySelector('.note-title');
      const contents = g.querySelectorAll('.note-content');
      const dot = g.querySelector('.note-dot');
      const baseHeight = Number(g.dataset.baseHeight) || NOTE_CONFIG.minHeight;
      const titleY = g.dataset.hidden === 'true' ? '25' : '36';

      if (this.scale < CANVAS_CONFIG.zoomSemanticDot) {
        // Dot mode — just colored circle
        if (bg) bg.setAttribute('opacity', '0');
        if (bar) bar.setAttribute('opacity', '0');
        if (typeLabel) typeLabel.setAttribute('opacity', '0');
        if (title) title.setAttribute('opacity', '0');
        contents.forEach(c => c.setAttribute('opacity', '0'));
        if (dot) dot.setAttribute('opacity', '0.9');
      } else if (this.scale < CANVAS_CONFIG.zoomSemanticTitleOnly) {
        // Title-only mode
        if (bg) { bg.setAttribute('opacity', '1'); bg.setAttribute('height', '32'); }
        if (bar) { bar.setAttribute('opacity', '1'); bar.setAttribute('height', '32'); }
        if (typeLabel) typeLabel.setAttribute('opacity', '0');
        if (title) { title.setAttribute('opacity', '1'); title.setAttribute('y', '22'); }
        contents.forEach(c => c.setAttribute('opacity', '0'));
        if (dot) dot.setAttribute('opacity', '0');
      } else {
        // Full mode
        if (bg) { bg.setAttribute('opacity', '1'); bg.setAttribute('height', baseHeight); }
        if (bar) { bar.setAttribute('opacity', '1'); bar.setAttribute('height', baseHeight); }
        if (typeLabel) typeLabel.setAttribute('opacity', '1');
        if (title) { title.setAttribute('opacity', '1'); title.setAttribute('y', titleY); }
        contents.forEach(c => c.setAttribute('opacity', '1'));
        if (dot) dot.setAttribute('opacity', '0');
      }
    });
  }

  // --- Linking ---

  toggleLinkingMode() {
    if (this.isLinking) {
      this.cancelLinking();
    } else {
      this.startLinking(true);
    }
  }

  startLinking(persistent = false) {
    this.isLinking = true;
    this.persistentLinking = persistent;
    this.linkSourceId = null;
    this.svg.style.cursor = 'crosshair';
    window.dispatchEvent(new CustomEvent('linking-changed', { detail: { active: true } }));
  }

  cancelLinking() {
    this.isLinking = false;
    this.persistentLinking = false;
    this.linkSourceId = null;
    this.linkPreview.setAttribute('opacity', '0');
    this.svg.style.cursor = 'grab';
    window.dispatchEvent(new CustomEvent('linking-changed', { detail: { active: false } }));
  }

  _handleLinkClick(nodeId) {
    if (!this.linkSourceId) {
      this.linkSourceId = nodeId;
      // Highlight source note
      const el = this.noteLayer.querySelector(`[data-id="${nodeId}"] .note-bg`);
      if (el) {
        el.setAttribute('stroke', COLORS.accent);
        el.setAttribute('stroke-width', '2.5');
      }
    } else {
      if (nodeId !== this.linkSourceId) {
        store.addLink(this.linkSourceId, nodeId);
        this.render();
      }
      if (this.persistentLinking) {
        this.linkSourceId = nodeId;
      } else {
        this.cancelLinking();
      }
    }
    this.linkPreview.setAttribute('opacity', '0');
  }

  // --- Selection ---

  _toggleSelection(id) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this.render();
    this._emitSelectionChanged();
  }

  clearSelection() {
    this.selectedIds.clear();
    this.render();
    this._emitSelectionChanged();
  }

  getSelectedIds() {
    return [...this.selectedIds];
  }

  _emitSelectionChanged() {
    window.dispatchEvent(new CustomEvent('selection-changed', {
      detail: { selectedIds: [...this.selectedIds] }
    }));
  }

  // --- Highlight ---

  highlightNeighborhood(nodeId) {
    const links = store.getLinks();
    const connectedIds = new Set([nodeId]);
    links.forEach(l => {
      const source = getEndpointId(l.source);
      const target = getEndpointId(l.target);
      if (source === nodeId) connectedIds.add(target);
      if (target === nodeId) connectedIds.add(source);
    });

    this.noteLayer.querySelectorAll('.note-card-group').forEach(g => {
      const node = store.getNodeById(g.dataset.id);
      g.style.opacity = connectedIds.has(g.dataset.id) ? this._nodeVisualOpacity(node || {}) : '0.15';
    });

    this.linkLayer.querySelectorAll('.canvas-link').forEach(line => {
      const isConnected = line.dataset.source === nodeId || line.dataset.target === nodeId;
      line.setAttribute('stroke', isConnected ? COLORS.accent : COLORS.border);
      line.setAttribute('stroke-opacity', isConnected ? '0.8' : '0.08');
      line.setAttribute('stroke-width', isConnected ? '2.5' : '1.5');
    });
  }

  clearHighlight() {
    this.noteLayer.querySelectorAll('.note-card-group').forEach(g => {
      const node = store.getNodeById(g.dataset.id);
      g.style.opacity = this._nodeVisualOpacity(node || {});
    });
    this.linkLayer.querySelectorAll('.canvas-link').forEach(line => {
      line.setAttribute('stroke', COLORS.border);
      line.setAttribute('stroke-opacity', '0.4');
      line.setAttribute('stroke-width', '1.5');
    });
  }

  // --- Camera ---

  focusNode(id) {
    const node = store.getNodeById(id);
    if (!node) return;
    const rect = this.svg.getBoundingClientRect();
    const targetScale = 1.2;
    this.scale = targetScale;
    this.offsetX = rect.width / 2 - (node.x + NOTE_CONFIG.width / 2) * targetScale;
    this.offsetY = rect.height / 2 - (node.y + NOTE_CONFIG.minHeight / 2) * targetScale;
    this._updateTransform();
    this._updateSemanticZoom();
  }

  getViewportCenter() {
    const rect = this.svg.getBoundingClientRect();
    return this._screenToWorld(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );
  }

  // --- Callbacks ---

  onNoteClick(cb) { this.onNoteClickCallback = cb; }
  onNoteDblClick(cb) { this.onNoteDblClickCallback = cb; }
  onBackgroundClick(cb) { this.onBackgroundClickCallback = cb; }
  onBackgroundDblClick(cb) { this.onBackgroundDblClickCallback = cb; }
}

function normalizeRect(start, end) {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    right: Math.max(start.x, end.x),
    bottom: Math.max(start.y, end.y),
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const canvas = new Canvas('canvas-container');
