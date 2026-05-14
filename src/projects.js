import { store } from './store.js';
import { canvas } from './canvas.js';
import { panel } from './panel.js';
import { ROOT_LAYER_ID } from './schema.js';

class Projects {
  constructor() {
    this.scopeSelect = document.getElementById('project-scope');
    this.createBtn = document.getElementById('create-project-btn');
    this.renameBtn = document.getElementById('rename-project-btn');
    this.deleteBtn = document.getElementById('delete-project-btn');
    this.layerBackBtn = document.getElementById('layer-back-btn');
    this.layerTitleBtn = document.getElementById('layer-title-btn');
    this.init();
  }

  init() {
    this.renderScopeOptions();
    this.renderLayerControls();

    this.scopeSelect?.addEventListener('change', () => {
      store.setActiveProjectId(this.scopeSelect.value);
      canvas.render();
      panel.hide();
      this.renderLayerControls();
    });

    this.createBtn?.addEventListener('click', () => {
      const name = prompt('Nazwa projektu');
      const project = store.createProject(name);
      if (!project) return;
      this.renderScopeOptions();
      this.scopeSelect.value = project.id;
      this.renderLayerControls();
      canvas.render();
    });

    this.renameBtn?.addEventListener('click', () => this.renameActiveProject());
    this.deleteBtn?.addEventListener('click', () => this.deleteActiveProject());
    this.layerBackBtn?.addEventListener('click', () => {
      store.backToParentLayer();
      this.renderScopeOptions();
      this.renderLayerControls();
      panel.hide();
      canvas.render();
    });
    this.layerTitleBtn?.addEventListener('click', () => this.renameActiveLayer());

    window.addEventListener('scope-changed', () => {
      this.renderScopeOptions();
      this.renderLayerControls();
    });
  }

  renderScopeOptions() {
    if (!this.scopeSelect) return;

    const active = store.getActiveProjectId();
    const projects = store.getProjects();
    this.scopeSelect.innerHTML = `
      <option value="all">Wszystko</option>
      <option value="dirty">Brudna tablica</option>
      ${projects.map(project => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join('')}
    `;
    this.scopeSelect.value = active;
  }

  renderLayerControls() {
    const activeLayerId = store.getActiveLayerId();
    if (this.layerTitleBtn) {
      this.layerTitleBtn.textContent = store.getLayerTitle(activeLayerId);
      this.layerTitleBtn.disabled = activeLayerId === ROOT_LAYER_ID;
    }
    if (this.layerBackBtn) {
      this.layerBackBtn.disabled = activeLayerId === ROOT_LAYER_ID;
    }
    if (this.renameBtn) {
      const activeProjectId = store.getActiveProjectId();
      this.renameBtn.disabled = activeProjectId === 'all' || activeProjectId === 'dirty';
    }
    if (this.deleteBtn) {
      const activeProjectId = store.getActiveProjectId();
      this.deleteBtn.disabled = activeProjectId === 'all' || activeProjectId === 'dirty';
    }
  }

  renameActiveProject() {
    const id = store.getActiveProjectId();
    const project = store.getProjectById(id);
    if (!project) return;
    const name = prompt('Nowa nazwa projektu', project.name);
    if (!name) return;
    store.renameProject(id, name);
    this.renderScopeOptions();
    canvas.render();
  }

  deleteActiveProject() {
    const id = store.getActiveProjectId();
    const project = store.getProjectById(id);
    if (!project) return;
    if (!confirm(`Usunąć projekt "${project.name}"? Notki wrócą na brudną tablicę.`)) return;
    store.deleteProject(id);
    this.renderScopeOptions();
    this.renderLayerControls();
    panel.hide();
    canvas.render();
  }

  renameActiveLayer() {
    const id = store.getActiveLayerId();
    if (id === ROOT_LAYER_ID) return;
    const name = prompt('Nowy tytuł warstwy', store.getLayerTitle(id));
    if (!name) return;
    store.renameLayer(id, name);
    this.renderLayerControls();
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

export const projects = new Projects();
