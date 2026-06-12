// ============================================================================
// NEXUS — ProviderSettingsPanel (Phase 2)
// Modal do zarządzania kluczami API providerów
// Load/save z Main Process przez IPC bridge
// ============================================================================

import React, { useState, useEffect } from 'react';
import { X, Key, Check, AlertCircle, RefreshCw, Plus, Trash2, ExternalLink } from 'lucide-react';
import { ProviderAuthConfig, AIProvider } from '../../../shared/types/schema';

// === Props =================================================================
interface ProviderSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// === Component =============================================================
export function ProviderSettingsPanel({ isOpen, onClose }: ProviderSettingsPanelProps) {
  const [configs, setConfigs] = useState<ProviderAuthConfig[]>([]);
  const [testingLabel, setTestingLabel] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: string }>>({});
  const [editingKeys, setEditingKeys] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saveResult, setSaveResult] = useState<Record<string, { success: boolean; error?: string }>>({});
  const [newCustomUrl, setNewCustomUrl] = useState('');
  const [newCustomKey, setNewCustomKey] = useState('');

  // Load configs on mount
  useEffect(() => {
    if (!isOpen) return;
    loadConfigs();
  }, [isOpen]);

  const loadConfigs = async () => {
    const bridge = window.nexusBridge;
    if (!bridge?.getProviderConfigs) return;
    const cfgs = await bridge.getProviderConfigs();
    setConfigs(cfgs);
  };

  const handleSetApiKey = async (label: string) => {
    const key = editingKeys[label]?.trim();
    if (!key) return;

    setSaving(prev => ({ ...prev, [label]: true }));
    const bridge = window.nexusBridge;
    if (!bridge?.setApiKey) return;

    const result = await bridge.setApiKey({ label, apiKey: key });
    setSaveResult(prev => ({ ...prev, [label]: result }));
    setSaving(prev => ({ ...prev, [label]: false }));

    if (result.success) {
      setEditingKeys(prev => ({ ...prev, [label]: '' }));
      setTimeout(() => {
        setSaveResult(prev => {
          const next = { ...prev };
          delete next[label];
          return next;
        });
      }, 3000);
    }
  };

  const handleTest = async (label: string) => {
    setTestingLabel(label);
    setTestResults(prev => ({ ...prev, [label]: { success: false } }));

    const bridge = window.nexusBridge;
    if (!bridge?.testConnection) return;

    const result = await bridge.testConnection({ label });
    setTestResults(prev => ({ ...prev, [label]: result }));
    setTestingLabel(null);
  };

  const handleAddCustom = async () => {
    if (!newCustomUrl.trim()) return;

    // Create a custom OpenRouter/Ollama provider
    const config: ProviderAuthConfig = {
      provider: newCustomUrl.includes('ollama') ? AIProvider.OLLAMA : AIProvider.OPENROUTER,
      label: `Custom (${new URL(newCustomUrl).hostname})`,
      apiKey: newCustomKey || '',
      baseUrl: newCustomUrl.replace(/\/+$/, '') + '/v1',
      models: ['custom-model'],
      isBuiltin: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const bridge = window.nexusBridge;
    if (bridge?.upsertProviderConfig) {
      await bridge.upsertProviderConfig({ config });
      await loadConfigs();
    }

    setNewCustomUrl('');
    setNewCustomKey('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[600px] max-h-[80vh] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[rgb(var(--border))] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-[rgb(var(--accent))]" />
            <h2 className="text-[14px] font-semibold text-[rgb(var(--text-main))]">Klucze API Providerów</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--border))]/50 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
          {configs.map((cfg) => {
            const hasKey = cfg.apiKey && cfg.apiKey.length > 0;
            const testResult = testResults[cfg.label];
            const saveRes = saveResult[cfg.label];
            const isTesting = testingLabel === cfg.label;
            const isSaving = saving[cfg.label];

            return (
              <div key={cfg.label} className="p-4 bg-[rgb(var(--panel))] rounded-lg border border-[rgb(var(--border))] space-y-3">
                {/* Provider header */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[13px] font-medium text-[rgb(var(--text-main))]">{cfg.label}</span>
                    {cfg.isBuiltin && (
                      <span className="ml-2 px-1.5 py-0.5 text-[9px] bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))] rounded-full">wbudowany</span>
                    )}
                    <span className="ml-2 text-[10px] text-[rgb(var(--text-muted))] opacity-50">{cfg.provider}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Test button */}
                    <button
                      onClick={() => handleTest(cfg.label)}
                      disabled={isTesting || !hasKey}
                      className="p-1.5 rounded-lg text-[rgb(var(--text-muted))] hover:text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent))]/10 transition-colors disabled:opacity-30 cursor-pointer"
                      title="Testuj połączenie"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    </button>

                    {/* Delete (only non-builtin) */}
                    {!cfg.isBuiltin && (
                      <button
                        onClick={async () => {
                          // For now just visual — full delete via IPC
                        }}
                        className="p-1.5 rounded-lg text-[rgb(var(--text-muted))] hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
                        title="Usuń"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Endpoint URL */}
                <div className="text-[11px] text-[rgb(var(--text-muted))] font-mono bg-[rgb(var(--background))] px-2 py-1 rounded">
                  {cfg.baseUrl || '(brak endpointu)'}
                </div>

                {/* Models */}
                <div className="flex flex-wrap gap-1">
                  {cfg.models.map((m) => (
                    <span key={m} className="px-2 py-0.5 text-[10px] bg-[rgb(var(--background))] text-[rgb(var(--text-muted))] rounded-full border border-[rgb(var(--border))]">
                      {m}
                    </span>
                  ))}
                </div>

                {/* API Key */}
                <div>
                  <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-1">
                    Klucz API {hasKey ? '(zapisany)' : '(wymagany)'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={editingKeys[cfg.label] ?? ''}
                      onChange={(e) => setEditingKeys(prev => ({ ...prev, [cfg.label]: e.target.value }))}
                      placeholder={hasKey ? 'Zmień klucz...' : 'Wpisz klucz API...'}
                      className="flex-1 px-3 py-1.5 text-[12px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-main))] placeholder:text-[rgb(var(--text-muted))] outline-none focus:border-[rgb(var(--accent))]/50 transition-colors"
                    />
                    <button
                      onClick={() => handleSetApiKey(cfg.label)}
                      disabled={!editingKeys[cfg.label]?.trim() || isSaving}
                      className="px-3 py-1.5 text-[12px] font-medium bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))] rounded-lg hover:bg-[rgb(var(--accent))]/25 transition-colors disabled:opacity-30 cursor-pointer"
                    >
                      {isSaving ? 'Zapisuję...' : 'Zapisz'}
                    </button>
                  </div>

                  {/* Save result */}
                  {saveRes && (
                    <div className={`mt-1.5 text-[11px] flex items-center gap-1 ${
                      saveRes.success ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {saveRes.success ? (
                        <><Check className="w-3 h-3" /> Klucz zapisany</>
                      ) : (
                        <><AlertCircle className="w-3 h-3" /> {saveRes.error}</>
                      )}
                    </div>
                  )}
                </div>

                {/* Test result */}
                {testResult && (
                  <div className={`text-[11px] flex items-center gap-1 ${
                    testResult.success ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {testResult.success ? (
                      <><Check className="w-3 h-3" /> Połączenie OK</>
                    ) : (
                      <><AlertCircle className="w-3 h-3" /> {testResult.error || 'Test nieudany'}</>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add custom endpoint */}
          <div className="p-4 bg-[rgb(var(--panel))] rounded-lg border border-dashed border-[rgb(var(--border))] space-y-3">
            <span className="text-[12px] font-medium text-[rgb(var(--text-muted))]">+ Dodaj własny endpoint</span>
            <div className="flex items-center gap-2">
              <input
                value={newCustomUrl}
                onChange={(e) => setNewCustomUrl(e.target.value)}
                placeholder="URL: http://localhost:3458"
                className="flex-1 px-3 py-1.5 text-[12px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-main))] placeholder:text-[rgb(var(--text-muted))] outline-none focus:border-[rgb(var(--accent))]/50"
              />
              <input
                value={newCustomKey}
                onChange={(e) => setNewCustomKey(e.target.value)}
                placeholder="Klucz API (opcjonalnie)"
                className="w-40 px-3 py-1.5 text-[12px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-main))] placeholder:text-[rgb(var(--text-muted))] outline-none focus:border-[rgb(var(--accent))]/50"
              />
              <button
                onClick={handleAddCustom}
                disabled={!newCustomUrl.trim()}
                className="px-3 py-1.5 text-[12px] font-medium bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))] rounded-lg hover:bg-[rgb(var(--accent))]/25 transition-colors disabled:opacity-30 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[9px] text-[rgb(var(--text-muted))] opacity-50">
              Dowolny endpoint kompatybilny z OpenAI API (OpenRouter, lokalne proxy, Ollama, LM Studio, itp.)
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[rgb(var(--border))] flex items-center justify-between">
          <span className="text-[10px] text-[rgb(var(--text-muted))] opacity-50">
            Klucze przechowywane lokalnie w konfiguracji aplikacji
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-[12px] font-medium bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))] rounded-lg hover:bg-[rgb(var(--accent))]/30 transition-colors cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}
