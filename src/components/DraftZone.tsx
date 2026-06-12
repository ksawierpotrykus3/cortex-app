// ================================================================
// NEXUS V2 — DraftZone: RLHF Human Feedback Component (Phase 5.3)
// ================================================================
// Miejsce w którym użytkownik koryguje odpowiedzi agenta.
// Zmiany nie zachodzą w locie - są wpisywane w tymczasowy
// formularz i walidowane przez Zod przed wysłaniem do IPC.
//
// ARCHITEKTURA:
// - Formularz tymczasowy (draft) z polami: agentId, instruction, reasoning
// - Walidacja przez Zod przed każdym zapisem
// - IPC send ('save-mutation') po udanej walidacji
// - structuredClone do bezpiecznego forkowania stanu
// - Flatted JSON.stringify dla cyklicznych struktur (telemetry)
// - Toast notifications dla błędów walidacji
// ================================================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AgentMutation, validateMutation, validateSubmissionSafe } from '../shared/validators/schemas';
import type { AgentMutationType } from '../shared/validators/schemas';
import { stringify } from 'flatted';

// ==============================================================
// Stałe
// ==============================================================
const IPC_SAVE_CHANNEL = 'save-mutation';
const IPC_LOG_CHANNEL = 'rlhf-log';

// ==============================================================
// Props
// ============================================================
export interface DraftZoneProps {
  /** ID agenta do korekty (pre-selected) */
  agentId?: string;
  /** Callback po udanym zapisie */
  onSaved?: (mutation: AgentMutationType) => void;
  /** Callback przy błędzie walidacji */
  onValidationError?: (errors: string[]) => void;
  /** Callback przy błędzie IPC */
  onIPCError?: (error: string) => void;
  /** Callback przy zmianie stanu draftu (do autozapisu) */
  onDraftChange?: (draft: DraftState) => void;
}

// ==============================================================
// DraftState — stan tymczasowego formularza
// ============================================================
export interface DraftState {
  agentId: string;
  instruction: string;
  reasoning: string;
  tags: string[];
  requiresApproval: boolean;
}

const EMPTY_DRAFT: DraftState = {
  agentId: '',
  instruction: '',
  reasoning: '',
  tags: [],
  requiresApproval: false,
};

// ==============================================================
// ToastMessage — wewnętrzny typ powiadomienia
// ============================================================
interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

