// ============================================================================
// NEXUS — ContextBuilder (F6.8)
// UI do budowania kontekstu dla agenta AI przez zaznaczanie ptaszkami
// które notatki, taski, manuskrypty i inne elementy dołączyć
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ContextConfig, ContextEntityRef } from '../../../shared/types/schema';

// === Types =================================================================
interface WorkspaceEntities {
  nodes: { id: string; title: string }[];
  tasks: { id: string; title: string }[];
  drafts: { id: string; contentPreview: string }[];
}

interface ContextBuilderProps {
  config?: ContextConfig;
  onChange: (config: ContextConfig) => void;
}

// === Helper: count selected entities =======================================
function countSelected(entities: ContextEntityRef[] | undefined): { nodes: number; tasks: number; drafts: number; total: number } {
  const list = entities || [];
  const nodes = list.filter(e => e.type === 'node').length;
  const tasks = list.filter(e => e.type === 'task').length;
  const drafts = list.filter(e => e.type === 'draft').length;
  return { nodes, tasks, drafts, total: list.length };
}

// === Component =============================================================
export function ContextBuilder({ config, onChange }: ContextBuilderProps) {
  const [entities, setEntities] = useState<WorkspaceEntities>({ nodes: [], tasks: [], drafts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const includedEntities = config?.includedEntities || [];

  // Dynamiczne etykiety dla fleksji (język polski)
  const entityLabel = useCallback((count: number, singular: string, plural: string): string => {
    if (count === 1) return singular;
    return plural;
  }, []);

  // Load workspace entities
  const loadEntities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bridge = (window as any).nexusBridge;
      if (!bridge?.getWorkspaceEntities) {
        setError('Brak mostu IPC — upewnij się, że aplikacja działa w Electron');
        setEntities({ nodes: [], tasks: [], drafts: [] });
        setLoading(false);
        return;
      }
      const result = await bridge.getWorkspaceEntities();
      setEntities(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać listy');
      setEntities({ nodes: [], tasks: [], drafts: [] });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadEntities().then(() => {
      // no-op; funkcja ustawia stan wewnętrznie
    });
    return () => { cancelled = true; };
  }, [loadEntities]);

  // Toggle entity selected/unselected
  const toggleEntity = useCallback((type: 'node' | 'task' | 'draft', entityId: string) => {
    const current = config?.includedEntities || [];
    const exists = current.find(e => e.type === type && e.entityId === entityId);
    let next: ContextEntityRef[];
    if (exists) {
      next = current.filter(e => !(e.type === type && e.entityId === entityId));
    } else {
      next = [...current, { type, entityId }];
    }
    onChange({
      ...(config || { sources: [], maxTokens: 8192, includeSystemPrompt: true, customInstructions: '', includeClipboardImage: false, includeLastAgentOutput: false }),
      includedEntities: next,
    });
  }, [config, onChange]);

  // Toggle boolean flags
  const toggleFlag = useCallback((field: 'includeClipboardImage' | 'includeLastAgentOutput') => {
    onChange({
      ...(config || { sources: [], maxTokens: 8192, includeSystemPrompt: true, customInstructions: '', includedEntities: [], includeClipboardImage: false, includeLastAgentOutput: false }),
      [field]: !config?.[field],
    });
  }, [config, onChange]);

  // Check if entity is selected
  const isSelected = useCallback((type: 'node' | 'task' | 'draft', entityId: string): boolean => {
    return includedEntities.some(e => e.type === type && e.entityId === entityId);
  }, [includedEntities]);

  // Summary
  const summary = useMemo(() => countSelected(includedEntities), [includedEntities]);

  // Summary text builder
  const summaryText = useMemo(() => {
    if (summary.total === 0) return null;
    const labelMap: Array<{ count: number; singular: string; plural: string }> = [];
    if (summary.nodes > 0) labelMap.push({ count: summary.nodes, singular: 'notatkę', plural: 'notatki' });
    if (summary.tasks > 0) labelMap.push({ count: summary.tasks, singular: 'task', plural: 'taski' });
    if (summary.drafts > 0) labelMap.push({ count: summary.drafts, singular: 'manuskrypt', plural: 'manuskrypty' });

    const parts = labelMap.map(l => `${l.count} ${entityLabel(l.count, l.singular, l.plural)}`);
    return `Wybrano: ${summary.total} ${entityLabel(summary.total, 'element', 'elementy')} (${parts.join(', ')})`;
  }, [summary, entityLabel]);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg px-4 py-2.5 flex items-center justify-between">
        <span className="text-[12px] text-[rgb(var(--text-muted))]">
          {summaryText ? (
            <><strong className="text-[rgb(var(--accent))]">{summary.total}</strong> {entityLabel(summary.total, 'element wybrany', 'elementy wybrane')} — {(() => {
              const parts: string[] = [];
              if (summary.nodes > 0) parts.push(`${summary.nodes} ${entityLabel(summary.nodes, 'notatka', 'notatki')}`);
              if (summary.tasks > 0) parts.push(`${summary.tasks} ${entityLabel(summary.tasks, 'task', 'taski')}`);
              if (summary.drafts > 0) parts.push(`${summary.drafts} ${entityLabel(summary.drafts, 'manuskrypt', 'manuskrypty')}`);
              return parts.join(', ');
            })()}</>
          ) : (
            'Nie wybrano żadnych elementów — agent otrzyma tylko placeholdery'
          )}
        </span>
        <button
          onClick={loadEntities}
          disabled={loading}
          className="px-2.5 py-1 text-[11px] font-medium bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))] border border-[rgb(var(--accent))]/30 rounded-lg hover:bg-[rgb(var(--accent))]/25 transition-colors disabled:opacity-40 cursor-pointer shrink-0"
        >
          {loading ? 'Odświeżanie...' : 'Odśwież listę'}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-2 text-[12px] text-red-400">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-[rgb(var(--accent))] border-t-transparent rounded-full animate-spin" />
          <span className="ml-2 text-[12px] text-[rgb(var(--text-muted))]">Ładowanie workspace...</span>
        </div>
      )}

      {!loading && (
        <div className="space-y-3">
          {/* Nexus Canvas — Nodes */}
          <Section title="Nexus Canvas — Notatki" count={summary.nodes}>
            {entities.nodes.length === 0 ? (
              <p className="text-[11px] text-[rgb(var(--text-muted))] italic px-1">Brak notatek w workspace</p>
            ) : (
              <div className="space-y-1">
                {entities.nodes.map(node => (
                  <CheckboxRow
                    key={node.id}
                    label={node.title}
                    checked={isSelected('node', node.id)}
                    onChange={() => toggleEntity('node', node.id)}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Lab Tasks */}
          <Section title="Lab — Taski" count={summary.tasks}>
            {entities.tasks.length === 0 ? (
              <p className="text-[11px] text-[rgb(var(--text-muted))] italic px-1">Brak tasków w workspace</p>
            ) : (
              <div className="space-y-1">
                {entities.tasks.map(task => (
                  <CheckboxRow
                    key={task.id}
                    label={task.title}
                    checked={isSelected('task', task.id)}
                    onChange={() => toggleEntity('task', task.id)}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Lab Writing — Drafts */}
          <Section title="Lab — Manuskrypty" count={summary.drafts}>
            {entities.drafts.length === 0 ? (
              <p className="text-[11px] text-[rgb(var(--text-muted))] italic px-1">Brak manuskryptów w workspace</p>
            ) : (
              <div className="space-y-1">
                {entities.drafts.map(draft => (
                  <CheckboxRow
                    key={draft.id}
                    label={draft.contentPreview}
                    checked={isSelected('draft', draft.id)}
                    onChange={() => toggleEntity('draft', draft.id)}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Inne — dodatowe opcje */}
          <Section title="Inne" count={0}>
            <div className="space-y-2 px-1">
              <ToggleRow
                label="Dołącz obraz z schowka"
                description="Jeśli w schowku znajduje się obraz, zostanie dołączony do kontekstu"
                checked={config?.includeClipboardImage || false}
                onChange={() => toggleFlag('includeClipboardImage')}
              />
              <ToggleRow
                label="Dołącz output ostatniego agenta"
                description="Ostatni wygenerowany output przez tego agenta (jeśli istnieje)"
                checked={config?.includeLastAgentOutput || false}
                onChange={() => toggleFlag('includeLastAgentOutput')}
              />
            </div>
          </Section>
        </div>
      )}

      {/* Info about limit */}
      <p className="text-[10px] text-[rgb(var(--text-muted))] italic text-center">
        Wyświetlane są ostatnie 20 elementów każdego typu. Użyj pola "Instrukcje dodatkowe" w zakładce Kontekst, aby dodać własne.
      </p>
    </div>
  );
}

// === Section sub-component =================================================
function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[rgb(var(--border))] bg-[rgb(var(--background))]/50">
        <span className="text-[12px] font-medium text-[rgb(var(--text-main))]">{title}</span>
        {count > 0 && (
          <span className="text-[10px] text-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10 px-1.5 py-0.5 rounded-full">
            {count} wybrano
          </span>
        )}
      </div>
      <div className="p-2">
        {children}
      </div>
    </div>
  );
}

// === Checkbox row sub-component ============================================
function CheckboxRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[rgb(var(--accent))]/5 transition-colors cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="accent-[rgb(var(--accent))] cursor-pointer shrink-0"
      />
      <span className={`text-[12px] truncate flex-1 ${checked ? 'text-[rgb(var(--text-main))]' : 'text-[rgb(var(--text-muted))]'}`}>
        {label}
      </span>
      {checked && (
        <span className="text-[9px] text-[rgb(var(--accent))] opacity-0 group-hover:opacity-100 transition-opacity">
          odznacz
        </span>
      )}
    </label>
  );
}

// === Toggle row sub-component ==============================================
function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-start gap-3 px-2 py-2 rounded hover:bg-[rgb(var(--accent))]/5 transition-colors cursor-pointer group">
      <div className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only peer"
        />
        <div className="w-8 h-4 bg-[rgb(var(--border))] rounded-full peer peer-checked:bg-[rgb(var(--accent))]/60 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-3 after:h-3 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
      </div>
      <div className="flex-1 min-w-0">
        <span className={`text-[12px] font-medium block ${checked ? 'text-[rgb(var(--text-main))]' : 'text-[rgb(var(--text-muted))]'}`}>
          {label}
        </span>
        <span className={`text-[10px] block mt-0.5 ${checked ? 'text-[rgb(var(--text-muted))]' : 'text-[rgb(var(--text-muted))]/60'}`}>
          {description}
        </span>
      </div>
    </label>
  );
}
