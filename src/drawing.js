import { store } from './store.js';
import { DRAW_CONFIG, COLORS } from './constants.js';

/**
 * Freehand Drawing on the infinite canvas.
 * Draws SVG <path> elements into a dedicated layer.
 * Toggle with D key. X = eraser. [ ] = brush size. Ctrl+Z = undo.
 */
class Drawing {
  constructor() {
    this.isActive = false;
    this.isEraser = false;
    this.currentStroke = null;
    this.drawingLayer = null;
    this.canvas = null;
    this.color = DRAW_CONFIG.defaultColor;
    this.width = DRAW_CONFIG.defaultWidth;
  }

  attach(canvasRef, layer) {
    this.canvas = canvasRef;
    this.drawingLayer = layer;
    this.renderStored();
  }

  toggle() {
    this.isActive ? this.disable() : this.enable();
  }

  enable() {
    this.isActive = true;
    this.isEraser = false;
    this._dispatchState();
  }

  disable() {
    this.isActive = false;
    this.isEraser = false;
    if (this.currentStroke) this._endStroke();
    this._makeStrokesNonInteractive();
    this._dispatchState();
  }

  toggleEraser() {
    this.isEraser = !this.isEraser;
    if (this.isEraser) {
      this._makeStrokesInteractive();
    } else {
      this._makeStrokesNonInteractive();
    }
    this._dispatchState();
  }

  changeBrushSize(delta) {
    this.width = Math.max(1, Math.min(20, this.width + delta));
    this._dispatchState();
  }

  _dispatchState() {
    window.dispatchEvent(new CustomEvent('drawing-changed', {
      detail: {
        active: this.isActive,
        eraser: this.isEraser,
        brushSize: this.width,
      }
    }));
  }

  // --- Eraser: make strokes clickable ---

  _makeStrokesInteractive() {
    if (!this.drawingLayer) return;
    this.drawingLayer.querySelectorAll('path[data-stroke-id]').forEach(path => {
      path.style.pointerEvents = 'stroke';
      path.style.cursor = 'pointer';
      path.setAttribute('stroke-width', Math.max(parseFloat(path.getAttribute('stroke-width')), 8));
      path._eraserHandler = (e) => {
        e.stopPropagation();
        const sid = path.dataset.strokeId;
        const strokes = store.getStrokes();
        const idx = strokes.findIndex(s => s.id === sid);
        if (idx !== -1) {
          strokes.splice(idx, 1);
          store.save();
          this.renderStored();
          if (this.isEraser) this._makeStrokesInteractive();
        }
      };
      path.addEventListener('click', path._eraserHandler);
    });
  }

  _makeStrokesNonInteractive() {
    if (!this.drawingLayer) return;
    this.drawingLayer.querySelectorAll('path[data-stroke-id]').forEach(path => {
      path.style.pointerEvents = 'none';
      path.style.cursor = '';
      if (path._eraserHandler) {
        path.removeEventListener('click', path._eraserHandler);
        path._eraserHandler = null;
      }
    });
  }

  // --- Stroke lifecycle ---

  startStroke(screenX, screenY) {
    if (!this.isActive || !this.canvas || this.isEraser) return;
    const pt = this.canvas._screenToWorld(screenX, screenY);
    this.currentStroke = {
      points: [pt],
      color: this.color,
      width: this.width,
    };
    this._livePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this._livePath.setAttribute('fill', 'none');
    this._livePath.setAttribute('stroke', this.color);
    this._livePath.setAttribute('stroke-width', this.width);
    this._livePath.setAttribute('stroke-linecap', 'round');
    this._livePath.setAttribute('stroke-linejoin', 'round');
    this._livePath.setAttribute('opacity', '0.85');
    this._livePath.style.pointerEvents = 'none';
    this.drawingLayer.appendChild(this._livePath);
  }

  addPoint(screenX, screenY) {
    if (!this.currentStroke || !this.canvas) return;
    const pt = this.canvas._screenToWorld(screenX, screenY);
    const last = this.currentStroke.points[this.currentStroke.points.length - 1];
    const dx = pt.x - last.x;
    const dy = pt.y - last.y;
    if (dx * dx + dy * dy < DRAW_CONFIG.minDistance * DRAW_CONFIG.minDistance) return;
    this.currentStroke.points.push(pt);
    this._updateLivePath();
  }

  endStroke() {
    this._endStroke();
  }

  _endStroke() {
    if (!this.currentStroke) return;
    if (this.currentStroke.points.length >= 2) {
      store.addStroke(this.currentStroke);
    }
    if (this._livePath) {
      this._livePath.remove();
      this._livePath = null;
    }
    this.currentStroke = null;
    this.renderStored();
  }

  _updateLivePath() {
    if (!this._livePath || !this.currentStroke) return;
    this._livePath.setAttribute('d', this._pointsToD(this.currentStroke.points));
  }

  // --- Rendering ---

  renderStored() {
    if (!this.drawingLayer) return;
    const live = this._livePath;
    this.drawingLayer.innerHTML = '';
    if (live) this.drawingLayer.appendChild(live);

    const strokes = store.getStrokes();
    strokes.forEach(stroke => {
      if (!stroke.points || stroke.points.length < 2) return;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', this._pointsToD(stroke.points));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', stroke.color || '#fff');
      path.setAttribute('stroke-width', stroke.width || 2);
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('opacity', '0.7');
      path.style.pointerEvents = 'none';
      path.dataset.strokeId = stroke.id;
      this.drawingLayer.appendChild(path);
    });
  }

  undo() {
    store.undoStroke();
    this.renderStored();
    if (this.isEraser) this._makeStrokesInteractive();
  }

  clearAll() {
    store.clearStrokes();
    this.renderStored();
  }

  // --- Utils ---

  _pointsToD(points) {
    if (points.length < 2) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      if (i < points.length - 1) {
        const mx = (points[i].x + points[i + 1].x) / 2;
        const my = (points[i].y + points[i + 1].y) / 2;
        d += ` Q ${points[i].x} ${points[i].y} ${mx} ${my}`;
      } else {
        d += ` L ${points[i].x} ${points[i].y}`;
      }
    }
    return d;
  }
}

export const drawing = new Drawing();
