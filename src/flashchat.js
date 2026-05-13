import { store } from './store.js';
import { vision } from './vision.js';

/**
 * Global Flash Chat.
 * Sends the same semantic board snapshot that is used by the AI export.
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
    this.toggleBtn?.addEventListener('click', () => {
      this.panel.classList.toggle('hidden');
      if (!this.panel.classList.contains('hidden')) {
        this.inputEl?.focus();
      }
    });

    this.sendBtn?.addEventListener('click', () => this.send());
    this.inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });

    this.inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.panel.classList.add('hidden');
    });
  }

  _buildContext() {
    const semanticContext = store.buildSemanticContext();
    return `Widoczna tablica Cortex jako kompaktowy JSON dla AI. Nie ma tu obrazów base64 ani danych technicznych, tylko tekst, opisy screenów, układ i połączenia:\n${semanticContext}`;
  }

  async send() {
    const q = this.inputEl?.value.trim();
    if (!q) return;

    this._addBubble(q, 'user');
    this.inputEl.value = '';
    this.sendBtn.disabled = true;

    const loadEl = this._addBubble('myślę...', 'loading');
    const context = this._buildContext();
    const fullPrompt = `${context}\n\n---\nPytanie użytkownika: ${q}\n\nOdpowiedz po polsku, zwięźle i konkretnie. Bazuj na widocznej tablicy powyżej.`;

    if (!vision.hasApiKey()) {
      loadEl.textContent = '[Ustaw API key w ustawieniach]';
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
