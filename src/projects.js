import { store } from './store.js';
import { canvas } from './canvas.js';
import { panel } from './panel.js';

class Projects {
  constructor() {
    this.scopeSelect = document.getElementById('project-scope');
    this.createBtn = document.getElementById('create-project-btn');
    this.init();
  }

  init() {
    this.renderScopeOptions();

    this.scopeSelect?.addEventListener('change', () => {
      store.setActiveProjectId(this.scopeSelect.value);
      canvas.render();
      panel.hide();
    });

    this.createBtn?.addEventListener('click', () => {
      const name = prompt('Nazwa projektu');
      const project = store.createProject(name);
      if (!project) return;

      this.renderScopeOptions();
      this.scopeSelect.value = project.id;
      canvas.render();
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
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const projects = new Projects();
