import React, { useState, useMemo, useRef, useEffect } from "react";
import { MessageSquareMore, X, Star } from "lucide-react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { FeedbackEntry, ContextSnapshot, ViewMode } from "../types";
import { useAgentStore } from "../renderer/store/agentStore";

// ============================================================================
// NEXUS — FeedbackModal (#26 Universal Feedback z kontekstem)
// Zastępuje FeedbackButton.tsx — rozszerzony formularz z entity pickerem,
// auto-kontekstem, ratingiem 1-5 i zapisem przez IPC.
// ============================================================================

export type EntityType = FeedbackEntry['entityType'];

interface EntityOption {
  type: EntityType;
  label: string;
}

const ENTITY_OPTIONS: EntityOption[] = [
  { type: 'general', label: 'Ogólny pomysł' },
  { type: 'agent', label: 'Agent AI' },
  { type: 'node', label: 'Notatka' },
  { type: 'task', label: 'Task' },
  { type: 'manuscript', label: 'Manuskrypt' },
];

interface FeedbackModalProps {
  viewMode: ViewMode;
  selectedAgentId: string | null;
  selectedNodeId: string | null;
  selectedTaskId: string | null;
  selectedManuscriptId: string | null;
  projectId: string | null;
  lastAction: string;
  nodes: { id: string; title: string }[];
  tasks: { id: string; title: string }[];
  manuscripts: { id: string; title: string }[];
  onSave: (entry: Omit<FeedbackEntry, 'id' | 'timestamp'>) => Promise<{ success: boolean; error?: string }>;
}

