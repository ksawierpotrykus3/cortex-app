import { store } from './store.js';
import { SEED_DATA } from './seed.js';
import { canvas } from './canvas.js';
import { panel } from './panel.js';
import { filter } from './filter.js';
import { parking } from './parking.js';
import { vision } from './vision.js';
import { categoryManager } from './categories.js';
import { flashChat } from './flashchat.js';
import { projects } from './projects.js';
import { inboxPanel } from './inbox.js';

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
  document.getElementById('export-btn').addEventListener('click', (e) => {
    if (e.shiftKey) {
      store.exportData({ full: true });
      return;
    }

    const selectedIds = canvas.getSelectedIds();
    const defaultScope = selectedIds.length ? 'selection' : 'current';
    const scope = prompt('Zakres eksportu: current, selection, project, layer, all, backup', defaultScope);
    if (!scope) return;
    if (scope === 'backup') {
      store.exportData({ full: true });
      return;
    }
    const options = exportOptionsFor(scope, selectedIds);
    store.exportData(options);
  });

  document.getElementById('copy-context-btn')?.addEventListener('click', async () => {
    const selectedIds = canvas.getSelectedIds();
    const options = selectedIds.length
      ? { scope: 'selection', selectedIds }
      : { scope: 'current' };
    const text = store.buildSemanticContext(options);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      prompt('Skopiuj kontekst dla AI:', text);
    }
  });

  document.getElementById('clear-drawings-btn')?.addEventListener('click', () => {
    if (!confirm('Usunąć rysunki z aktualnego zakresu?')) return;
    store.clearStrokes();
    canvas.render();
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

  document.getElementById('batch-assign-project')?.addEventListener('click', () => {
    const ids = canvas.getSelectedIds();
    if (!ids.length) return;
    const projectsList = store.getProjects().map(project => `${project.id}: ${project.name}`).join('\n');
    const projectId = prompt(`Wklej ID projektu albo zostaw puste dla brudnej tablicy:\n${projectsList}`, store.getActiveProjectId());
    if (projectId === null) return;
    const includeConnected = confirm('Dołączyć też wszystkie połączone notki?');
    store.assignNodesToProject(ids, projectId || null, { includeConnected });
    canvas.clearSelection();
    batchPanel.classList.add('hidden');
    canvas.render();
    window.dispatchEvent(new CustomEvent('scope-changed'));
  });

  document.getElementById('batch-export')?.addEventListener('click', () => {
    const ids = canvas.getSelectedIds();
    if (!ids.length) return;
    store.exportData({ scope: 'selection', selectedIds: ids });
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

  // 16. Settings modal with Tabs
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const categoryBtn = document.getElementById('category-btn'); // Top bar button

  function openSettingsTab(tabId) {
    const tabs = document.querySelectorAll('.settings-tab-btn');
    const panes = document.querySelectorAll('.settings-pane');
    
    tabs.forEach(btn => {
      if (btn.dataset.tab === tabId) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    
    panes.forEach(pane => {
      if (pane.id === tabId) pane.classList.remove('hidden');
      else pane.classList.add('hidden');
    });
  }

  if (settingsModal) {
    // Setup tab buttons
    document.querySelectorAll('.settings-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => openSettingsTab(btn.dataset.tab));
    });

    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        const input = document.getElementById('api-key-input');
        if (input) input.value = vision.getApiKey();
        renderSemanticSettings();
        // Render categories when opening settings just in case
        if (typeof categoryManager !== 'undefined') categoryManager.renderList();
        
        // Open to default tab or current active
        openSettingsTab('pane-plankinds');
        settingsModal.classList.remove('hidden');
      });
    }

    if (categoryBtn) {
      categoryBtn.addEventListener('click', () => {
        if (typeof categoryManager !== 'undefined') categoryManager.renderList();
        openSettingsTab('pane-categories');
        settingsModal.classList.remove('hidden');
      });
    }

    document.getElementById('close-settings')?.addEventListener('click', () => {
      settingsModal.classList.add('hidden');
    });
    
    document.getElementById('save-api-key')?.addEventListener('click', () => {
      const input = document.getElementById('api-key-input');
      if (input) vision.setApiKey(input.value);
      // Optional: don't close, just show success? Or close.
      alert('Klucz API zapisany!');
    });
    
    document.getElementById('save-semantic-config')?.addEventListener('click', () => {
      saveSemanticSettings();
      canvas.render();
      panel.show(panel.currentNodeId);
      alert('Statusy semantyczne zapisane!');
    });
    
    setupSemanticEvents();

    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });
  }
}

function exportOptionsFor(scope, selectedIds) {
  if (scope === 'selection') return { scope: 'selection', selectedIds };
  if (scope === 'project') {
    let projectId = store.getActiveProjectId();
    if (projectId === 'all' || projectId === 'dirty') {
      const projectsList = store.getProjects().map(project => `${project.id}: ${project.name}`).join('\n');
      projectId = prompt(`Wklej ID projektu do eksportu:\n${projectsList}`, '') || '';
    }
    return { scope: 'project', projectId };
  }
  if (scope === 'layer') return { scope: 'layer', layerId: store.getActiveLayerId() };
  if (scope === 'all') return { scope: 'all' };
  if (scope === 'workspace') return { scope: 'workspace' };
  return { scope: 'current' };
}

