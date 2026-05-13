import { store } from './store.js';
import { canvas } from './canvas.js';
import { CANVAS_CONFIG } from './constants.js';

class QuickAdd {
  constructor() {
    this.input = document.getElementById('quick-add-input');
    this.typeBtns = document.querySelectorAll('#quick-add-types .type-btn');
    this.currentType = 'rozrzutka';

    this.init();
  }

  init() {
    this.typeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.typeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentType = btn.dataset.type;
        this.input.focus();
      });
    });

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submit();
      }
    });

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.input.focus();
      }
    });
  }

  submit() {
    const text = this.input.value.trim();
    if (!text) return;

    let type = this.currentType;
    let title = text;

    if (text.startsWith('[!]')) {
      type = 'przeblysk';
      title = text.replace('[!]', '').trim();
    } else if (text.toLowerCase().startsWith('[aksjomat]')) {
      type = 'aksjomat';
      title = text.replace(/\[aksjomat\]/i, '').trim();
    } else if (text.toLowerCase().startsWith('[problem]')) {
      type = 'problem';
      title = text.replace(/\[problem\]/i, '').trim();
    }

    // Place new note at viewport center with small random offset
    const center = canvas.getViewportCenter();
    const spread = CANVAS_CONFIG.newNoteSpread;

    const newNode = store.addNode({
      title,
      type,
      content: '',
      x: center.x - 120 + (Math.random() - 0.5) * spread * 2,
      y: center.y - 40 + (Math.random() - 0.5) * spread * 2,
    });

    canvas.render();
    this.input.value = '';

    setTimeout(() => canvas.focusNode(newNode.id), 50);
  }
}

export const quickAdd = new QuickAdd();
