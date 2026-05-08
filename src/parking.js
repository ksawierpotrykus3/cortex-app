import { store } from './store.js';
import { graph } from './graph.js';

class Parking {
  constructor() {
    this.view = document.getElementById('parking-view');
    this.list = document.getElementById('parking-list');
    this.toggleBtn = document.getElementById('parking-toggle');
    this.closeBtn = document.getElementById('close-parking');
    
    this.init();
  }

  init() {
    this.toggleBtn.addEventListener('click', () => this.show());
    this.closeBtn.addEventListener('click', () => this.hide());
    
    // Close on overlay click
    this.view.addEventListener('click', (e) => {
      if (e.target === this.view) this.hide();
    });
  }

  show() {
    this.render();
    this.view.classList.remove('hidden');
  }

  hide() {
    this.view.classList.add('hidden');
  }

  render() {
    const parkedNodes = store.getParking();
    this.list.innerHTML = '';

    if (parkedNodes.length === 0) {
      this.list.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">Parking jest pusty. Tu trafiają rzeczy "nie-teraz".</div>';
      return;
    }

    parkedNodes.forEach(node => {
      const item = document.createElement('div');
      item.className = 'parking-item';
      item.style.cssText = `
        padding: 16px;
        background: var(--bg-primary);
        border: 1px solid var(--border);
        border-radius: 8px;
        margin-bottom: 12px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      `;

      const info = document.createElement('div');
      info.innerHTML = `
        <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">${node.type}</div>
        <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">${node.title}</div>
        <div style="font-size: 11px; color: var(--text-muted);">Zaparkowano: ${new Date(node.parkedAt).toLocaleDateString('pl-PL')}</div>
      `;

      const actions = document.createElement('div');
      const restoreBtn = document.createElement('button');
      restoreBtn.textContent = 'Przywróć';
      restoreBtn.style.cssText = 'padding: 4px 12px; background: var(--accent); color: white; border-radius: 4px; font-size: 12px;';
      restoreBtn.addEventListener('click', () => {
        store.restoreNode(node.id);
        this.render();
        graph.setData({ nodes: store.getNodes(), links: store.getLinks() });
      });

      actions.appendChild(restoreBtn);
      item.appendChild(info);
      item.appendChild(actions);
      this.list.appendChild(item);
    });
  }
}

export const parking = new Parking();