function renderSemanticSettings() {
  const config = store.getSemanticConfig();
  const rawContainer = document.getElementById('semantic-raw-state-fields');
  if (rawContainer) {
    rawContainer.innerHTML = '';
    ['raw', 'extracted', 'hidden', 'archived'].forEach(id => {
      const wrapper = document.createElement('div');
      const label = document.createElement('label');
      label.textContent = id;
      const input = document.createElement('input');
      input.type = 'text';
      input.dataset.rawState = id;
      input.value = config.rawStates?.[id]?.label || id;
      wrapper.appendChild(label);
      wrapper.appendChild(input);
      rawContainer.appendChild(wrapper);
    });
  }

  renderPlanKindsList();
}

function renderPlanKindsList() {
  const list = document.getElementById('semantic-plan-kinds-list');
  if (!list) return;
  const config = store.getSemanticConfig();
  const planKinds = config.planKinds || [];
  
  list.innerHTML = '';
  if (planKinds.length === 0) {
    list.innerHTML = '<div class="empty-state" style="color: var(--text-muted); font-size: 12px; padding: 10px;">Brak typów planu.</div>';
    return;
  }

  planKinds.forEach((kind, idx) => {
    const row = document.createElement('div');
    row.className = 'category-row';

    const idInput = document.createElement('input');
    idInput.type = 'text';
    idInput.className = 'category-name-input';
    idInput.value = kind.id;
    idInput.style.width = '100px';
    idInput.title = 'ID (np. cel)';

    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.className = 'category-name-input';
    labelInput.value = kind.label || kind.id;
    labelInput.placeholder = 'Nazwa...';
    labelInput.style.flex = '1';

    idInput.addEventListener('change', () => {
      const success = store.updatePlanKind(kind.id, idInput.value, labelInput.value);
      if (!success) {
        idInput.value = kind.id;
        idInput.style.borderColor = '#c45c5c';
        setTimeout(() => { idInput.style.borderColor = ''; }, 1500);
      } else {
        renderPlanKindsList();
        canvas.render();
        panel.show(panel.currentNodeId);
      }
    });

    labelInput.addEventListener('change', () => {
      store.updatePlanKind(kind.id, kind.id, labelInput.value);
      canvas.render();
      panel.show(panel.currentNodeId);
    });

    const upBtn = document.createElement('button');
    upBtn.className = 'category-action-btn';
    upBtn.textContent = '▲';
    upBtn.title = 'Przesuń wyżej';
    upBtn.disabled = idx === 0;
    upBtn.addEventListener('click', () => {
      const ids = planKinds.map(k => k.id);
      if (idx > 0) {
        [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
        store.reorderPlanKinds(ids);
        renderPlanKindsList();
      }
    });

    const downBtn = document.createElement('button');
    downBtn.className = 'category-action-btn';
    downBtn.textContent = '▼';
    downBtn.title = 'Przesuń niżej';
    downBtn.disabled = idx === planKinds.length - 1;
    downBtn.addEventListener('click', () => {
      const ids = planKinds.map(k => k.id);
      if (idx < ids.length - 1) {
        [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
        store.reorderPlanKinds(ids);
        renderPlanKindsList();
      }
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'category-action-btn danger';
    delBtn.textContent = '✕';
    delBtn.title = 'Usuń typ planu';
    delBtn.addEventListener('click', () => {
      if (confirm(`Usunąć typ planu "${kind.label}"?`)) {
        store.deletePlanKind(kind.id);
        renderPlanKindsList();
        canvas.render();
        panel.show(panel.currentNodeId);
      }
    });

    row.appendChild(idInput);
    row.appendChild(labelInput);
    row.appendChild(upBtn);
    row.appendChild(downBtn);
    row.appendChild(delBtn);
    list.appendChild(row);
  });
}

function setupSemanticEvents() {
  document.getElementById('add-plan-kind-btn')?.addEventListener('click', () => {
    const idInput = document.getElementById('new-plan-kind-id');
    const nameInput = document.getElementById('new-plan-kind-name');
    if (!idInput || !nameInput) return;
    
    const id = idInput.value.trim();
    const name = nameInput.value.trim();
    
    if (!id) {
      alert('Podaj ID dla typu planu.');
      return;
    }
    
    const result = store.addPlanKind(id, name);
    if (!result) {
      alert('Taki typ planu już istnieje lub ID jest nieprawidłowe.');
      return;
    }
    
    idInput.value = '';
    nameInput.value = '';
    renderPlanKindsList();
    canvas.render();
    panel.show(panel.currentNodeId);
  });
}

function saveSemanticSettings() {
  const rawStates = {};
  document.querySelectorAll('[data-raw-state]').forEach(input => {
    rawStates[input.dataset.rawState] = { label: input.value.trim() || input.dataset.rawState };
  });

  store.updateSemanticConfig({ rawStates });
  renderSemanticSettings();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', init);
