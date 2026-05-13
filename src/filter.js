import { store } from './store.js';
import { canvas } from './canvas.js';

class Filter {
  constructor() {
    this.searchInput = document.getElementById('search-input');
    this.searchQuery = '';

    this.init();
  }

  init() {
    // Search Input — filter notes by dimming non-matching
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.apply();
    });
  }

  apply() {
    if (!this.searchQuery) {
      // Show all
      document.querySelectorAll('.note-card-group').forEach(g => {
        g.style.opacity = '1';
      });
      return;
    }

    const nodes = store.getNodes();
    const matchIds = new Set();

    nodes.forEach(node => {
      const titleMatch = node.title.toLowerCase().includes(this.searchQuery);
      const contentMatch = node.content.toLowerCase().includes(this.searchQuery);
      if (titleMatch || contentMatch) matchIds.add(node.id);
    });

    document.querySelectorAll('.note-card-group').forEach(g => {
      g.style.opacity = matchIds.has(g.dataset.id) ? '1' : '0.12';
    });
  }
}

export const filter = new Filter();
