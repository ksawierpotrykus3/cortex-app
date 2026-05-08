import { store } from './store.js';
import { graph } from './graph.js';

class QuickAdd {
  constructor() {
    this.input = document.getElementById('quick-add-input');
    this.typeBtns = document.querySelectorAll('#quick-add-types .type-btn');
    this.currentType = 'rozrzutka';
    
    this.init();
  }

  init() {
    // Type selection
    this.typeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.typeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentType = btn.dataset.type;
        this.input.focus();
      });
    });

    // Enter to add
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.submit();
      }
    });

    // Global focus shortcut (already in main.js, but let's keep it robust)
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

    // Logic: if first chars are markers like [!], override type
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

    const newNode = store.addNode({
      title: title,
      type: type,
      content: '' // Description can be added later via Edit
    });

    // Update Graph
    graph.setData({ 
      nodes: store.getNodes(), 
      links: store.getLinks() 
    });

    // Visual feedback
    this.input.value = '';
    
    // Optional: focus the new node
    setTimeout(() => graph.focusNode(newNode.id), 100);
  }
}

export const quickAdd = new QuickAdd();
