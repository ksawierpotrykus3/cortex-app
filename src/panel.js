import * as d3 from 'd3';
import { store } from './store.js';
import { graph } from './graph.js';
import { COLORS } from './constants.js';

class Panel {
  constructor() {
    this.el = document.getElementById('side-panel');
    this.titleEl = document.getElementById('panel-title');
    this.typeEl = document.getElementById('panel-type-badge');
    this.metaEl = document.getElementById('panel-meta');
    this.bodyEl = document.getElementById('panel-body');
    this.connectionsEl = document.getElementById('panel-connections');
    this.closeBtn = document.getElementById('panel-close');
    
    this.isEditing = false;
    this.isLinking = false;
    this.currentNodeId = null;
    this.init();
  }

  init() {
    this.closeBtn.addEventListener('click', () => this.hide());
    
    // Close or toggle modes on keys
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.isLinking) this.cancelLinking();
        else if (!this.isEditing) this.hide();
      }
      
      if (e.key === 'Tab') {
        e.preventDefault();
        if (this.isLinking) this.cancelLinking();
        else this.startLinking(true); // true = persistent mode
      }
    });

    // Event listeners for footer buttons
    document.getElementById('edit-node-btn').addEventListener('click', () => this.toggleEdit());
    document.getElementById('delete-node-btn').addEventListener('click', () => this.handleDelete());
    document.getElementById('park-node-btn').addEventListener('click', () => this.handlePark());
    document.getElementById('add-link-btn').addEventListener('click', () => this.startLinking());
  }

  show(node) {
    if (this.isLinking) {
      this.completeLinking(node.id);
      if (!this.persistentLinking) this.cancelLinking();
      return;
    }

    // Don't show panel if we are just clicking nodes to link in persistent mode
    // but we need a starting node. Let's allow showing if not linking.
    if (this.isLinking && this.persistentLinking) return;

    // Clear previous active state
    d3.selectAll('.node-container').classed('node-active', false);
    // Set new active state
    d3.select(`.node-container[data-id="${node.id}"]`).classed('node-active', true);

    this.currentNodeId = node.id;
    this.isEditing = false;
    this.isLinking = false;
    
    // Fill data
    this.titleEl.textContent = node.title;
    this.typeEl.textContent = node.type;
    this.typeEl.style.backgroundColor = COLORS[node.type];
    this.metaEl.textContent = `Dodano: ${new Date(node.createdAt).toLocaleDateString('pl-PL')}`;
    this.bodyEl.innerHTML = `<p id="panel-body-text">${node.content || 'Brak opisu...'}</p>`;
    
    // Reset buttons
    document.getElementById('edit-node-btn').textContent = 'Edytuj';
    
    // Render connections
    this.renderConnections(node.id);
    
    // UI state
    this.el.classList.remove('hidden');
  }

  hide() {
    d3.selectAll('.node-container').classed('node-active', false);
    this.el.classList.add('hidden');
    this.currentNodeId = null;
    this.isEditing = false;
    this.isLinking = false;
  }

  startLinking(persistent = false) {
    this.isLinking = true;
    this.persistentLinking = persistent;
    
    const btn = document.getElementById('add-link-btn');
    btn.textContent = persistent ? 'TRYB ŁĄCZENIA: Klikaj w node\'y (Tab by wyjść)' : 'Kliknij w inny node... (Esc by anulować)';
    btn.style.borderColor = 'var(--accent)';
    btn.style.color = 'var(--accent)';
    
    document.body.style.cursor = 'crosshair';
  }

  cancelLinking() {
    this.isLinking = false;
    this.persistentLinking = false;
    const btn = document.getElementById('add-link-btn');
    btn.textContent = 'Połącz z innym...';
    btn.style.borderColor = '';
    btn.style.color = '';
    document.body.style.cursor = '';
  }

  completeLinking(targetId) {
    if (!this.currentNodeId || targetId === this.currentNodeId) {
      // In persistent mode, the clicked node becomes the new source
      this.currentNodeId = targetId;
      return;
    }
    
    store.addLink(this.currentNodeId, targetId);
    
    // In persistent mode, the target becomes the next source (chaining)
    if (this.persistentLinking) {
      this.currentNodeId = targetId;
    }

    // Re-render
    graph.setData({ nodes: store.getNodes(), links: store.getLinks() });
    if (!this.el.classList.contains('hidden')) {
      this.renderConnections(this.currentNodeId);
    }
  }

  toggleEdit() {
    const node = store.getNodes().find(n => n.id === this.currentNodeId);
    if (!node) return;

    if (!this.isEditing) {
      // Switch to Edit Mode
      this.isEditing = true;
      document.getElementById('edit-node-btn').textContent = 'Zapisz';
      
      this.titleEl.innerHTML = `<input type="text" id="edit-title" value="${node.title}" style="width:100%; background: var(--bg-primary); border: 1px solid var(--border); padding: 4px 8px; border-radius: 4px; color: inherit; font-size: 18px; font-weight: 600;">`;
      this.bodyEl.innerHTML = `<textarea id="edit-body" style="width:100%; height: 200px; background: var(--bg-primary); border: 1px solid var(--border); padding: 8px; border-radius: 4px; color: inherit; font-family: inherit; font-size: 14px; resize: vertical;">${node.content}</textarea>`;
      
      document.getElementById('edit-title').focus();
    } else {
      // Save Changes
      const newTitle = document.getElementById('edit-title').value.trim();
      const newContent = document.getElementById('edit-body').value.trim();
      
      store.updateNode(this.currentNodeId, {
        title: newTitle || 'Bez tytułu',
        content: newContent
      });

      this.isEditing = false;
      this.show(store.getNodes().find(n => n.id === this.currentNodeId));
      
      // Update Graph
      graph.setData({ nodes: store.getNodes(), links: store.getLinks() });
    }
  }

  renderConnections(nodeId) {
    this.connectionsEl.innerHTML = '';
    const links = store.getLinks();
    const nodes = store.getNodes();
    
    const connectedIds = links
      .filter(l => l.source.id === nodeId || l.target.id === nodeId || l.source === nodeId || l.target === nodeId)
      .map(l => {
        const other = (l.source.id === nodeId || l.source === nodeId) ? l.target : l.source;
        return typeof other === 'object' ? other.id : other;
      });

    connectedIds.forEach(id => {
      const connNode = nodes.find(n => n.id === id);
      if (connNode) {
        const li = document.createElement('li');
        li.textContent = connNode.title;
        li.addEventListener('click', () => {
          this.show(connNode);
          graph.focusNode(connNode.id);
        });
        this.connectionsEl.appendChild(li);
      }
    });

    if (connectedIds.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Brak połączeń';
      li.style.cursor = 'default';
      li.style.opacity = 0.5;
      this.connectionsEl.appendChild(li);
    }
  }

  handleDelete() {
    if (confirm('Czy na pewno chcesz usunąć ten element?')) {
      store.deleteNode(this.currentNodeId);
      this.hide();
      graph.setData({ nodes: store.getNodes(), links: store.getLinks() });
    }
  }

  handlePark() {
    store.parkNode(this.currentNodeId);
    this.hide();
    graph.setData({ nodes: store.getNodes(), links: store.getLinks() });
    alert('Node przeniesiony do parkingu.');
  }
}

export const panel = new Panel();
