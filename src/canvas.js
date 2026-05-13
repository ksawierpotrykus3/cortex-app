import { COLORS, NOTE_CONFIG, CANVAS_CONFIG, SCREENSHOT_CONFIG } from './constants.js';
import { store } from './store.js';
import { drawing } from './drawing.js';

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

    // Selection
    this.selectedIds = new Set();

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
        this.dragOffsetX = worldPos.x - node.x;
        this.dragOffsetY = worldPos.y - node.y;
        this.svg.style.cursor = 'grabbing';
        this._dragStartTime = Date.now();
        this._dragMoved = false;
      } else if (target === this.svg || target === this.mainGroup || target.closest('#grid-layer') || target.closest('#link-layer') || target.closest('#drawing-layer')) {
        if (this.isLinking) return;
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
      } else if (this.draggedNoteId) {
        this._dragMoved = true;
        const worldPos = this._screenToWorld(e.clientX, e.clientY);
        const nx = worldPos.x - this.dragOffsetX;
        const ny = worldPos.y - this.dragOffsetY;
        store.updateNodePosition(this.draggedNoteId, nx, ny);
        this._moveNote(this.draggedNoteId, nx, ny);
        this._updateLinksForNode(this.draggedNoteId);
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
        this.svg.style.cursor = this._getCursor();
      }
    });

    // Click on empty space
    this.svg.addEventListener('click', (e) => {
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
    const nodes = store.getNodes();
    if (nodes.length === 0) return;

    // Save original positions
    this.savedPositions.clear();
    nodes.forEach(n => {
      this.savedPositions.set(n.id, { x: n.x, y: n.y });
    });

    // Calculate expanded heights for each node
    const expandedHeights = new Map();
    nodes.forEach(n => {
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
    const nodes = store.getNodes();
    const links = store.getLinks();

    this.linkLayer.innerHTML = '';
    this.noteLayer.innerHTML = '';

    // Render links (use expanded heights for center calc)
    links.forEach(link => {
      const src = nodes.find(n => n.id === link.source);
      const tgt = nodes.find(n => n.id === link.target);
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
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('note-card-group');
    g.dataset.id = node.id;
    g.setAttribute('transform', `translate(${node.x}, ${node.y})`);

    const color = store.getCategoryColor(node.type);
    const w = NOTE_CONFIG.width;

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

    // Accent bar
    const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bar.setAttribute('x', '0');
    bar.setAttribute('y', '0');
    bar.setAttribute('width', NOTE_CONFIG.accentBarWidth);
    bar.setAttribute('height', h);
    bar.setAttribute('rx', '0');
    bar.setAttribute('fill', color);
    const clipId = `clip-exp-${node.id}`;
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
    typeLabel.setAttribute('x', NOTE_CONFIG.padding + NOTE_CONFIG.accentBarWidth);
    typeLabel.setAttribute('y', '16');
    typeLabel.setAttribute('fill', color);
    typeLabel.setAttribute('font-size', '9');
    typeLabel.setAttribute('font-weight', '700');
    typeLabel.style.pointerEvents = 'none';
    typeLabel.style.userSelect = 'none';
    typeLabel.textContent = node.type.toUpperCase();
    g.appendChild(typeLabel);

    // Title
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', NOTE_CONFIG.padding + NOTE_CONFIG.accentBarWidth);
    title.setAttribute('y', '34');
    title.setAttribute('fill', COLORS.textPrimary);
    title.setAttribute('font-size', NOTE_CONFIG.titleFontSize);
    title.setAttribute('font-weight', '600');
    title.style.pointerEvents = 'none';
    title.style.userSelect = 'none';
    title.textContent = node.title;
    g.appendChild(title);

    // Full content (no truncation)
    if (node.content) {
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
    const nodes = store.getNodes();
    const links = store.getLinks();

    // Clear
    this.linkLayer.innerHTML = '';
    this.noteLayer.innerHTML = '';

    // Render links
    links.forEach(link => {
      const src = nodes.find(n => n.id === link.source);
      const tgt = nodes.find(n => n.id === link.target);
      if (!src || !tgt) return;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('canvas-link');
      line.dataset.source = link.source;
      line.dataset.target = link.target;
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
        store.deleteLink(link.source, link.target);
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
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('note-card-group');
    g.dataset.id = node.id;
    g.setAttribute('transform', `translate(${node.x}, ${node.y}) scale(${s})`);

    const color = store.getCategoryColor(node.type);
    const w = NOTE_CONFIG.width;
    const h = NOTE_CONFIG.minHeight;

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

    // Title + Content layout
    const hasTitle = node.title && node.title.trim().length > 0;
    let contentStartY = 54;

    if (hasTitle) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      title.classList.add('note-title');
      title.setAttribute('x', NOTE_CONFIG.padding + NOTE_CONFIG.accentBarWidth);
      title.setAttribute('y', '36');
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
      contentStartY = 34;
    }

    // Content preview (truncated, 2-3 lines)
    if (node.content) {
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
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('note-card-group', 'screenshot-card');
    g.dataset.id = node.id;
    g.setAttribute('transform', `translate(${node.x}, ${node.y}) scale(${s})`);
    g.style.filter = 'drop-shadow(0 6px 12px rgba(0,0,0,0.35))';

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

    this.noteLayer.appendChild(g);
  }

  /** After card resize, push overlapping cards apart */
  _resolveOverlaps() {
    const nodes = store.getNodes();
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
        if (bg) { bg.setAttribute('opacity', '1'); bg.setAttribute('height', NOTE_CONFIG.minHeight); }
        if (bar) { bar.setAttribute('opacity', '1'); bar.setAttribute('height', NOTE_CONFIG.minHeight); }
        if (typeLabel) typeLabel.setAttribute('opacity', '1');
        if (title) { title.setAttribute('opacity', '1'); title.setAttribute('y', '36'); }
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
    window.dispatchEvent(new CustomEvent('selection-changed', {
      detail: { selectedIds: [...this.selectedIds] }
    }));
  }

  clearSelection() {
    this.selectedIds.clear();
    this.render();
  }

  getSelectedIds() {
    return [...this.selectedIds];
  }

  // --- Highlight ---

  highlightNeighborhood(nodeId) {
    const links = store.getLinks();
    const connectedIds = new Set([nodeId]);
    links.forEach(l => {
      if (l.source === nodeId) connectedIds.add(l.target);
      if (l.target === nodeId) connectedIds.add(l.source);
    });

    this.noteLayer.querySelectorAll('.note-card-group').forEach(g => {
      g.style.opacity = connectedIds.has(g.dataset.id) ? '1' : '0.15';
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
      g.style.opacity = '1';
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

export const canvas = new Canvas('canvas-container');
