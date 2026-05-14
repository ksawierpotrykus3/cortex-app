import { store } from './store.js';
import { canvas } from './canvas.js';
import { COLORS } from './constants.js';
import { vision } from './vision.js';

/**
 * Side panel — hybrid A+B:
 *  single click on note  → opens panel (view + connections)
 *  double click on note  → inline edit (handled in main.js)
 *  "Edytuj" button       → switches panel to edit mode
 */
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

    this.isEditing = false;
    this.currentNodeId = null;
    this.init();
  }

  init() {
    this.closeBtn.addEventListener('click', () => this.hide());

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.isEditing) {
        this.hide();
      }
    });

    document.getElementById('edit-node-btn').addEventListener('click', () => this.toggleEdit());
    document.getElementById('delete-node-btn').addEventListener('click', () => this.handleDelete());
    document.getElementById('park-node-btn').addEventListener('click', () => this.handlePark());
    document.getElementById('add-link-btn').addEventListener('click', () => {
      canvas.startLinking(false);
      canvas.linkSourceId = this.currentNodeId;
      this.hide();
    });
    this.projectSelect?.addEventListener('change', () => this.handleProjectChange());
    this.stageBtn?.addEventListener('click', () => this.toggleStage());

    this.bodyEl.addEventListener('click', (e) => {
      if (e.target?.id === 'reanalyze-image-btn') {
        this.handleReanalyzeImage(e.target);
      }
      if (e.target?.id === 'edit-vision-desc-btn') {
        this.showVisionDescriptionEditor();
      }
      if (e.target?.id === 'delete-vision-desc-btn') {
        this.deleteVisionDescription();
      }
      if (e.target?.id === 'save-vision-desc-btn') {
        this.saveVisionDescription();
      }
      if (e.target?.id === 'cancel-vision-desc-btn') {
        this.show(this.currentNodeId);
      }
    });

    // Inline title edit on dblclick
    this.titleEl.addEventListener('dblclick', () => {
      if (!this.isEditing) this.toggleEdit();
    });
  }

  show(nodeId) {
    const node = store.getNodeById(nodeId);
    if (!node) return;

    this.currentNodeId = nodeId;
    this.isEditing = false;

    // Fill data
    this.titleEl.textContent = node.title;
    this.typeEl.textContent = node.type.toUpperCase();
    this.typeEl.style.backgroundColor = store.getCategoryColor(node.type);
    const dateStr = node.createdAt ? new Date(node.createdAt).toLocaleDateString('pl-PL') : '—';
    const projectName = node.projectId ? store.getProjectById(node.projectId)?.name || 'Projekt' : 'Brudna tablica';
    const stageName = node.stage === 'plan' ? 'Plan' : 'Robocze';
    this.metaEl.textContent = `Dodano: ${dateStr} · ${projectName} · ${stageName}`;

    // Image preview for screenshot nodes
    let imageHtml = '';
    if (node.image) {
      imageHtml = `<div style="margin-bottom:12px;border-radius:8px;overflow:hidden;border:1px solid var(--border);">
        <img src="${node.image}" style="width:100%;display:block;" alt="Screenshot" />
      </div>`;
      imageHtml += `<button id="reanalyze-image-btn" style="width:100%;margin-bottom:12px;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text-primary);font-weight:600;cursor:pointer;">Analizuj ponownie</button>`;
      if (node.imageDescription) {
        imageHtml += `<div class="vision-desc" style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;padding:8px;background:var(--bg-primary);border-radius:6px;max-height:200px;overflow-y:auto;white-space:pre-wrap;line-height:1.5;">${node.imageDescription}</div>
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <button id="edit-vision-desc-btn" style="flex:1;padding:7px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text-primary);font-weight:600;cursor:pointer;">Edytuj opis AI</button>
          <button id="delete-vision-desc-btn" style="flex:1;padding:7px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:#ef4444;font-weight:600;cursor:pointer;">Usuń opis AI</button>
        </div>`;
      }
    }

    const emptyText = node.image ? 'Brak własnej notatki' : 'Brak opisu';
    this.bodyEl.innerHTML = `${imageHtml}<p id="panel-body-text">${node.content || `<span style="opacity:0.4">${emptyText}</span>`}</p>`;

    document.getElementById('edit-node-btn').textContent = 'Edytuj';

    this.renderProjectControls(node);
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
        .map(t => `<option value="${t.id}" ${t.id === node.type ? 'selected' : ''}>${t.name.toUpperCase()}</option>`)
        .join('');

      this.typeEl.innerHTML = `<select id="edit-type" style="background:var(--surface);border:1px solid var(--border);color:white;font-weight:700;cursor:pointer;padding:2px 4px;border-radius:4px;font-size:10px;">${typeOptions}</select>`;
      this.titleEl.innerHTML = `<input type="text" id="edit-title" value="${node.title}" style="width:100%;background:var(--bg-primary);border:1px solid var(--border);padding:6px 10px;border-radius:6px;color:inherit;font-size:18px;font-weight:600;">`;
      this.bodyEl.innerHTML = `<textarea id="edit-body" style="width:100%;height:200px;background:var(--bg-primary);border:1px solid var(--border);padding:10px;border-radius:6px;color:inherit;font-family:inherit;font-size:14px;resize:vertical;">${node.content}</textarea>`;

      document.getElementById('edit-title').focus();
    } else {
      const newTitle = document.getElementById('edit-title').value.trim();
      const newContent = document.getElementById('edit-body').value.trim();
      const newType = document.getElementById('edit-type').value;

      store.updateNode(this.currentNodeId, {
        title: newTitle || '',
        content: newContent,
        type: newType
      });

      this.isEditing = false;
      this.show(this.currentNodeId);
      canvas.render();
    }
  }

  renderConnections(nodeId) {
    this.connectionsEl.innerHTML = '';
    const links = store.getVisibleLinks();
    const nodes = store.getVisibleNodes();

    const connectedIds = links
      .filter(l => l.source === nodeId || l.target === nodeId)
      .map(l => l.source === nodeId ? l.target : l.source);

    connectedIds.forEach(id => {
      const connNode = nodes.find(n => n.id === id);
      if (!connNode) return;

      const li = document.createElement('li');
      li.className = 'connection-item';

      const span = document.createElement('span');
      span.textContent = connNode.title;
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

  handleProjectChange() {
    if (!this.currentNodeId || !this.projectSelect) return;

    store.assignNodeToProject(this.currentNodeId, this.projectSelect.value || null);
    this.show(this.currentNodeId);
    canvas.render();
  }

  toggleStage() {
    const node = store.getNodeById(this.currentNodeId);
    if (!node) return;

    store.setNodeStage(node.id, node.stage === 'plan' ? 'robocze' : 'plan');
    this.show(node.id);
    canvas.render();
  }

  handleDelete() {
    store.deleteNode(this.currentNodeId);
    this.hide();
    canvas.render();
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
        store.updateNode(node.id, { imageDescription: description });
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

    this.bodyEl.innerHTML = `<div style="margin-bottom:12px;border-radius:8px;overflow:hidden;border:1px solid var(--border);">
      <img src="${node.image}" style="width:100%;display:block;" alt="Screenshot" />
    </div>
    <textarea id="vision-desc-editor" style="width:100%;height:260px;background:var(--bg-primary);border:1px solid var(--border);padding:10px;border-radius:6px;color:inherit;font-family:inherit;font-size:13px;resize:vertical;line-height:1.5;">${node.imageDescription || ''}</textarea>
    <div style="display:flex;gap:8px;margin-top:10px;">
      <button id="save-vision-desc-btn" style="flex:1;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text-primary);font-weight:600;cursor:pointer;">Zapisz opis AI</button>
      <button id="cancel-vision-desc-btn" style="flex:1;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-secondary);font-weight:600;cursor:pointer;">Anuluj</button>
    </div>`;
    document.getElementById('vision-desc-editor')?.focus();
  }

  saveVisionDescription() {
    const textarea = document.getElementById('vision-desc-editor');
    if (!textarea || !this.currentNodeId) return;

    store.updateNode(this.currentNodeId, {
      imageDescription: textarea.value.trim()
    });
    this.show(this.currentNodeId);
    canvas.render();
  }

  deleteVisionDescription() {
    if (!this.currentNodeId) return;

    store.updateNode(this.currentNodeId, { imageDescription: '' });
    this.show(this.currentNodeId);
    canvas.render();
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const panel = new Panel();