export function FeedbackModal({
  viewMode,
  selectedAgentId,
  selectedNodeId,
  selectedTaskId,
  selectedManuscriptId,
  projectId,
  lastAction,
  nodes,
  tasks,
  manuscripts,
  onSave,
}: FeedbackModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [entityType, setEntityType] = useState<EntityType>('general');
  const [entityId, setEntityId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTrapRef = useFocusTrap(isOpen);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const agents = useAgentStore((s) => s.agents);

  // Build context snapshot
  const contextSnapshot: ContextSnapshot = useMemo(() => ({
    viewMode,
    selectedAgentId: entityType === 'agent' ? entityId : selectedAgentId,
    selectedNodeId: entityType === 'node' ? entityId : selectedNodeId,
    selectedTaskId: entityType === 'task' ? entityId : selectedTaskId,
    selectedManuscriptId: entityType === 'manuscript' ? entityId : selectedManuscriptId,
    projectId,
    lastAction,
  }), [viewMode, selectedAgentId, selectedNodeId, selectedTaskId, selectedManuscriptId, projectId, lastAction, entityType, entityId]);

  // Resolve entity label for context display
  const entityLabel = useMemo(() => {
    if (!entityId) return '';
    switch (entityType) {
      case 'agent': return agents.find(a => a.id === entityId)?.name || entityId;
      case 'node': return nodes.find(n => n.id === entityId)?.title || entityId;
      case 'task': return tasks.find(t => t.id === entityId)?.title || entityId;
      case 'manuscript': return manuscripts.find(m => m.id === entityId)?.title || entityId;
      default: return '';
    }
  }, [entityType, entityId, agents, nodes, tasks, manuscripts]);

  // Get dropdown options based on entity type
  const dropdownOptions = useMemo(() => {
    switch (entityType) {
      case 'agent': return agents.map(a => ({ id: a.id, label: a.name }));
      case 'node': return nodes.map(n => ({ id: n.id, label: n.title }));
      case 'task': return tasks.map(t => ({ id: t.id, label: t.title }));
      case 'manuscript': return manuscripts.map(m => ({ id: m.id, label: m.title }));
      default: return [];
    }
  }, [entityType, agents, nodes, tasks, manuscripts]);

  const isValid = title.trim().length > 0 && description.trim().length > 0;

  const resetForm = () => {
    setEntityType('general');
    setEntityId('');
    setTitle('');
    setDescription('');
    setSuggestion('');
    setRating(0);
    setHoverRating(0);
    setError(null);
    setSent(false);
  };

  const handleSubmit = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    setError(null);

    try {
      const entry: Omit<FeedbackEntry, 'id' | 'timestamp'> = {
        title: title.trim(),
        context: description.trim() || undefined,
        suggestion: suggestion.trim() || undefined,
        entityType,
        entityId: entityId || undefined,
        entityLabel: entityLabel || undefined,
        contextSnapshot,
        rating: rating > 0 ? rating : undefined,
        status: 'new',
      };

      const result = await onSave(entry);
      if (result.success) {
        setSent(true);
        timerRef.current = setTimeout(() => {
          setIsOpen(false);
          resetForm();
        }, 1500);
      } else {
        setError(result.error || 'Nie udało się zapisać feedbacku.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nieoczekiwany błąd.');
    } finally {
      setSaving(false);
    }
  };

  const renderStars = () => {
    const current = hoverRating || rating;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            aria-label={`Ocena ${star} z 5`}
            onClick={() => setRating(star === rating ? 0 : star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="cursor-pointer p-0.5 transition-colors"
          >
            <Star
              size={18}
              className={star <= current ? 'fill-yellow-400 text-yellow-400' : 'text-[rgb(var(--text-muted))]'}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="text-xs text-[rgb(var(--text-muted))] ml-1">{rating}/5</span>
        )}
      </div>
    );
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 bg-[rgb(var(--accent))] text-white px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all text-sm font-medium flex items-center gap-2 cursor-pointer"
      >
        <MessageSquareMore size={16} />
        Przekaż pomysł
      </button>
    );
  }

  return (
    <div
      ref={focusTrapRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => { if (!saving) { setIsOpen(false); resetForm(); } }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Przekaż pomysł"
        className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-6 w-[480px] shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Przekaż pomysł / zgłoś problem</h2>
          <button onClick={() => { if (!saving) { setIsOpen(false); resetForm(); } }} aria-label="Zamknij" className="cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div className="text-center py-8 text-[rgb(var(--accent))] font-medium">
            Dziękujemy za feedback!
          </div>
        ) : (
          <div className="space-y-4">
            {/* Entity Picker */}
            <div>
              <label className="text-xs font-medium text-[rgb(var(--text-muted))]">Dotyczy</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ENTITY_OPTIONS.map((opt) => (
                  <label
                    key={opt.type}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer border transition-colors ${
                      entityType === opt.type
                        ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent-bg))] text-[rgb(var(--accent))]'
                        : 'border-[rgb(var(--border))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="entityType"
                      value={opt.type}
                      checked={entityType === opt.type}
                      onChange={() => { setEntityType(opt.type); setEntityId(''); }}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>

              {/* Dropdown for specific entity */}
              {entityType !== 'general' && dropdownOptions.length > 0 && (
                <select
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  className="w-full mt-2 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">-- Wybierz {ENTITY_OPTIONS.find(o => o.type === entityType)?.label.toLowerCase()} --</option>
                  {dropdownOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Auto-context */}
            <div>
              <label className="text-xs font-medium text-[rgb(var(--text-muted))]">Dołączany kontekst (auto)</label>
              <div className="mt-1 bg-[rgb(var(--background))]/50 border border-[rgb(var(--border))] rounded-lg p-3 text-xs space-y-1 font-mono text-[rgb(var(--text-muted))]">
                <div>Widok: <span className="text-[rgb(var(--text-secondary))]">{viewMode}</span></div>
                {entityLabel && <div>Zaznaczony element: <span className="text-[rgb(var(--text-secondary))]">{entityLabel}</span></div>}
                {projectId && <div>Projekt: <span className="text-[rgb(var(--text-secondary))]">{projectId}</span></div>}
                <div>Ostatnia akcja: <span className="text-[rgb(var(--text-secondary))]">{lastAction}</span></div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="text-xs font-medium text-[rgb(var(--text-muted))]">Tytuł *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="w-full mt-1 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg px-3 py-2 text-sm"
                placeholder="Krótki tytuł zgłoszenia"
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-[rgb(var(--text-muted))]">Opis *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full mt-1 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg px-3 py-2 text-sm resize-none"
                placeholder="Opisz czego dotyczy zgłoszenie..."
              />
            </div>

            {/* Suggestion */}
            <div>
              <label className="text-xs font-medium text-[rgb(var(--text-muted))]">Sugestia (opcjonalnie)</label>
              <textarea
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                rows={2}
                className="w-full mt-1 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg px-3 py-2 text-sm resize-none"
                placeholder="Jak mogłoby działać?"
              />
            </div>

            {/* Rating */}
            <div>
              <label className="text-xs font-medium text-[rgb(var(--text-muted))]">Ocena (opcjonalnie)</label>
              <div className="mt-1">
                {renderStars()}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setIsOpen(false); resetForm(); }}
                disabled={saving}
                className="px-4 py-2 text-sm text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] cursor-pointer disabled:opacity-40"
              >
                Anuluj
              </button>
              <button
                onClick={handleSubmit}
                disabled={!isValid || saving}
                className="px-4 py-2 text-sm bg-[rgb(var(--accent))] text-white rounded-lg disabled:opacity-40 cursor-pointer flex items-center gap-2"
              >
                {saving ? 'Zapisywanie...' : 'Zapisz'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
