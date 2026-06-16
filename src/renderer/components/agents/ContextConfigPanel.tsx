// ============================================================================
// NEXUS — Context Config Panel (F6.2)
// UI do zaznaczania checkboxami co agent ma dostać jako kontekst
// ============================================================================

import React, { useState, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ContextConfig, ContextSource, DEFAULT_CONTEXT_CONFIG, ContextSelection, ContextSourceConfig } from '../../../shared/types/schema';
import { useAgentStore } from '../../store/agentStore';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

interface SourceBreakdownItem {
  sourceId: string;
  chars: number;
  tokens: number;
}

// === Props =================================================================
interface ContextConfigPanelProps {
  config?: ContextConfig;
  onChange: (config: ContextConfig) => void;
  agentId: string;
  agentName: string;
}

// === Modal for test context ================================================
function TestContextModal({
  context,
  tokensUsed,
  maxTokens,
  sourceBreakdown,
  onClose,
}: {
  context: string;
  tokensUsed: number;
  maxTokens: number;
  sourceBreakdown?: SourceBreakdownItem[];
  onClose: () => void;
}) {
  const isOverLimit = tokensUsed > maxTokens;
  const modalRef = useFocusTrap(true);

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Podgląd kontekstu"
        className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl w-[600px] max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[rgb(var(--border))] flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[rgb(var(--text-main))]">
            Podgląd kontekstu
          </h2>
          <button onClick={onClose} aria-label="Zamknij" className="text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] cursor-pointer p-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-3 border-b border-[rgb(var(--border))] flex items-center gap-4 text-[12px]">
          <span className="text-[rgb(var(--text-muted))]">
            Tokeny: <strong className={isOverLimit ? 'text-red-400' : 'text-[rgb(var(--accent))]'}>{tokensUsed}</strong> / {maxTokens}
          </span>
          {isOverLimit && (
            <span className="inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /><span className="text-red-400 font-medium"> Przekroczono limit tokenów</span></span>
          )}
        </div>

        {/* Source Breakdown */}
        {sourceBreakdown && sourceBreakdown.length > 0 && (
          <div className="px-5 py-2 border-b border-[rgb(var(--border))] space-y-1">
            <span className="text-[10px] font-medium text-[rgb(var(--text-muted))] uppercase tracking-wider">Źródła kontekstu</span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {sourceBreakdown.map(item => {
                const label = item.sourceId.startsWith('_') ? item.sourceId.slice(1).replace('_', ' ') : item.sourceId;
                return (
                  <div key={item.sourceId} className="flex items-center justify-between text-[11px] text-[rgb(var(--text-muted))]">
                    <span className="truncate">{label}</span>
                    <span>{item.tokens} tok. ({item.chars} zn.)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          <pre className="text-[12px] text-[rgb(var(--text-muted))] whitespace-pre-wrap font-mono leading-relaxed">
            {context || '(pusty kontekst — wybierz co najmniej jedno źródło)'}
          </pre>
        </div>

        <div className="px-5 py-3 border-t border-[rgb(var(--border))] flex justify-end">
          <button
            onClick={onClose}
            aria-label="Zamknij podgląd"
            className="px-4 py-1.5 text-[12px] font-medium bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))] rounded-lg hover:bg-[rgb(var(--accent))]/30 transition-colors cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}

// === Helper: button to toggle selection type ==============================
function SelectionToggle({
  selection,
  onChange,
}: {
  selection?: ContextSelection;
  onChange: (sel: ContextSelection) => void;
}) {
  const currentType = selection?.type || 'all';
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange({ type: 'all', ids: [] })}
        className={`px-2 py-0.5 text-[10px] rounded cursor-pointer ${
          currentType === 'all'
            ? 'bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))]'
            : 'bg-[rgb(var(--background))] text-[rgb(var(--text-muted))] border border-[rgb(var(--border))]'
        }`}
      >
        Wszystkie
      </button>
      <button
        onClick={() => onChange({ type: 'ids', ids: selection?.ids || [] })}
        className={`px-2 py-0.5 text-[10px] rounded cursor-pointer ${
          currentType === 'ids'
            ? 'bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))]'
            : 'bg-[rgb(var(--background))] text-[rgb(var(--text-muted))] border border-[rgb(var(--border))]'
        }`}
      >
        Wybrane
      </button>
    </div>
  );
}

// === Helper: agent source dropdown ========================================
function AgentDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (agentId: string) => void;
}) {
  const agents = useAgentStore((s) => s.agents);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1.5 text-[12px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]/50"
    >
      <option value="">-- Wybierz agenta --</option>
      {agents.map((agent) => (
        <option key={agent.id} value={agent.id}>
          {agent.name}
        </option>
      ))}
    </select>
  );
}

// === Component =============================================================
export function ContextConfigPanel({ config, onChange, agentId, agentName }: ContextConfigPanelProps) {
  const currentConfig = config || DEFAULT_CONTEXT_CONFIG;
  const [testResult, setTestResult] = useState<{ context: string; tokensUsed: number; sourceBreakdown?: SourceBreakdownItem[] } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Toggle source enabled/disabled
  const toggleSource = useCallback((sourceId: string) => {
    const updatedSources = currentConfig.sources.map(s =>
      s.id === sourceId ? { ...s, enabled: !s.enabled } : s
    );
    onChange({ ...currentConfig, sources: updatedSources });
  }, [currentConfig, onChange]);

  // Update source config
  const updateSourceConfig = useCallback((sourceId: string, configUpdate: Partial<ContextSourceConfig>) => {
    const updatedSources = currentConfig.sources.map(s =>
      s.id === sourceId ? { ...s, config: { ...(s.config || {}), ...configUpdate } } : s
    );
    onChange({ ...currentConfig, sources: updatedSources });
  }, [currentConfig, onChange]);

  // Update source selection
  const updateSelection = useCallback((sourceId: string, selection: ContextSelection) => {
    const updatedSources = currentConfig.sources.map(s =>
      s.id === sourceId ? { ...s, selection } : s
    );
    onChange({ ...currentConfig, sources: updatedSources });
  }, [currentConfig, onChange]);

  // Test context via IPC
  const handleTestContext = useCallback(async () => {
    setIsTesting(true);
    try {
      const bridge = (window as any).nexusBridge;
      if (bridge?.fetchContext) {
        const result = await bridge.fetchContext({
          agentId,
          contextConfig: currentConfig,
        });
        setTestResult(result);
      } else {
        // Fallback — show config summary
        const enabledLabels = currentConfig.sources
          .filter(s => s.enabled)
          .map(s => `• ${s.label}`)
          .join('\n');
        setTestResult({
          context: enabledLabels
            ? `Wybrane źródła kontekstu dla "${agentName}":\n\n${enabledLabels}\n\n(Uruchom w Electron, aby faktycznie pobrać kontekst)`
            : '(Brak wybranych źródeł)',
          tokensUsed: 0,
        });
      }
    } catch (err) {
      setTestResult({
        context: `Błąd: ${err instanceof Error ? err.message : String(err)}`,
        tokensUsed: 0,
      });
    }
    setIsTesting(false);
  }, [agentId, agentName, currentConfig]);

  // Check if file source has no path
  const fileSource = currentConfig.sources.find(s => s.id === 'file' && s.enabled);
  const fileDisabled = fileSource?.enabled && !fileSource.config?.filePath;

  return (
    <div className="space-y-4">
      {/* Context Sources */}
      <div>
        <label className="block text-[11px] font-medium text-[rgb(var(--text-muted))] uppercase tracking-wider mb-2">
          Źródła kontekstu
        </label>
        <div className="space-y-2">
          {currentConfig.sources.map((source) => (
            <div
              key={source.id}
              className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg overflow-hidden"
            >
              {/* Checkbox + Label */}
              <div className="flex items-start gap-2.5 p-3">
                <input
                  type="checkbox"
                  checked={source.enabled}
                  onChange={() => toggleSource(source.id)}
                  className="mt-0.5 accent-[rgb(var(--accent))] cursor-pointer shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-[rgb(var(--text-main))]">
                      {source.label}
                    </span>
                    {source.enabled && (
                      <span className="text-[9px] text-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10 px-1.5 py-0.5 rounded-full">
                        aktywne
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[rgb(var(--text-muted))] mt-0.5">
                    {source.description}
                  </p>
                </div>
              </div>

              {/* Source-specific config (only when enabled) */}
              {source.enabled && (
                <div className="px-3 pb-3 pl-9 space-y-2">
                  {/* Notes: project selector / search / selection */}
                  {source.id === 'notes' && (
                    <>
                      <div>
                        <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-0.5">Projekt</label>
                        <select
                          value={source.config?.projectId || ''}
                          onChange={(e) => updateSourceConfig(source.id, { projectId: e.target.value || undefined })}
                          className="w-full px-2 py-1.5 text-[12px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]/50"
                        >
                          <option value="">Wszystkie projekty</option>
                          <option value="_current">Bieżący projekt</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-0.5">Wybór notatek</label>
                        <SelectionToggle
                          selection={source.selection}
                          onChange={(sel) => updateSelection(source.id, sel)}
                        />
                        {source.selection?.type === 'ids' && source.selection.ids.length === 0 && (
                          <p className="text-[10px] text-yellow-400 mt-0.5">
                            Nie wybrano notatek — zostaną użyte wszystkie
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-0.5">Szukaj notatki</label>
                        <input
                          placeholder="Filtruj po tytule..."
                          className="w-full px-2 py-1.5 text-[12px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]/50 placeholder:text-[rgb(var(--text-muted))]"
                          onChange={() => {/* search handled on renderer side */}}
                        />
                      </div>
                    </>
                  )}

                  {/* Tasks: status filter + selection */}
                  {source.id === 'tasks' && (
                    <>
                      <div>
                        <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-0.5">Status</label>
                        <select
                          value={source.config?.status || ''}
                          onChange={(e) => updateSourceConfig(source.id, { status: e.target.value || undefined })}
                          className="w-full px-2 py-1.5 text-[12px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]/50"
                        >
                          <option value="">Wszystkie</option>
                          <option value="Unresolved">Nierozwiązane</option>
                          <option value="In Progress">W trakcie</option>
                          <option value="Resolved">Rozwiązane</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-0.5">Wybór zadań</label>
                        <SelectionToggle
                          selection={source.selection}
                          onChange={(sel) => updateSelection(source.id, sel)}
                        />
                        {source.selection?.type === 'ids' && source.selection.ids.length === 0 && (
                          <p className="text-[10px] text-yellow-400 mt-0.5">
                            Nie wybrano zadań — zostaną użyte wszystkie
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Manuscripts: folder filter + selection */}
                  {source.id === 'manuscripts' && (
                    <>
                      <div>
                        <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-0.5">Folder</label>
                        <select
                          value={source.config?.folderId || ''}
                          onChange={(e) => updateSourceConfig(source.id, { folderId: e.target.value || undefined })}
                          className="w-full px-2 py-1.5 text-[12px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]/50"
                        >
                          <option value="">Wszystkie foldery</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-0.5">Wybór manuskryptów</label>
                        <SelectionToggle
                          selection={source.selection}
                          onChange={(sel) => updateSelection(source.id, sel)}
                        />
                        {source.selection?.type === 'ids' && source.selection.ids.length === 0 && (
                          <p className="text-[10px] text-yellow-400 mt-0.5">
                            Nie wybrano manuskryptów — zostaną użyte wszystkie
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* History: count */}
                  {source.id === 'history' && (
                    <div>
                      <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-0.5">Liczba ostatnich outputów</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={source.config?.count || 10}
                        onChange={(e) => updateSourceConfig(source.id, { count: parseInt(e.target.value) || 10 })}
                        className="w-full px-2 py-1.5 text-[12px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]/50"
                      />
                    </div>
                  )}

                  {/* Clipboard: no config needed */}
                  {source.id === 'clipboard' && (
                    <p className="text-[10px] text-[rgb(var(--text-muted))] italic">
                      Schowek pobierany automatycznie. Wymaga włączonego <strong>useClipboard</strong> w triggerze agenta.
                    </p>
                  )}

                  {/* Changelog: no config */}
                  {source.id === 'changelog' && (
                    <p className="text-[10px] text-[rgb(var(--text-muted))] italic">
                      Zmiany pobierane od <strong>ostatniego uruchomienia</strong> agenta. Jeśli brak — ostatnie 20 outputów.
                    </p>
                  )}

                  {/* File: path selector */}
                  {source.id === 'file' && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-0.5">Ścieżka pliku</label>
                        <input
                          placeholder="C:/path/to/file.txt"
                          value={source.config?.filePath || ''}
                          onChange={(e) => updateSourceConfig(source.id, { filePath: e.target.value || undefined })}
                          className="w-full px-2 py-1.5 text-[12px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]/50 placeholder:text-[rgb(var(--text-muted))]"
                        />
                      </div>
                      <button
                        onClick={() => {
                          // Try to use Electron's dialog API via IPC bridge
                          const bridge = (window as any).nexusBridge;
                          if (bridge?.openFileDialog) {
                            bridge.openFileDialog().then((filePath: string | null) => {
                              if (filePath) updateSourceConfig(source.id, { filePath });
                            });
                          } else {
                            // Fallback: focus the input
                            const input = document.querySelector(`input[placeholder="C:/path/to/file.txt"]`) as HTMLInputElement;
                            input?.focus();
                          }
                        }}
                        title={!source.config?.filePath ? 'Podaj ścieżkę pliku' : 'Wybierz plik'}
                        className="mt-4 px-2.5 py-1.5 text-[11px] bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))] border border-[rgb(var(--accent))]/30 rounded hover:bg-[rgb(var(--accent))]/25 transition-colors cursor-pointer shrink-0"
                      >
                        Przeglądaj
                      </button>
                    </div>
                  )}

                  {/* Agent output: source agent selector */}
                  {source.id === 'agent_output' && (
                    <>
                      <div>
                        <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-0.5">Agent źródłowy</label>
                        <AgentDropdown
                          value={source.config?.agentId || ''}
                          onChange={(agentId) => updateSourceConfig(source.id, { agentId: agentId || undefined })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-0.5">Wybór outputów</label>
                        <SelectionToggle
                          selection={source.selection}
                          onChange={(sel) => updateSelection(source.id, sel)}
                        />
                        {source.selection?.type === 'ids' && source.selection.ids.length === 0 && (
                          <p className="text-[10px] text-yellow-400 mt-0.5">
                            Nie wybrano konkretnych outputów — zostanie użytych 5 ostatnich
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-[rgb(var(--border))]" />

      {/* Global Settings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[12px] text-[rgb(var(--text-muted))]">Limit tokenów kontekstu</label>
          <input
            type="number"
            min={256}
            max={131072}
            step={256}
            value={currentConfig.maxTokens}
            onChange={(e) => onChange({ ...currentConfig, maxTokens: parseInt(e.target.value) || 8192 })}
            className="w-24 px-2 py-1 text-[12px] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded text-[rgb(var(--text-main))] outline-none text-right"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-[12px] text-[rgb(var(--text-secondary))]">Dołącz system prompt</label>
          <ToggleSwitch
            checked={currentConfig.includeSystemPrompt}
            onChange={() => onChange({ ...currentConfig, includeSystemPrompt: !currentConfig.includeSystemPrompt })}
            ariaLabel="Przełącz dołączanie system prompt"
          />
        </div>

        <div>
          <label className="block text-[12px] text-[rgb(var(--text-muted))] mb-1">Instrukcje dodatkowe</label>
          <textarea
            value={currentConfig.customInstructions}
            onChange={(e) => onChange({ ...currentConfig, customInstructions: e.target.value })}
            rows={3}
            placeholder="Dodatkowe instrukcje dla agenta dotyczące kontekstu..."
            className="w-full px-3 py-2 text-[12px] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]/50 placeholder:text-[rgb(var(--text-muted))] resize-none"
          />
        </div>
      </div>

      {/* Test button */}
      <div className="pt-2">
        <div className="relative">
          <button
            onClick={handleTestContext}
            disabled={isTesting || currentConfig.sources.filter(s => s.enabled).length === 0 || fileDisabled}
            className="w-full px-4 py-2 text-[12px] font-medium bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))] border border-[rgb(var(--accent))]/30 rounded-lg hover:bg-[rgb(var(--accent))]/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isTesting ? 'Testowanie...' : 'Testuj kontekst — zobacz co agent dostanie'}
          </button>
          {fileDisabled && (
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full">
              <div className="bg-red-900/80 text-red-300 text-[10px] px-2 py-1 rounded whitespace-nowrap shadow-lg">
                Podaj ścieżkę pliku
              </div>
            </div>
          )}
        </div>
        {currentConfig.sources.filter(s => s.enabled).length === 0 && (
          <p className="text-[10px] text-[rgb(var(--text-muted))] mt-1 text-center">
            Wybierz co najmniej jedno źródło kontekstu
          </p>
        )}
      </div>

      {/* Test Result Modal */}
      {testResult && (
        <TestContextModal
          context={testResult.context}
          tokensUsed={testResult.tokensUsed}
          maxTokens={currentConfig.maxTokens}
          sourceBreakdown={testResult.sourceBreakdown}
          onClose={() => setTestResult(null)}
        />
      )}
    </div>
  );
}
