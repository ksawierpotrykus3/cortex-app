import { store } from './store.js';
import { SEED_DATA } from './seed.js';
import { canvas } from './canvas.js';
import { panel } from './panel.js';
import { quickAdd } from './quickadd.js';
import { filter } from './filter.js';
import { parking } from './parking.js';
import { vision } from './vision.js';
import { SCREENSHOT_CONFIG } from './constants.js';
import { categoryManager } from './categories.js';
import { flashChat } from './flashchat.js';

function init() {
  console.log('Cortex v2: Initializing infinite canvas...');

  // 1. Load data (seed only on first-ever visit — never after user clears)
  const hasExistingData = localStorage.getItem('cortex-data-v2') !== null;
  if (!hasExistingData) {
    console.log('Cortex: First visit, loading seed data...');
    store.importData(SEED_DATA);
  } else {
    console.log(`Cortex: Loaded ${store.getNodes().length} nodes from storage.`);
  }

  // 2. Render canvas
  canvas.render();

  // 3. Note click → open panel + highlight neighborhood
  canvas.onNoteClick((nodeId) => {
    canvas.highlightNeighborhood(nodeId);
    panel.show(nodeId);
  });

  // 4. Note double-click → open panel in edit mode
  canvas.onNoteDblClick((nodeId) => {
    panel.show(nodeId);
    panel.toggleEdit();
  });

  // 5. Background click → close panel, clear highlight
  canvas.onBackgroundClick(() => {
    canvas.clearHighlight();
    panel.hide();
  });

  // 6. Background double-click → create new note at that position
  canvas.onBackgroundDblClick((x, y) => {
    const newNode = store.addNode({
      title: '',
      type: 'rozrzutka',
      content: '',
      x: x - 120, // Center note on click
      y: y - 40,
    });
    canvas.render();
    // Immediately open in edit mode
    setTimeout(() => {
      panel.show(newNode.id);
      panel.toggleEdit();
    }, 50);
  });

  // 7. Export
  document.getElementById('export-btn').addEventListener('click', () => {
    store.exportData();
  });

  // 8. Reset
  document.getElementById('reset-db-btn').addEventListener('click', () => {
    store.clearAll();
    location.reload();
  });

  // 9. Batch Actions
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
    canvas.clearSelection();
    batchPanel.classList.add('hidden');
  });

  document.getElementById('batch-delete-nodes').addEventListener('click', () => {
    const ids = canvas.getSelectedIds();
    if (ids.length) {
      ids.forEach(id => store.deleteNode(id));
      canvas.clearSelection();
      batchPanel.classList.add('hidden');
      canvas.render();
    }
  });

  document.getElementById('batch-delete-links').addEventListener('click', () => {
    const ids = canvas.getSelectedIds();
    store.deleteLinksBetween(ids);
    canvas.clearSelection();
    batchPanel.classList.add('hidden');
    canvas.render();
  });

  // 10. Help Modal
  const helpModal = document.getElementById('help-modal');
  document.getElementById('help-btn').addEventListener('click', () => {
    helpModal.classList.toggle('hidden');
  });
  document.getElementById('close-help').addEventListener('click', () => {
    helpModal.classList.add('hidden');
  });
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.classList.add('hidden');
  });

  // 11. Linking indicator
  window.addEventListener('linking-changed', (e) => {
    let indicator = document.getElementById('linking-indicator');
    if (e.detail.active) {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'linking-indicator';
        indicator.className = 'linking-indicator';
        indicator.innerHTML = '<span>TRYB ŁĄCZENIA</span><small>Klikaj w notatki by łączyć · Tab by wyjść</small>';
        document.body.appendChild(indicator);
      }
    } else {
      if (indicator) indicator.remove();
    }
  });

  // 12. Drawing indicator
  window.addEventListener('drawing-changed', (e) => {
    let indicator = document.getElementById('drawing-indicator');
    if (e.detail.active) {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'drawing-indicator';
        document.body.appendChild(indicator);
      }
      if (e.detail.eraser) {
        indicator.className = 'drawing-indicator eraser';
        indicator.innerHTML = `<span>🧹 GUMKA</span><small>Klikaj w linie by usuwać · X by wrócić do pędzla</small>`;
      } else {
        indicator.className = 'drawing-indicator';
        indicator.innerHTML = `<span>✏️ RYSOWANIE [${e.detail.brushSize || 2}px]</span><small>Rysuj myszką · X gumka · [ ] rozmiar · D/Esc wyjdź</small>`;
      }
    } else {
      if (indicator) indicator.remove();
    }
  });

  // 13. Expand indicator
  window.addEventListener('expand-changed', (e) => {
    let indicator = document.getElementById('expand-indicator');
    if (e.detail.expanded) {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'expand-indicator';
        indicator.className = 'expand-indicator';
        indicator.textContent = '📖 ROZWINIĘTE — E by zwinąć';
        document.body.appendChild(indicator);
      }
    } else {
      if (indicator) indicator.remove();
    }
  });

  // 14. Ctrl+F → search focus
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      document.getElementById('search-input')?.focus();
    }
  });

  // 15. Ctrl+V → paste screenshot
  document.addEventListener('paste', async (e) => {
    // Skip if user is typing in an input/textarea
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        try {
          // Convert to JPEG (keep original size)
          const { dataUrl, width, height } = await vision.compressImage(file);

          // Calculate center of current viewport
          const rect = document.getElementById('canvas-container').getBoundingClientRect();
          const centerScreen = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          };
          const worldPos = canvas._screenToWorld(centerScreen.x, centerScreen.y);

          // Create node immediately with image at 1:1 size
          const newNode = store.addNode({
            title: '',
            type: 'rozrzutka',
            content: '',
            image: dataUrl,
            imageWidth: width,
            imageHeight: height,
            imageDescription: '',
            x: worldPos.x - width / 2,
            y: worldPos.y - height / 2,
          });
          canvas.render();

          // Async: try vision analysis silently
          if (vision.hasApiKey()) {
            try {
              const description = await vision.analyzeImage(dataUrl);
              if (description && !description.startsWith('[')) {
                store.updateNode(newNode.id, { imageDescription: description });
                canvas.render();
              }
            } catch (_) { /* silent */ }
          }
        } catch (err) {
          console.error('Screenshot paste error:', err);
        }
        break; // Only handle first image
      }
    }
  });

  // 16. API Key settings modal
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  if (settingsBtn && settingsModal) {
    settingsBtn.addEventListener('click', () => {
      const input = document.getElementById('api-key-input');
      if (input) input.value = vision.getApiKey();
      settingsModal.classList.toggle('hidden');
    });
    document.getElementById('close-settings')?.addEventListener('click', () => {
      settingsModal.classList.add('hidden');
    });
    document.getElementById('save-api-key')?.addEventListener('click', () => {
      const input = document.getElementById('api-key-input');
      if (input) {
        vision.setApiKey(input.value);
        settingsModal.classList.add('hidden');
      }
    });
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
