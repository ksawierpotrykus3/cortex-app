import { store } from './store.js';
import { SEED_DATA } from './seed.js';
import { graph } from './graph.js';

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

  // 2. Setup UI listeners
  setupEventListeners();
  
  // 3. Render Graph
  graph.setData({ 
    nodes: store.getNodes(), 
    links: store.getLinks() 
  });

  // 4. Handle node clicks
  graph.onNodeClick((node) => {
    console.log('Node clicked:', node);
    // Panel logic will go here
  });
}

function setupEventListeners() {
  // Quick Add focus
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('quick-add-input').focus();
    }
  });

  // Type Filter Buttons
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.dataset.type;
      console.log('Filtering by:', type);
      // Filter logic will go here
    });
  });

  // Quick Add Type Picker
  const typeBtns = document.querySelectorAll('.type-btn');
  typeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      typeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Quick Add Input
  const quickInput = document.getElementById('quick-add-input');
  quickInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && quickInput.value.trim()) {
      const type = document.querySelector('.type-btn.active').dataset.type;
      const newNode = store.addNode({
        title: quickInput.value,
        type: type
      });
      console.log('Node added:', newNode);
      quickInput.value = '';
      // Graph update will go here
    }
  });
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
