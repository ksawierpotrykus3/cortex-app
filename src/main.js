import { store } from './store.js';
import { SEED_DATA } from './seed.js';
import { graph } from './graph.js';
import { panel } from './panel.js';
import { quickAdd } from './quickadd.js';
import { filter } from './filter.js';

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
  // No-op for now
  
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

// End of main.js

// Start the app
document.addEventListener('DOMContentLoaded', init);