// ==============================================================
// DraftZone — główny komponent
// ============================================================
export function DraftZone({
  agentId: initialAgentId,
  onSaved,
  onValidationError,
  onIPCError,
  onDraftChange,
}: DraftZoneProps) {
  // ============================================================
  // Stan formularza
  // ============================================================
  const [draft, setDraft] = useState<DraftState>(() =>
    initialAgentId ? { ...EMPTY_DRAFT, agentId: initialAgentId } : { ...EMPTY_DRAFT }
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const canSave = !isSubmitting
    && draft.agentId.length >= 3
    && draft.instruction.length >= 10;
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [saveCount, setSaveCount] = useState(0);

  // Ref do licznika toastów (dla auto-dismiss)
  const toastIdRef = useRef(0);

  // ============================================================
  // showToast — dodaje tymczasowe powiadomienie
  // ============================================================
  const showToast = useCallback((type: ToastMessage['type'], text: string) => {
    const id = `toast_${++toastIdRef.current}`;
    setToasts(prev => [...prev, { id, type, text }]);
    // Auto-dismiss po 4 sekundach
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // ============================================================
  // dismissToast — ręczne odrzucenie toasta
  // ============================================================
  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ============================================================
  // setField — aktualizacja pojedynczego pola draftu
  // ============================================================
  const setField = useCallback(<K extends keyof DraftState>(
    field: K,
    value: DraftState[K]
  ) => {
    setDraft(prev => {
      // structuredClone dla bezpiecznego fork (Phase 5.3 wymóg)
      const next = structuredClone(prev);
      next[field] = value;
      return next;
    });

    // Czyścimy błędy walidacji przy zmianie
    setValidationErrors([]);
  }, []);

  // ============================================================
  // addTag / removeTag — zarządzanie tagami
  // ============================================================
  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;
    setDraft(prev => {
      if (prev.tags.includes(trimmed)) return prev;
      const next = structuredClone(prev);
      next.tags = [...next.tags, trimmed];
      return next;
    });
  }, []);

  const removeTag = useCallback((tag: string) => {
    setDraft(prev => {
      const next = structuredClone(prev);
      next.tags = next.tags.filter(t => t !== tag);
      return next;
    });
  }, []);

  // ============================================================
  // handleSave — walidacja i zapis przez IPC
  //
  // 1. structuredClone stanu formularza (bezpieczny fork)
  // 2. Walidacja przez Zod AgentMutation.parse()
  // 3. Jeśli błąd → toast z komunikatem, brak zapisu IPC
  // 4. Jeśli OK → ipcRenderer.send('save-mutation', validData)
  // 5. Po sukcesie → clear formularza, toast sukcesu
  // 6. Telemetry: stringify przez flatted (obsługa cykli)
  // ============================================================
  const handleSave = useCallback(async () => {
    setIsSubmitting(true);
    setValidationErrors([]);

    try {
      // Krok 1: structuredClone — bezpieczny fork stanu
      // Zgodność z Phase 5.3: "Wszelkie operacje forkowania/gałęzienia
      // stanu agentów w Zustand realizuj wyłącznie przez natywne
      // structuredClone."
      const draftClone = structuredClone(draft);

      // Krok 2: Walidacja przez Zod
      // AgentMutation.parse() rzuci ZodError jeśli dane są niepoprawne
      const validated = validateMutation({
        id: draftClone.agentId,
        instruction: draftClone.instruction,
      });

      // Krok 3: Przygotuj pełne submission (z metadanymi)
      const submission = {
        mutation: validated,
        reasoning: draftClone.reasoning || undefined,
        tags: draftClone.tags.length > 0 ? draftClone.tags : undefined,
        requiresApproval: draftClone.requiresApproval,
        metadata: {
          author: 'user' as const,
          timestamp: new Date().toISOString(),
          schemaVersion: 1 as const,
        },
      };

      // Krok 4: Pełna walidacja submission
      const safeResult = validateSubmissionSafe(submission);
      if (!safeResult.success) {
        const messages = safeResult.error.issues.map((e: { message: string }) => e.message);
        setValidationErrors(messages);
        onValidationError?.(messages);
        showToast('error', `Validation failed: ${messages.join('; ')}`);
        setIsSubmitting(false);
        return;
      }

      // Krok 5: Wyślij przez IPC (electron ipcRenderer)
      const sent = await sendViaIPC(IPC_SAVE_CHANNEL, safeResult.data);

      if (sent) {
        // Krok 6: Sukces — clear formularza
        setDraft(prev => ({ ...EMPTY_DRAFT, agentId: prev.agentId }));
        setSaveCount(c => c + 1);
        showToast('success', `Mutation saved for agent "${validated.id}"`);
        onSaved?.(validated);

        // Krok 7: Telemetry log (flatted dla cyklicznych struktur)
        logRLHF({ type: 'save', mutation: validated, timestamp: Date.now() });
      }
    } catch (err: any) {
      // ZodError — niepoprawne dane wejściowe
      if (err?.name === 'ZodError') {
        const messages = err.errors?.map((e: any) => e.message) ?? [err.message];
        setValidationErrors(messages);
        onValidationError?.(messages);
        showToast('error', messages.join('; '));
      } else {
        // Inny błąd (IPC, sieć, itp.)
        const msg = err?.message ?? String(err);
        onIPCError?.(msg);
        showToast('error', `IPC Error: ${msg}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [draft, onSaved, onValidationError, onIPCError, showToast]);

  // ============================================================
  // sendViaIPC — wysyłka przez Electron IPC
  //
  // Próbuje wysłać przez window.electron (preload) lub
  // przez ipcRenderer (nodeIntegration). W przeglądarce
  // symuluje udany zapis (development mode).
  // ============================================================
  async function sendViaIPC(channel: string, data: unknown): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer?.send) {
        (window as any).electron.ipcRenderer.send(channel, data);
        return true;
      } else if (typeof window !== 'undefined' && (window as any).require) {
        const { ipcRenderer } = (window as any).require('electron');
        ipcRenderer.send(channel, data);
        return true;
      }
      // Fallback: symulacja (development)
      console.log(`[DraftZone] IPC send (simulated): ${channel}`, data);
      return true;
    } catch (err) {
      console.error('[DraftZone] IPC send failed:', err);
      return false;
    }
  }

  // ============================================================
  // logRLHF — zapis telemetryczny z flatted stringify
  //
  // Zgodność z Phase 5.3: "Zaimplementuj dedykowany użytek
  // telemetryczny do zapisu logów RLHF, który wykorzystuje
  // stringify zastępujące cykle (np. flatted lub custom replacer)."
  // ============================================================
  function logRLHF(data: unknown): void {
    try {
      // Flatted.stringify obsługuje cykliczne struktury danych
      // które mogą pojawić się w złożonych stanach agentów
      const logLine = stringify({
        event: 'rlhf_save',
        ts: Date.now(),
        data,
      });

      // Wyślij do IPC Log Channel
      if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer?.send) {
        (window as any).electron.ipcRenderer.send(IPC_LOG_CHANNEL, logLine);
      } else if (typeof window !== 'undefined' && (window as any).require) {
        try {
          const { ipcRenderer } = (window as any).require('electron');
          ipcRenderer.send(IPC_LOG_CHANNEL, logLine);
        } catch { /* noop */ }
      }

      // Console fallback
      console.debug('[RLHF-TELEMETRY]', logLine);
    } catch (err) {
      // Flatted nie powinno rzucać, ale na wszelki wypadek
      console.error('[RLHF-TELEMETRY] Flatted stringify failed:', err);
    }
  }

  // ============================================================
  // handleClear — reset formularza
  // ============================================================
  const handleClear = useCallback(() => {
    setDraft(prev => ({ ...EMPTY_DRAFT, agentId: prev.agentId }));
    setValidationErrors([]);
  }, []);

  // ============================================================
  // onChange通知 (dla autozapisu)
  // ============================================================
  const prevDraftRef = useRef(draft);
  useEffect(() => {
    if (prevDraftRef.current !== draft) {
      onDraftChange?.(draft);
      prevDraftRef.current = draft;
    }
  }, [draft, onDraftChange]);

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="draft-zone">
      <div className="draft-zone-header">
        <h3 className="draft-zone-title">RLHF Correction Draft</h3>
        <span className="draft-zone-counter">
          Saved: {saveCount} | Tags: {draft.tags.length}
        </span>
      </div>

      {/* Agent ID */}
      <div className="draft-zone-field">
        <label className="draft-zone-label" htmlFor="dz-agent-id">
          Agent ID
        </label>
        <input
          id="dz-agent-id"
          className="draft-zone-input"
          type="text"
          placeholder="e.g. agent_writer_01"
          value={draft.agentId}
          onChange={e => setField('agentId', e.target.value)}
          disabled={isSubmitting}
          minLength={3}
        />
      </div>

      {/* Instruction */}
      <div className="draft-zone-field">
        <label className="draft-zone-label" htmlFor="dz-instruction">
          Correction Instruction
        </label>
        <textarea
          id="dz-instruction"
          className="draft-zone-textarea"
          placeholder="Describe what the agent should change..."
          value={draft.instruction}
          onChange={e => setField('instruction', e.target.value)}
          disabled={isSubmitting}
          rows={4}
          minLength={10}
        />
        <span className="draft-zone-hint">
          Minimum 10 characters. Current: {draft.instruction.length}
        </span>
      </div>

      {/* Reasoning */}
      <div className="draft-zone-field">
        <label className="draft-zone-label" htmlFor="dz-reasoning">
          Reasoning (optional)
        </label>
        <textarea
          id="dz-reasoning"
          className="draft-zone-textarea draft-zone-textarea--small"
          placeholder="Why is this correction needed?"
          value={draft.reasoning}
          onChange={e => setField('reasoning', e.target.value)}
          disabled={isSubmitting}
          rows={2}
        />
      </div>

      {/* Tags */}
      <div className="draft-zone-field">
        <label className="draft-zone-label">Tags (optional)</label>
        <div className="draft-zone-tags">
          {draft.tags.map(tag => (
            <span key={tag} className="draft-zone-tag">
              {tag}
              <button
                className="draft-zone-tag-remove"
                onClick={() => removeTag(tag)}
                disabled={isSubmitting}
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <TagInput onAdd={addTag} disabled={isSubmitting} />
        </div>
      </div>

      {/* Requires Approval */}
      <div className="draft-zone-field draft-zone-field--checkbox">
        <label className="draft-zone-checkbox-label">
          <input
            type="checkbox"
            checked={draft.requiresApproval}
            onChange={e => setField('requiresApproval', e.target.checked)}
            disabled={isSubmitting}
          />
          <span>Requires human approval before execution</span>
        </label>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="draft-zone-errors">
          {validationErrors.map((err, i) => (
            <div key={i} className="draft-zone-error-item">{err}</div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="draft-zone-actions">
        <button
          className="draft-zone-btn draft-zone-btn--save"
          onClick={handleSave}
          disabled={!canSave}>
          {isSubmitting ? 'Saving...' : 'Save Draft'}
        </button>
        <button
          className="draft-zone-btn draft-zone-btn--clear"
          onClick={handleClear}
          disabled={isSubmitting}
        >
          Clear
        </button>
      </div>

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="draft-zone-toasts">
          {toasts.map(t => (
            <div
              key={t.id}
              className={`draft-zone-toast draft-zone-toast--${t.type}`}
              onClick={() => dismissToast(t.id)}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==============================================================
// TagInput — wewnętrzny komponent dodawania tagów
// ==============================================================
function TagInput({ onAdd, disabled }: { onAdd: (tag: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (value.trim()) {
        onAdd(value);
        setValue('');
      }
    }
  };

  const handleBlur = () => {
    if (value.trim()) {
      onAdd(value);
      setValue('');
    }
  };

  return (
    <input
      className="draft-zone-tag-input"
      type="text"
      placeholder="Add tag... (Enter or comma)"
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      disabled={disabled}
    />
  );
}
