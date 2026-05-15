import { store } from './store.js';
import { canvas } from './canvas.js';

/**
 * Category Manager — modal UI for managing custom categories.
 * Handles CRUD, color picking, and dynamic type-picker rebuild.
 */
class CategoryManager {
  constructor() {
    this.list = document.getElementById('category-list');
    this.init();
  }

  init() {
    // Add category button (still exists in settings-modal)
    document.getElementById('add-category-btn')?.addEventListener('click', () => {
      this.handleAdd();
    });



    // Build initial type picker
    this.rebuildTypePicker();
  }

  renderList() {
    if (!this.list) return;
    const categories = store.getCategories();
    this.list.innerHTML = '';

    categories.forEach((cat, idx) => {
      const row = document.createElement('div');
      row.className = 'category-row';
      row.dataset.id = cat.id;

      // Color picker
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = cat.color;
      colorInput.className = 'category-color-input';
      colorInput.title = 'Zmień kolor';
      colorInput.addEventListener('change', () => {
        store.updateCategory(cat.id, { color: colorInput.value });
        canvas.render();
        this.rebuildTypePicker();
      });

      // Name (editable)
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = cat.name;
      nameInput.className = 'category-name-input';
      nameInput.addEventListener('change', () => {
        store.updateCategory(cat.id, { name: nameInput.value.trim() || cat.name });
        this.rebuildTypePicker();
      });

      // Move up
      const upBtn = document.createElement('button');
      upBtn.className = 'category-action-btn';
      upBtn.textContent = '▲';
      upBtn.title = 'Przesuń wyżej';
      upBtn.disabled = idx === 0;
      upBtn.addEventListener('click', () => {
        const cats = store.getCategories();
        const ids = cats.map(c => c.id);
        const i = ids.indexOf(cat.id);
        if (i > 0) {
          [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
          store.reorderCategories(ids);
          this.renderList();
          this.rebuildTypePicker();
        }
      });

      // Move down
      const downBtn = document.createElement('button');
      downBtn.className = 'category-action-btn';
      downBtn.textContent = '▼';
      downBtn.title = 'Przesuń niżej';
      downBtn.disabled = idx === categories.length - 1;
      downBtn.addEventListener('click', () => {
        const cats = store.getCategories();
        const ids = cats.map(c => c.id);
        const i = ids.indexOf(cat.id);
        if (i < ids.length - 1) {
          [ids[i], ids[i + 1]] = [ids[i + 1], ids[i]];
          store.reorderCategories(ids);
          this.renderList();
          this.rebuildTypePicker();
        }
      });

      // Delete
      const delBtn = document.createElement('button');
      delBtn.className = 'category-action-btn danger';
      delBtn.textContent = '✕';
      delBtn.title = 'Usuń kategorię';
      delBtn.addEventListener('click', () => {
        store.deleteCategory(cat.id);
        this.renderList();
        this.rebuildTypePicker();
        canvas.render();
      });

      // Count badge
      const count = store.getNodes().filter(n => n.type === cat.id).length;
      const countBadge = document.createElement('span');
      countBadge.className = 'category-count';
      countBadge.textContent = count;
      countBadge.title = `${count} notatek`;

      const defaultLabel = document.createElement('label');
      defaultLabel.className = 'category-default-label';
      defaultLabel.title = 'Domyślna kategoria dla nowych notek';
      const defaultInput = document.createElement('input');
      defaultInput.type = 'radio';
      defaultInput.name = 'default-category';
      defaultInput.checked = cat.isDefault === true;
      defaultInput.addEventListener('change', () => {
        store.updateCategory(cat.id, { isDefault: true });
        this.renderList();
      });
      defaultLabel.appendChild(defaultInput);
      defaultLabel.appendChild(document.createTextNode(' domyślna'));

      const autoTitleInput = document.createElement('input');
      autoTitleInput.type = 'text';
      autoTitleInput.value = cat.autoTitle || '';
      autoTitleInput.placeholder = 'auto-tytuł';
      autoTitleInput.className = 'category-autotitle-input';
      autoTitleInput.addEventListener('change', () => {
        store.updateCategory(cat.id, { autoTitle: autoTitleInput.value.trim() });
      });

      row.appendChild(colorInput);
      row.appendChild(nameInput);
      row.appendChild(countBadge);
      row.appendChild(defaultLabel);
      row.appendChild(autoTitleInput);
      row.appendChild(upBtn);
      row.appendChild(downBtn);
      row.appendChild(delBtn);
      this.list.appendChild(row);
    });
  }

  handleAdd() {
    const nameInput = document.getElementById('new-category-name');
    const colorInput = document.getElementById('new-category-color');
    const name = nameInput?.value.trim();
    const color = colorInput?.value || '#888888';

    if (!name) {
      nameInput?.focus();
      return;
    }

    const result = store.addCategory(name, color);
    if (result) {
      nameInput.value = '';
      this.renderList();
      this.rebuildTypePicker();
    } else {
      // Category with this id already exists
      nameInput.style.borderColor = '#c45c5c';
      setTimeout(() => { nameInput.style.borderColor = ''; }, 1500);
    }
  }

  rebuildTypePicker() {
    // Quick-add was removed; categories are now applied from note creation/editing controls.
  }
}

/**
 * Get dynamic category color for a node type.
 * Use this everywhere instead of COLORS[node.type].
 */
export function getCategoryColor(type) {
  return store.getCategoryColor(type);
}

export function getCategoryName(type) {
  return store.getCategoryName(type);
}

export const categoryManager = new CategoryManager();
