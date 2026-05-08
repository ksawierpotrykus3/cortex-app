import { store } from './store.js';
import { SEED_DATA } from './seed.js';
import { graph } from './graph.js';
import { panel } from './panel.js';
import { quickAdd } from './quickadd.js';
import { filter } from './filter.js';
import { parking } from './parking.js';

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

  // 5. Handle Export/Import
  document.getElementById('export-btn').addEventListener('click', () => {
    store.exportData();
  });

  // 6. Global Reset
  document.getElementById('reset-db-btn').addEventListener('click', () => {
    if (confirm('CZY NA PEWNO? To usunie WSZYSTKIE Twoje myśli i połączenia. Nie ma powrotu.')) {
      store.clearAll();
      location.reload();
    }
  });

  // 7. Batch Actions Logic
  const batchPanel = document.getElementById('batch-actions');
  const batchCount = document.getElementById('batch-count');
  
  window.addEventListener('selection-changed', (e) => {
    const ids = e.detail.selectedIds;
    if (ids.length > 0) {
      batchPanel.classList.remove('hidden');
      batchCount.textContent = `${ids.length} zaznaczonych`;
    } else {
      batchPanel.classList.add('hidden');
    }
  });

  document.getElementById('batch-cancel').addEventListener('click', () => {
    graph.clearSelection();
    batchPanel.classList.add('hidden');
  });

  document.getElementById('batch-delete-nodes').addEventListener('click', () => {
    const ids = graph.getSelectedNodes().map(n => n.id);
    if (confirm(`Usunąć ${ids.length} kropek?`)) {
      ids.forEach(id => store.deleteNode(id));
      graph.clearSelection();
      graph.setData({ nodes: store.getNodes(), links: store.getLinks() });
    }
  });

  document.getElementById('batch-delete-links').addEventListener('click', () => {
    const ids = graph.getSelectedNodes().map(n => n.id);
    store.deleteLinksBetween(ids);
    graph.clearSelection();
    graph.setData({ nodes: store.getNodes(), links: store.getLinks() });
  });
}

// End of main.js

// Start the app
document.addEventListener('DOMContentLoaded', init);
