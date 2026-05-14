import { store } from './store.js';
import { canvas } from './canvas.js';
import { COLORS } from './constants.js';
import { vision } from './vision.js';

class Panel {
  constructor() {
    this.el = document.getElementById('side-panel');
    this.titleEl = document.getElementById('panel-title');
    this.typeEl = document.getElementById('panel-type-badge');
    this.metaEl = document.getElementById('panel-meta');
    this.bodyEl = document.getElementById('panel-body');
    this.connectionsEl = document.getElementById('panel-connections');
    this.closeBtn = document.getElementById('panel-close');
    this.projectSelect = document.getElementById('panel-project-select');
    this.stageBtn = document.getElementById('panel-stage-btn');
    this.prioritySelect = document.getElementById('panel-priority-select');
    this.rawStateSelect = document.getElementById('panel-raw-state-select');
    this.planKindSelect = document.getElementById('panel-plan-kind-select');
    this.openLayerBtn = document.getElementById('panel-open-layer-btn');
    this.renameLayerBtn = document.getElementById('panel-rename-layer-btn');

    this.isEditing = false;
    this.currentNodeId = null;
    this.init();
  }

  init() {
    this.closeBtn?.addEventListener('click', () => this.hide());

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.isEditing) this.hide();
    });

    document.getElementById('edit-node-btn')?.addEventListener('click', () => this.toggleEdit());
    document.getElementById('delete-node-btn')?.addEventListener('click', () => this.handleDelete());
    document.getElementById('add-link-btn')?.addEventListener('click', () => this.openGlobalLinkPicker());
    document.getElementById('close-link-picker')?.addEventListener('click', () => this.closeGlobalLinkPicker());
    document.getElementById('link-picker-search')?.addEventListener('input', () => this.renderGlobalLinkPicker());
    document.getElementById('link-picker-modal')?.addEventListener('click', (e) => {
      if (e.target?.id === 'link-picker-modal') this.closeGlobalLinkPicker();
    });

    this.projectSelect?.addEventListener('change', () => this.handleProjectChange());
    this.stageBtn?.addEventListener('click', () => this.toggleStage());
    this.prioritySelect?.addEventListener('change', () => this.handlePriorityChange());
    this.rawStateSelect?.addEventListener('change', () => this.handleRawStateChange());
    this.planKindSelect?.addEventListener('change', () => this.handlePlanKindChange());
    this.openLayerBtn?.addEventListener('click', () => this.openNodeLayer());
    this.renameLayerBtn?.addEventListener('click', () => this.renameNodeLayer());

    this.bodyEl?.addEventListener('click', (e) => {
      if (e.target?.id === 'reanalyze-image-btn') this.handleReanalyzeImage(e.target);
      if (e.target?.id === 'edit-vision-desc-btn') this.showVisionDescriptionEditor();
      if (e.target?.id === 'delete-vision-desc-btn') this.deleteVisionDescription();
      if (e.target?.id === 'save-vision-desc-btn') this.saveVisionDescription();
      if (e.target?.id === 'cancel-vision-desc-btn') this.show(this.currentNodeId);
    });

    this.titleEl?.addEventListener('dblclick', () => {
      if (!this.isEditing) this.toggleEdit();
    });
  }

  show(nodeId) {
    const node = store.getNodeById(nodeId);
    if (!node) return;

    this.currentNodeId = nodeId;
    this.isEditing = false;

    this.titleEl.textContent = node.title || '(bez tytułu)';
    this.typeEl.textContent = node.type.toUpperCase();
    this.typeEl.style.backgroundColor = store.getCategoryColor(node.type);

    const dateStr = node.createdAt ? new Date(node.createdAt).toLocaleDateString('pl-PL') : '-';
    const projectName = node.projectId ? store.getProjectById(node.projectId)?.name || 'Projekt' : 'Brudna tablica';
    const layerName = store.getLayerTitle(node.layerId || 'root');
    const stageName = node.stage === 'plan' ? 'Plan' : 'Robocze';
    this.metaEl.textContent = `Dodano: ${dateStr} · ${projectName} · ${layerName} · ${stageName} · P${node.priority || 1}`;

    let imageHtml = '';
    const isHidden = node.rawState === 'hidden';
    if (node.image && !isHidden) {
      imageHtml = `<div class="panel-image-preview">
        <img src="${node.image}" alt="Screenshot" />
      </div>
      <button id="reanalyze-image-btn" class="secondary-btn panel-wide-btn">Analizuj ponownie</button>`;

      if (node.imageDescription) {
        imageHtml += `<div class="vision-desc">${escapeHtml(node.imageDescription)}</div>
        <div class="panel-row-actions">
          <button id="edit-vision-desc-btn" class="secondary-btn">Edytuj opis AI</button>
          <button id="delete-vision-desc-btn" class="secondary-btn danger-text">Usuń opis AI</button>
        </div>`;
      }
    }

    const emptyText = node.image ? 'Brak własnej notatki' : 'Brak opisu';
    if (isHidden) {
      this.bodyEl.innerHTML = '<p id="panel-body-text"><span style="opacity:0.55">Schowane: treść i obraz nie są pokazywane w widoku ani eksporcie AI.</span></p>';
    } else {
      this.bodyEl.innerHTML = `${imageHtml}<p id="panel-body-text">${node.content ? escapeHtml(node.content) : `<span style="opacity:0.4">${emptyText}</span>`}</p>`;
    }

    document.getElementById('edit-node-btn').textContent = 'Edytuj';
    this.renderProjectControls(node);
    this.renderSemanticControls(node);
    this.renderLayerControls(node);
    this.renderConnections(nodeId);
    this.el.classList.remove('hidden');
  }

  hide() {
    this.el.classList.add('hidden');
    this.currentNodeId = null;
    this.isEditing = false;
    canvas.clearHighlight();
  }

  toggleEdit() {
    const node = store.getNodeById(this.currentNodeId);
    if (!node) return;

    if (!this.isEditing) {
      this.isEditing = true;
      document.getElementById('edit-node-btn').textContent = 'Zapisz';

      const typeOptions = store.getCategories()
        .map(category => `<option value="${category.id}" ${category.id === node.type ? 'selected' : ''}>${escapeHtml(category.name.toUpperCase())}</option>`)
        .join('');

      this.typeEl.innerHTML = `<select id="edit-type" class="inline-select">${typeOptions}</select>`;
      this.titleEl.innerHTML = `<input type="text" id="edit-title" value="${escapeAttr(node.title)}" class="inline-title-input">`;
      this.bodyEl.innerHTML = `<textarea id="edit-body" class="inline-body-input">${escapeHtml(node.content)}</textarea>`;
      document.getElementById('edit-title')?.focus();
      return;
    }

    const newTitle = document.getElementById('edit-title').value.trim();
    const newContent = document.getElementById('edit-body').value.trim();
    const newType = document.getElementById('edit-type').value;

    store.updateNode(this.currentNodeId, {
      title: newTitle || '',
      content: newContent,
      type: newType,
    });

    this.isEditing = false;
    this.show(this.currentNodeId);
    canvas.render();
    window.dispatchEvent(new CustomEvent('scope-changed'));
  }

  renderConnections(nodeId) {
    this.connectionsEl.innerHTML = '';
    const allConnections = store.getAllConnectionsForNode(nodeId);
    allConnections.forEach(connection => {
      const li = document.createElement('li');
      li.className = 'connection-item';
      if (!connection.isVisible) li.classList.add('external');

      const span = document.createElement('span');
      span.innerHTML = `${escapeHtml(connection.title || '(bez tytułu)')}<small class="connection-meta">${escapeHtml(connection.projectName || 'Workspace')}</small>`;
      span.style.color = store.getCategoryColor(connection.type) || COLORS.textSecondary;
      span.addEventListener('click', () => this.navigateToNode(connection.nodeId));

      const jumpBtn = document.createElement('button');
      jumpBtn.className = 'connection-jump-btn';
      jumpBtn.textContent = connection.isVisible ? 'Pokaż' : 'Idź';
      jumpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.navigateToNode(connection.nodeId);
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-link-btn';
      removeBtn.innerHTML = '&times;';
      removeBtn.title = 'Usuń połączenie';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        store.deleteLink(nodeId, connection.nodeId);
        this.renderConnections(nodeId);
        canvas.render();
      });

      li.appendChild(span);
      li.appendChild(jumpBtn);
      li.appendChild(removeBtn);
      this.connectionsEl.appendChild(li);
    });

    if (allConnections.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Brak połączeń';
      li.style.cursor = 'default';
      li.style.opacity = '0.4';
      this.connectionsEl.appendChild(li);
    }
    return;

    const links = store.getVisibleLinks();
    const nodes = store.getVisibleNodes();

    const connectedIds = links
      .filter(link => getEndpointId(link.source) === nodeId || getEndpointId(link.target) === nodeId)
      .map(link => getEndpointId(link.source) === nodeId ? getEndpointId(link.target) : getEndpointId(link.source));

    connectedIds.forEach(id => {
      const connNode = nodes.find(node => node.id === id);
      if (!connNode) return;

      const li = document.createElement('li');
      li.className = 'connection-item';

      const span = document.createElement('span');
      span.textContent = connNode.title || '(bez tytułu)';
      span.style.color = store.getCategoryColor(connNode.type) || COLORS.textSecondary;
      span.addEventListener('click', () => {
        this.show(connNode.id);
        canvas.focusNode(connNode.id);
        canvas.highlightNeighborhood(connNode.id);
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-link-btn';
      removeBtn.innerHTML = '&times;';
      removeBtn.title = 'Usuń połączenie';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        store.deleteLink(nodeId, id);
        this.renderConnections(nodeId);
        canvas.render();
      });

      li.appendChild(span);
      li.appendChild(removeBtn);
      this.connectionsEl.appendChild(li);
    });

    if (connectedIds.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Brak połączeń';
      li.style.cursor = 'default';
      li.style.opacity = '0.4';
      this.connectionsEl.appendChild(li);
    }
  }

  navigateToNode(nodeId) {
    const node = store.getNodeById(nodeId);
    if (!node) return;
    const layerId = node.layerId || 'root';
    if (layerId !== 'root') {
      store.setActiveLayerId(layerId);
    } else {
      store.setActiveProjectId(node.projectId || 'all');
    }
    canvas.render();
    this.show(node.id);
    canvas.focusNode(node.id);
    canvas.highlightNeighborhood(node.id);
    window.dispatchEvent(new CustomEvent('scope-changed'));
  }

  renderProjectControls(node) {
    if (!this.projectSelect || !this.stageBtn) return;

    const projects = store.getProjects();
    this.projectSelect.innerHTML = `
      <option value="">Brudna tablica</option>
      ${projects.map(project => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join('')}
    `;
    this.projectSelect.value = node.projectId || '';

    if (node.stage === 'plan') {
      this.stageBtn.textContent = 'Cofnij do roboczych';
      this.stageBtn.classList.add('is-plan');
    } else {
      this.stageBtn.textContent = 'Przenieś do planu';
      this.stageBtn.classList.remove('is-plan');
    }
  }

  renderSemanticControls(node) {
    const config = store.getSemanticConfig();
    if (this.prioritySelect) {
      this.prioritySelect.innerHTML = Array.from({ length: 10 }, (_, index) => {
        const value = index + 1;
        return `<option value="${value}">Priorytet ${value}</option>`;
      }).join('');
      this.prioritySelect.value = String(node.priority || 1);
    }

    if (this.rawStateSelect) {
      const rawStates = config.rawStates || {};
      this.rawStateSelect.innerHTML = ['raw', 'extracted', 'hidden', 'archived']
        .map(id => `<option value="${id}">${escapeHtml(rawStates[id]?.label || id)}</option>`)
        .join('');
      this.rawStateSelect.value = node.rawState || 'raw';
    }

    if (this.planKindSelect) {
      const planKinds = config.planKinds || [];
      this.planKindSelect.innerHTML = `
        <option value="">Typ planu...</option>
        ${planKinds.map(kind => `<option value="${kind.id}">${escapeHtml(kind.label || kind.id)}</option>`).join('')}
      `;
      this.planKindSelect.value = node.planKind || '';
      this.planKindSelect.disabled = node.stage !== 'plan';
    }
    return;

    if (this.prioritySelect) {
      this.prioritySelect.innerHTML = Array.from({ length: 10 }, (_, index) => {
        const value = index + 1;
        return `<option value="${value}">Priorytet ${value}</option>`;
      }).join('');
      this.prioritySelect.value = String(node.priority || 1);
    }

    if (this.rawStateSelect) {
      this.rawStateSelect.innerHTML = `
        <option value="raw">Surowiec</option>
        <option value="extracted">Wyciągnięte</option>
        <option value="hidden">Schowane</option>
        <option value="archived">Archiwum</option>
      `;
      this.rawStateSelect.value = node.rawState || 'raw';
    }

    if (this.planKindSelect) {
      this.planKindSelect.innerHTML = `
        <option value="">Typ planu...</option>
        ${PLAN_KINDS.map(kind => `<option value="${kind}">${kind.replace('_', ' ')}</option>`).join('')}
      `;
      this.planKindSelect.value = node.planKind || '';
      this.planKindSelect.disabled = node.stage !== 'plan';
    }
  }

  renderLayerControls(node) {
    if (!this.openLayerBtn) return;

    const layer = store.getLayers().find(item => item.originNodeId === node.id);
    this.openLayerBtn.textContent = layer ? `Otwórz warstwę: ${store.getLayerTitle(layer.id)}` : 'Utwórz / otwórz warstwę z tej notki';
    if (this.renameLayerBtn) {
      this.renameLayerBtn.disabled = !layer;
      this.renameLayerBtn.textContent = layer?.titleMode === 'bound' ? 'Nadaj własny tytuł warstwy' : 'Zmień tytuł warstwy';
    }
  }

  openGlobalLinkPicker() {
    if (!this.currentNodeId) return;
    const modal = document.getElementById('link-picker-modal');
    const search = document.getElementById('link-picker-search');
    if (!modal || !search) return;
    search.value = '';
    modal.classList.remove('hidden');
    this.renderGlobalLinkPicker();
    setTimeout(() => search.focus(), 0);
  }

  closeGlobalLinkPicker() {
    document.getElementById('link-picker-modal')?.classList.add('hidden');
  }

  renderGlobalLinkPicker() {
    const results = document.getElementById('link-picker-results');
    const search = document.getElementById('link-picker-search');
    if (!results || !this.currentNodeId) return;
    const query = (search?.value || '').trim().toLowerCase();
    const sourceId = this.currentNodeId;
    const existing = new Set(store.getAllConnectionsForNode(sourceId).map(connection => connection.nodeId));

    const nodes = store.getNodes()
      .filter(node => node.id !== sourceId)
      .filter(node => {
        if (!query) return true;
        const projectName = node.projectId ? store.getProjectById(node.projectId)?.name || '' : 'Workspace';
        return [node.title, node.content, node.type, projectName].some(value => String(value || '').toLowerCase().includes(query));
      })
      .sort((a, b) => String(a.title || a.content || a.id).localeCompare(String(b.title || b.content || b.id)))
      .slice(0, 80);

    results.innerHTML = '';
    if (!nodes.length) {
      const empty = document.createElement('div');
      empty.className = 'inbox-empty';
      empty.textContent = 'Brak wyników.';
      results.appendChild(empty);
      return;
    }

    nodes.forEach(node => {
      const item = document.createElement('button');
      item.className = 'link-picker-item';
      item.disabled = existing.has(node.id);
      const projectName = node.projectId ? store.getProjectById(node.projectId)?.name || node.projectId : 'Workspace';
      item.innerHTML = `
        <div class="link-picker-title">${escapeHtml(node.title || node.content || '(bez tytułu)')}</div>
        <div class="link-picker-meta">${escapeHtml(projectName)} · ${escapeHtml(store.getLayerTitle(node.layerId || 'root'))}${existing.has(node.id) ? ' · już połączone' : ''}</div>
      `;
      item.addEventListener('click', () => {
        if (item.disabled) return;
        store.addLink(sourceId, node.id);
        this.closeGlobalLinkPicker();
        this.show(sourceId);
        canvas.render();
      });
      results.appendChild(item);
    });
  }

  handleProjectChange() {
    if (!this.currentNodeId || !this.projectSelect) return;

    store.assignNodeToProject(this.currentNodeId, this.projectSelect.value || null);
    this.show(this.currentNodeId);
    canvas.render();
    window.dispatchEvent(new CustomEvent('scope-changed'));
  }

  toggleStage() {
    const node = store.getNodeById(this.currentNodeId);
    if (!node) return;

    const nextStage = node.stage === 'plan' ? 'robocze' : 'plan';
    const planKind = nextStage === 'plan' ? (this.planKindSelect?.value || 'fundament') : '';
    store.setNodeStage(node.id, nextStage, planKind);
    this.show(node.id);
    canvas.render();
  }

  handlePriorityChange() {
    if (!this.currentNodeId || !this.prioritySelect) return;
    store.setNodePriority(this.currentNodeId, this.prioritySelect.value);
    this.show(this.currentNodeId);
    canvas.render();
  }

  handleRawStateChange() {
    if (!this.currentNodeId || !this.rawStateSelect) return;
    store.setNodeRawState(this.currentNodeId, this.rawStateSelect.value);
    this.show(this.currentNodeId);
    canvas.render();
  }

  handlePlanKindChange() {
    const node = store.getNodeById(this.currentNodeId);
    if (!node || node.stage !== 'plan') return;
    store.setNodeStage(node.id, 'plan', this.planKindSelect?.value || '');
    this.show(node.id);
    canvas.render();
  }

  openNodeLayer() {
    const node = store.getNodeById(this.currentNodeId);
    if (!node) return;
    const layer = store.createLayerFromNode(node.id);
    if (!layer) return;
    store.setActiveLayerId(layer.id);
    this.hide();
    canvas.clearSelection();
    canvas.render();
    window.dispatchEvent(new CustomEvent('scope-changed'));
  }

  renameNodeLayer() {
    const node = store.getNodeById(this.currentNodeId);
    if (!node) return;
    const layer = store.getLayers().find(item => item.originNodeId === node.id);
    if (!layer) return;
    const name = prompt('Nowy tytuł warstwy', store.getLayerTitle(layer.id));
    if (!name) return;
    store.renameLayer(layer.id, name);
    this.show(node.id);
    canvas.render();
    window.dispatchEvent(new CustomEvent('scope-changed'));
  }

  handleDelete() {
    const node = store.getNodeById(this.currentNodeId);
    if (!node) return;

    const hasLayer = store.getLayers().some(layer => layer.originNodeId === node.id);
    let action = 'detach';
    if (hasLayer) {
      const choice = prompt('Ta notka ma warstwę. Wpisz detach, delete albo cancel.', 'detach');
      if (choice === 'cancel') return;
      action = choice === 'delete' ? 'delete-layers' : 'detach';
    }

    store.deleteNode(node.id, { originLayerAction: action });
    this.hide();
    canvas.render();
    window.dispatchEvent(new CustomEvent('scope-changed'));
  }

  handlePark() {
    store.parkNode(this.currentNodeId);
    this.hide();
    canvas.render();
  }

  async handleReanalyzeImage(button) {
    const node = store.getNodeById(this.currentNodeId);
    if (!node?.image) return;

    if (!vision.hasApiKey()) {
      button.textContent = 'Brak API key';
      return;
    }

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = 'Analizuję...';

    try {
      const description = await vision.analyzeImage(node.image);
      if (description && !description.startsWith('[')) {
        store.updateNode(node.id, { imageDescription: description, rawState: 'extracted' });
        this.show(node.id);
        canvas.render();
      } else {
        button.textContent = description || 'Brak odpowiedzi';
        button.disabled = false;
      }
    } catch (err) {
      button.textContent = `Błąd: ${err.message}`;
      button.disabled = false;
      setTimeout(() => {
        button.textContent = originalLabel;
      }, 2500);
    }
  }

  showVisionDescriptionEditor() {
    const node = store.getNodeById(this.currentNodeId);
    if (!node?.image) return;

    this.bodyEl.innerHTML = `<div class="panel-image-preview">
      <img src="${node.image}" alt="Screenshot" />
    </div>
    <textarea id="vision-desc-editor" class="vision-desc-editor">${escapeHtml(node.imageDescription || '')}</textarea>
    <div class="panel-row-actions">
      <button id="save-vision-desc-btn" class="secondary-btn">Zapisz opis AI</button>
      <button id="cancel-vision-desc-btn" class="secondary-btn">Anuluj</button>
    </div>`;
    document.getElementById('vision-desc-editor')?.focus();
  }

  saveVisionDescription() {
    const textarea = document.getElementById('vision-desc-editor');
    if (!textarea || !this.currentNodeId) return;

    store.updateNode(this.currentNodeId, {
      imageDescription: textarea.value.trim(),
      rawState: textarea.value.trim() ? 'extracted' : 'raw',
    });
    this.show(this.currentNodeId);
    canvas.render();
  }

  deleteVisionDescription() {
    if (!this.currentNodeId) return;

    store.updateNode(this.currentNodeId, { imageDescription: '', rawState: 'raw' });
    this.show(this.currentNodeId);
    canvas.render();
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

export const panel = new Panel();
