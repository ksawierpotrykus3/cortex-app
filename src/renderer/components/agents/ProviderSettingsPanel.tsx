// ============================================================================
// NEXUS — ProviderSettingsPanel (Phase 2)
// Modal do zarządzania kluczami API providerów
// Load/save z Main Process przez IPC bridge
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { X, Key, Check, AlertCircle, RefreshCw, Plus, Trash2, Save, Circle } from 'lucide-react';
import { ProviderAuthConfig, AIProvider } from '../../../shared/types/schema';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

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
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);
  const [newCustomUrl, setNewCustomUrl] = useState('');
  const [newCustomKey, setNewCustomKey] = useState('');
  const [nvidiaKeys, setNvidiaKeys] = useState<string[]>([]);
  const [nvidiaJsonText, setNvidiaJsonText] = useState('');
  const [nvidiaSaving, setNvidiaSaving] = useState(false);
  const [nvidiaSaveResult, setNvidiaSaveResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<Record<number, { alive: boolean; model: string }>>({});
  const modalRef = useFocusTrap(isOpen);

  // Prosty formularz NVIDIA: nazwa + klucz
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');

  // Load configs on mount
  useEffect(() => {
    if (!isOpen) return;
    loadConfigs();
    loadNvidiaKeys();
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
        if (!mountedRef.current) return;
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
    try {
      const bridge = window.nexusBridge;
      if (!bridge?.testConnection) return;
      const result = await bridge.testConnection({ label });
      if (mountedRef.current) setTestResults(prev => ({ ...prev, [label]: result }));
    } catch (err) {
      if (mountedRef.current) setTestResults(prev => ({ ...prev, [label]: { success: false, error: err instanceof Error ? err.message : 'Connection failed' } }));
    } finally {
      if (mountedRef.current) setTestingLabel(null);
    }
  };

  const loadNvidiaKeys = async () => {
    try {
      const bridge = window.nexusBridge;
      if (bridge?.getNvidiaKeys) {
        const keys = await bridge.getNvidiaKeys();
        setNvidiaKeys(keys);
        setNvidiaJsonText(JSON.stringify(keys, null, 2));
      }
    } catch { /* skip */ }
  };

  const addNvidiaKey = () => {
    const key = newKeyValue.trim();
    if (!key) return;
    const updated = [...nvidiaKeys, key];
    setNvidiaKeys(updated);
    setNvidiaJsonText(JSON.stringify(updated, null, 2));
    setNewKeyName('');
    setNewKeyValue('');
    // Auto-save
    saveKeysImmediate(updated);
  };

  const removeNvidiaKey = (index: number) => {
    const updated = nvidiaKeys.filter((_, i) => i !== index);
    setNvidiaKeys(updated);
    setNvidiaJsonText(JSON.stringify(updated, null, 2));
    saveKeysImmediate(updated);
  };

  const saveKeysImmediate = async (keys: string[]) => {
    const bridge = window.nexusBridge;
    if (!bridge?.setNvidiaKeys) return;
    try {
      await bridge.setNvidiaKeys({ keys });
    } catch { /* skip */ }
  };

  const handleSaveNvidiaKeys = async () => {
    setNvidiaSaving(true);
    setNvidiaSaveResult(null);
    try {
      let parsed: string[] = [];
      try {
        parsed = JSON.parse(nvidiaJsonText);
        if (!Array.isArray(parsed)) throw new Error('JSON musi być tablicą stringów');
      } catch {
        setNvidiaSaveResult({ success: false, error: 'Nieprawidłowy JSON — wklej tablicę kluczy, np. ["nvapi-...", "nvapi-..."]' });
        setNvidiaSaving(false);
        return;
      }
      const bridge = window.nexusBridge;
      const result = await bridge?.setNvidiaKeys?.({ keys: parsed });
      if (result?.success) {
        setNvidiaSaveResult({ success: true, count: result.count });
        setNvidiaKeys(parsed);
        setNvidiaJsonText(JSON.stringify(parsed, null, 2));
      } else {
        setNvidiaSaveResult({ success: false, error: result?.error || 'Nieznany błąd' });
      }
    } catch (err) {
      setNvidiaSaveResult({ success: false, error: err instanceof Error ? err.message : 'Błąd zapisu' });
    } finally {
      setNvidiaSaving(false);
    }
  };

  const checkBridgeHealth = async () => {
    const bridge = window.nexusBridge;
    if (!bridge?.bridgeHealth) return;
    const ports = [3456]; // NVIDIA proxy
    const results: Record<number, { alive: boolean; model: string }> = {};
    for (const port of ports) {
      try {
        const r = await bridge.bridgeHealth({ port });
        results[port] = { alive: r.alive, model: r.model };
      } catch { results[port] = { alive: false, model: '' }; }
    }
    setBridgeStatus(results);
  };

  useEffect(() => {
    if (!isOpen) return;
    checkBridgeHealth();
    const interval = setInterval(checkBridgeHealth, 15000); // co 15s
    return () => clearInterval(interval);
  }, [isOpen]);

  // (handlery add/remove nvidia key zostały usunięte — zastąpione przez set-keys)

  const handleAddCustom = async () => {
    if (!newCustomUrl.trim()) return;
    try {
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
    } catch (err) {
      console.error('[ProviderSettingsPanel] Failed to add custom provider:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div ref={modalRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label="Klucze API Providerów" className="w-[600px] max-h-[80vh] bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[rgb(var(--border))] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-[rgb(var(--accent))]" />
            <h2 className="text-[14px] font-semibold text-[rgb(var(--text))]">Klucze API Providerów</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Zamknij"
            className="p-1.5 rounded-lg text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--border))]/50 transition-colors cursor-pointer"
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
              <div key={cfg.label} className="p-4 bg-[rgb(var(--bg-elevated))] rounded-lg border border-[rgb(var(--border))] space-y-3">
                {/* Provider header */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[13px] font-medium text-[rgb(var(--text))]">{cfg.label}</span>
                    {cfg.isBuiltin && (
                      <span className="ml-2 px-1.5 py-0.5 text-[9px] bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))] rounded-full">wbudowany</span>
                    )}
                    <span className="ml-2 text-[10px] text-[rgb(var(--text-secondary))] opacity-50">{cfg.provider}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Test button */}
                    <button
                      onClick={() => handleTest(cfg.label)}
                      disabled={isTesting || !hasKey}
                      aria-label="Testuj połączenie"
                      className="p-1.5 rounded-lg text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent))]/10 transition-colors disabled:opacity-30 cursor-pointer"
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
                        aria-label="Usuń"
                        className="p-1.5 rounded-lg text-[rgb(var(--text-secondary))] hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
                        title="Usuń"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Endpoint URL */}
                <div className="text-[11px] text-[rgb(var(--text-secondary))] font-mono bg-[rgb(var(--bg-surface))] px-2 py-1 rounded">
                  {cfg.baseUrl || '(brak endpointu)'}
                </div>

                {/* Models */}
                <div className="flex flex-wrap gap-1">
                  {cfg.models.map((m) => (
                    <span key={m} className="px-2 py-0.5 text-[10px] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-secondary))] rounded-full border border-[rgb(var(--border))]">
                      {m}
                    </span>
                  ))}
                </div>

                {/* API Key */}
                <div>
                  <label className="block text-[10px] text-[rgb(var(--text-secondary))] mb-1">
                    Klucz API {hasKey ? '(zapisany)' : '(wymagany)'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={editingKeys[cfg.label] ?? ''}
                      onChange={(e) => setEditingKeys(prev => ({ ...prev, [cfg.label]: e.target.value }))}
                      placeholder={hasKey ? 'Zmień klucz...' : 'Wpisz klucz API...'}
                      className="flex-1 px-3 py-1.5 text-[12px] bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-secondary))] outline-none focus:border-[rgb(var(--accent))]/50 transition-colors"
                    />
                    <button
                      onClick={() => handleSetApiKey(cfg.label)}
                      disabled={!editingKeys[cfg.label]?.trim() || isSaving}
                      aria-label="Zapisz klucz"
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
          <div className="p-4 bg-[rgb(var(--bg-elevated))] rounded-lg border border-dashed border-[rgb(var(--border))] space-y-3">
            <span className="text-[12px] font-medium text-[rgb(var(--text-secondary))]">+ Dodaj własny endpoint</span>
            <div className="flex items-center gap-2">
              <input
                value={newCustomUrl}
                onChange={(e) => setNewCustomUrl(e.target.value)}
                placeholder="URL: http://localhost:3456"
                className="flex-1 px-3 py-1.5 text-[12px] bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-secondary))] outline-none focus:border-[rgb(var(--accent))]/50"
              />
              <input
                value={newCustomKey}
                onChange={(e) => setNewCustomKey(e.target.value)}
                placeholder="Klucz API (opcjonalnie)"
                className="w-40 px-3 py-1.5 text-[12px] bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-secondary))] outline-none focus:border-[rgb(var(--accent))]/50"
              />
              <button
                onClick={handleAddCustom}
                disabled={!newCustomUrl.trim()}
                aria-label="Dodaj własny endpoint"
                className="px-3 py-1.5 text-[12px] font-medium bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))] rounded-lg hover:bg-[rgb(var(--accent))]/25 transition-colors disabled:opacity-30 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[9px] text-[rgb(var(--text-secondary))] opacity-50">
              Dowolny endpoint kompatybilny z OpenAI API (OpenRouter, lokalne proxy, Ollama, LM Studio, itp.)
            </p>
          </div>

          {/* === NVIDIA Bridge Status ================================== */}
          <div className="p-4 bg-[rgb(var(--bg-elevated))] rounded-lg border border-[rgb(var(--border))] space-y-3">
            <span className="text-[12px] font-medium text-[rgb(var(--text))]">Proxy NVIDIA (port 3456)</span>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${bridgeStatus[3456]?.alive ? 'bg-emerald-400' : bridgeStatus[3456]?.alive === false ? 'bg-red-400' : 'bg-gray-400'}`} />
              <span className="text-[11px] text-[rgb(var(--text-secondary))]">
                {bridgeStatus[3456]?.alive
                  ? `Online · ${bridgeStatus[3456].model || 'running'}`
                  : bridgeStatus[3456]?.alive === false ? 'Offline' : 'Sprawdzanie...'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {(['deepseek-ai/deepseek-v4-flash', 'deepseek-ai/deepseek-v4-pro', 'moonshotai/kimi-k2.6', 'qwen/qwen3.5-397b-a17b']).map(m => (
                <span key={m} className="px-2 py-0.5 text-[10px] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-secondary))] rounded-full border border-[rgb(var(--border))]">{m}</span>
              ))}
            </div>
            <p className="text-[9px] text-[rgb(var(--text-secondary))] opacity-50">
              Status odświeżany co 15s. Proxy odpala się automatycznie z Nexusem.
            </p>
          </div>

          {/* === NVIDIA Keys — Prosty formularz ====================== */}
          <div className="p-4 bg-[rgb(var(--bg-elevated))] rounded-lg border border-[rgb(var(--border))] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-[rgb(var(--text))]">
                Klucze NVIDIA API
              </span>
              <span className="text-[10px] text-[rgb(var(--text-secondary))] opacity-50">
                {nvidiaKeys.length} kluczy · {(nvidiaKeys.length * 40)} RPM łącznie
              </span>
            </div>

            {/* Dodawanie klucza */}
            <div className="flex gap-2">
              <input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Nazwa (np. DeepSeek v4 Pro)"
                className="flex-1 px-3 py-1.5 text-[11px] bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-secondary))]/50 outline-none focus:border-[rgb(var(--accent))]/50"
              />
              <input
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
                placeholder="Klucz API (nvapi-...)"
                className="flex-[2] px-3 py-1.5 text-[11px] font-mono bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-secondary))]/50 outline-none focus:border-[rgb(var(--accent))]/50"
              />
              <button
                onClick={addNvidiaKey}
                disabled={!newKeyValue.trim()}
                className="px-3 py-1.5 text-[11px] font-medium bg-[rgb(var(--accent))] text-white rounded-lg hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Plus size={13} /> Dodaj
              </button>
            </div>

            {/* Lista kluczy */}
            {nvidiaKeys.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {nvidiaKeys.map((key, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-[rgb(var(--bg-surface))] rounded-lg border border-[rgb(var(--border))] group">
                    <Circle size={8} className="text-green-400 fill-green-400 shrink-0" />
                    <span className="text-[11px] font-mono text-[rgb(var(--text-secondary))] flex-1 truncate">
                      {key.substring(0, 10)}...{key.substring(key.length - 4)}
                    </span>
                    <span className="text-[9px] text-[rgb(var(--text-secondary))] opacity-40">40 RPM</span>
                    <button
                      onClick={() => removeNvidiaKey(i)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-[rgb(var(--text-muted))] hover:text-red-400 cursor-pointer transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[9px] text-[rgb(var(--text-secondary))] opacity-50">
              Dodaj klucze API NVIDIA. Proxy automatycznie wykryje zmiany i będzie rotować klucze przy każdym zapytaniu. Każdy klucz ma limit ~40 RPM.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[rgb(var(--border))] flex items-center justify-between">
          <span className="text-[10px] text-[rgb(var(--text-secondary))] opacity-50">
            Klucze przechowywane lokalnie w konfiguracji aplikacji
          </span>
          <button
            onClick={onClose}
            aria-label="Zamknij okno"
            className="px-4 py-1.5 text-[12px] font-medium bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))] rounded-lg hover:bg-[rgb(var(--accent))]/30 transition-colors cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}
