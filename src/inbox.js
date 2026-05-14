import { store } from './store.js';

class InboxPanel {
  constructor() {
    this.panel = document.getElementById('inbox-panel');
    this.list = document.getElementById('inbox-list');
    this.input = document.getElementById('inbox-input');
    this.init();
  }

  init() {
    document.getElementById('inbox-toggle')?.addEventListener('click', () => {
      this.render();
      this.panel?.classList.toggle('hidden');
      if (!this.panel?.classList.contains('hidden')) this.input?.focus();
    });

    document.getElementById('inbox-close')?.addEventListener('click', () => {
      this.panel?.classList.add('hidden');
    });

    this.input?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.shiftKey) return;
      event.preventDefault();
      this.addMessage();
    });

    document.getElementById('inbox-copy-btn')?.addEventListener('click', async () => {
      const text = store.copyInboxContext({ markCopied: true });
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        prompt('Skopiuj inbox dla AI:', text);
      }
      this.render();
    });

    store.onChange(() => this.render());
    this.render();
  }

  addMessage() {
    const text = this.input?.value || '';
    const message = store.addInboxMessage(text);
    if (!message) return;
    this.input.value = '';
    this.render();
  }

  render() {
    if (!this.list) return;
    const messages = store.getInboxMessages();
    this.list.innerHTML = '';

    if (!messages.length) {
      const empty = document.createElement('div');
      empty.className = 'inbox-empty';
      empty.textContent = 'Brak szybkich wpisów.';
      this.list.appendChild(empty);
      return;
    }

    messages.forEach(message => {
      const row = document.createElement('div');
      row.className = 'inbox-message';

      const text = document.createElement('div');
      text.className = 'inbox-message-text';
      text.textContent = message.text;

      const meta = document.createElement('div');
      meta.className = 'inbox-message-meta';
      const date = document.createElement('span');
      date.textContent = formatDate(message.createdAt);
      const del = document.createElement('button');
      del.className = 'inbox-delete';
      del.textContent = 'Usuń';
      del.addEventListener('click', () => {
        store.deleteInboxMessage(message.id);
        this.render();
      });
      meta.appendChild(date);
      meta.appendChild(del);

      row.appendChild(text);
      row.appendChild(meta);
      this.list.appendChild(row);
    });
  }
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '';
  }
}

export const inboxPanel = new InboxPanel();
