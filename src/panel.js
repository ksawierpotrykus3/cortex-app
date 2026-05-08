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
    
    this.currentNodeId = null;
    this.init();
  }

  init() {
    this.closeBtn.addEventListener('click', () => this.hide());
    
    // Close on Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });

    // Event listeners for footer buttons
    document.getElementById('delete-node-btn').addEventListener('click', () => this.handleDelete());
    document.getElementById('park-node-btn').addEventListener('click', () => this.handlePark());
  }

  show(node) {
    this.currentNodeId = node.id;
    
    // Fill data
    this.titleEl.textContent = node.title;
    this.typeEl.textContent = node.type;
    this.typeEl.style.backgroundColor = COLORS[node.type];
    this.metaEl.textContent = `Dodano: ${new Date(node.createdAt).toLocaleDateString('pl-PL')}`;
    this.bodyEl.textContent = node.content || 'Brak opisu...';
    
    // Render connections
    this.renderConnections(node.id);
    
    // UI state
    this.el.classList.remove('hidden');
  }

  hide() {
    this.el.classList.add('hidden');
    this.currentNodeId = null;
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
