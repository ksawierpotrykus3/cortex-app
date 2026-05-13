import { store } from './store.js';
import { vision } from './vision.js';

/**
 * Global Flash Chat — ask Flash about your entire Cortex.
 * Sends all notes as context + user question.
 */
class FlashChat {
  constructor() {
    this.panel = document.getElementById('flash-panel');
    this.messagesEl = document.getElementById('flash-messages');
    this.inputEl = document.getElementById('flash-input');
    this.sendBtn = document.getElementById('flash-send-btn');
    this.toggleBtn = document.getElementById('flash-toggle');

    if (!this.panel) return;
    this.init();
  }

  init() {
    // Toggle panel
    this.toggleBtn?.addEventListener('click', () => {
      this.panel.classList.toggle('hidden');
      if (!this.panel.classList.contains('hidden')) {
        this.inputEl?.focus();
      }
    });

    // Send
    this.sendBtn?.addEventListener('click', () => this.send());
    this.inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });

    // Close on Esc
    this.inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.panel.classList.add('hidden');
    });
  }

  _buildContext() {
    const nodes = store.getNodes();
    if (nodes.length === 0) return 'Brak notatek w systemie.';

    const lines = nodes.map(n => {
      let entry = `[${n.type.toUpperCase()}] ${n.title || '(bez tytułu)'}`;
      if (n.content) entry += `\n${n.content}`;
      if (n.imageDescription) entry += `\n[Opis screena]: ${n.imageDescription}`;
      return entry;
    });

    return `Oto wszystkie notatki użytkownika (${nodes.length} szt.):\n\n${lines.join('\n---\n')}`;
  }

  async send() {
    const q = this.inputEl?.value.trim();
    if (!q) return;

    // User bubble
    this._addBubble(q, 'user');
    this.inputEl.value = '';
    this.sendBtn.disabled = true;

    // Loading
    const loadEl = this._addBubble('⏳ myślę...', 'loading');

    // Build context + question
    const context = this._buildContext();
    const fullPrompt = `${context}\n\n---\nPytanie użytkownika: ${q}\n\nOdpowiedz po polsku, zwięźle i konkretnie. Bazuj na kontekście notatek powyżej.`;

    if (!vision.hasApiKey()) {
      loadEl.textContent = '[Ustaw API key w ⚙️]';
      loadEl.classList.add('error');
      this.sendBtn.disabled = false;
      return;
    }

    try {
      const answer = await vision.queryText(fullPrompt);
      loadEl.textContent = answer;
      loadEl.classList.remove('flash-loading');
      loadEl.classList.add('flash-answer');
    } catch (err) {
      loadEl.textContent = `[Błąd: ${err.message}]`;
      loadEl.classList.add('error');
    }

    this.sendBtn.disabled = false;
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    this.inputEl.focus();
  }

  _addBubble(text, type) {
    const el = document.createElement('div');
    el.className = `flash-bubble flash-${type}`;
    el.textContent = text;
    this.messagesEl.appendChild(el);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return el;
  }
}

export const flashChat = new FlashChat();
