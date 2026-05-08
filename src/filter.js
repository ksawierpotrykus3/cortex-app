import { graph } from './graph.js';
import { store } from './store.js';

class Filter {
  constructor() {
    this.filterBtns = document.querySelectorAll('.filter-btn');
    this.searchInput = document.getElementById('search-input');
    this.activeFilters = new Set();
    this.searchQuery = '';
    
    this.init();
  }

  init() {
    // Type Filters
    this.filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        
        if (type === 'all') {
          this.activeFilters.clear();
          this.filterBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        } else {
          // Multi-select logic
          document.querySelector('.filter-btn[data-type="all"]').classList.remove('active');
          if (this.activeFilters.has(type)) {
            this.activeFilters.delete(type);
            btn.classList.remove('active');
          } else {
            this.activeFilters.add(type);
            btn.classList.add('active');
          }
          
          if (this.activeFilters.size === 0) {
            document.querySelector('.filter-btn[data-type="all"]').classList.add('active');
          }
        }
        this.apply();
      });
    });

    // Search Input
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.apply();
    });

    // Ctrl+F as secondary shortcut to search
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        this.searchInput.focus();
      }
    });
  }

  apply() {
    const nodes = store.getNodes();
    const links = store.getLinks();

    // 1. Determine which nodes match
    const filteredNodes = nodes.map(node => {
      const typeMatch = this.activeFilters.size === 0 || this.activeFilters.has(node.type);
      const searchMatch = !this.searchQuery || 
                          node.title.toLowerCase().includes(this.searchQuery) || 
                          node.content.toLowerCase().includes(this.searchQuery);
      
      return {
        ...node,
        isFiltered: !(typeMatch && searchMatch)
      };
    });

    // 2. Update Graph Visuals (opacity)
    // Note: In a more complex app, we might want to filter the D3 data entirely.
    // For now, we update the graph module to handle "dimming" of nodes.
    graph.applyFilters(filteredNodes);
  }
}

export const filter = new Filter();
