import { store } from './store.js';
import { SEED_DATA } from './seed.js';
import { graph } from './graph.js';
import { panel } from './panel.js';
import { quickAdd } from './quickadd.js';

function init() {
  console.log('Cortex: Initializing...');

  // 1. Check if we need to load seed data
  const currentNodes = store.getNodes();
  if (currentNodes.length === 0) {
    console.log('Cortex: Store empty, loading seed data...');
    store.importData(SEED_DATA);
  } else {
    console.log(`Cortex: Loaded ${currentNodes.length} nodes from storage.`);
  }

  // 2. Setup UI listeners (already handled by modules mostly)
  setupGlobalListeners();
  
  // 3. Render Graph
  graph.setData({ 
    nodes: store.getNodes(), 
    links: store.getLinks() 
  });

  // 4. Handle node clicks
  graph.onNodeClick((node) => {
    panel.show(node);
  });
}

function setupGlobalListeners() {
  // Common listeners that don't belong to a specific module
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
