// ============================================================================
// NEXUS — ProviderSettingsPanel (Phase 2)
// Modal do zarządzania kluczami API providerów
// Load/save z Main Process przez IPC bridge
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { X, Key, Check, AlertCircle, RefreshCw, Plus, Trash2, Save, Circle, Shield } from 'lucide-react';
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
  const [bridgeStatus, setBridgeStatus] = useState<Record<number, { alive: boolean; model: string }>>({});
  const modalRef = useFocusTrap(isOpen);

  // Failover Router State
  const [failoverMode, setFailoverMode] = useState<'strict' | 'interactive' | 'automatic'>('automatic');
  const [timeoutSeconds, setTimeoutSeconds] = useState<number>(60);
  const [healthStatus, setHealthStatus] = useState<Record<string, { status: 'ONLINE' | 'OFFLINE'; ping: number }>>({});
  const [activeFailovers, setActiveFailovers] = useState<string[]>([]);
  const [checkingHealth, setCheckingHealth] = useState(false);

  // Load configs on mount
  useEffect(() => {
    if (!isOpen) return;
    loadConfigs();
    loadFailoverSettings();
    loadFailoverStatus();

    const bridge = window.nexusBridge;
    if (bridge?.onAiStatusChanged) {
      const unsub = bridge.onAiStatusChanged((data) => {
        setHealthStatus(data.status);
        setActiveFailovers(data.activeFailovers);
      });
      return unsub;
    }
  }, [isOpen]);

  const loadFailoverSettings = async () => {
    const bridge = window.nexusBridge;
    if (bridge?.getFailoverSettings) {
      const settings = await bridge.getFailoverSettings();
      setFailoverMode(settings.mode);
      setTimeoutSeconds(settings.timeoutSeconds);
    }
  };

  const loadFailoverStatus = async () => {
    const bridge = window.nexusBridge;
    if (bridge?.getFailoverStatus) {
      const data = await bridge.getFailoverStatus();
      setHealthStatus(data.status);
      setActiveFailovers(data.activeFailovers);
    }
  };

  const handleSaveFailoverSettings = async (mode: any, seconds: number) => {
    const bridge = window.nexusBridge;
    if (bridge?.saveFailoverSettings) {
      await bridge.saveFailoverSettings({ settings: { mode, timeoutSeconds: seconds } });
    }
  };

  const triggerHealth = async () => {
    setCheckingHealth(true);
    const bridge = window.nexusBridge;
    if (bridge?.triggerHealthCheck) {
      const data = await bridge.triggerHealthCheck();
      setHealthStatus(data.status);
      setActiveFailovers(data.activeFailovers);
    }
    setCheckingHealth(false);
  };

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

  const checkBridgeHealth = async () => {
    const bridge = window.nexusBridge;
    if (!bridge?.bridgeHealth) return;
    const ports = [4570]; // DeepSeek proxy
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
                placeholder="URL: http://localhost:4570"
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

          {/* === DeepSeek Proxy Status ================================== */}
          <div className="p-4 bg-[rgb(var(--bg-elevated))] rounded-lg border border-[rgb(var(--border))] space-y-3">
            <span className="text-[12px] font-medium text-[rgb(var(--text))]">DeepSeek Proxy (port 4570)</span>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${bridgeStatus[4570]?.alive ? 'bg-emerald-400' : bridgeStatus[4570]?.alive === false ? 'bg-red-400' : 'bg-gray-400'}`} />
              <span className="text-[11px] text-[rgb(var(--text-secondary))]">
                {bridgeStatus[4570]?.alive
                  ? `Online · ${bridgeStatus[4570].model || 'running'}`
                  : bridgeStatus[4570]?.alive === false ? 'Offline' : 'Sprawdzanie...'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {(['deepseek-ai/deepseek-v4-flash', 'deepseek-ai/deepseek-v4-pro']).map(m => (
                <span key={m} className="px-2 py-0.5 text-[10px] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-secondary))] rounded-full border border-[rgb(var(--border))]">{m}</span>
              ))}
            </div>
          </div>

          {/* === Failover Router AI === */}
          <div className="p-4 bg-[rgb(var(--bg-elevated))] rounded-lg border border-[rgb(var(--border))] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-[rgb(var(--text))] flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[rgb(var(--accent))]" /> Inteligentny Router AI (Circuit Breaker)
              </span>
              <button
                onClick={triggerHealth}
                disabled={checkingHealth}
                className="px-2.5 py-1 text-[10px] font-medium bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))] rounded hover:bg-[rgb(var(--accent))]/25 transition-colors cursor-pointer flex items-center gap-1 shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${checkingHealth ? 'animate-spin' : ''}`} />
                {checkingHealth ? 'Badanie...' : 'Testuj stabilność darmowych modeli'}
              </button>
            </div>

            {/* Model status list */}
            <div className="grid grid-cols-2 gap-3 bg-[rgb(var(--bg-surface))] p-3 rounded-lg border border-[rgb(var(--border))]">
              {[
                { id: 'deepseek-ai/deepseek-v4-pro', label: 'DeepSeek v4 Pro' },
                { id: 'deepseek-ai/deepseek-v4-flash', label: 'DeepSeek v4 Flash' },
              ].map((model) => {
                const stat = healthStatus[model.id];
                const isFailedOver = activeFailovers.includes(model.id);
                const isOnline = stat?.status === 'ONLINE';

                return (
                  <div key={model.id} className="flex flex-col gap-1">
                    <span className="text-[10px] font-medium text-[rgb(var(--text))]">{model.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        isFailedOver ? 'bg-amber-400' : isOnline ? 'bg-emerald-400' : 'bg-red-400'
                      }`} />
                      <span className="text-[11px] text-[rgb(var(--text-secondary))] font-mono">
                        {isFailedOver ? 'ZAPASOWY (Paid)' : isOnline ? `Online (${stat.ping}ms)` : 'Offline'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Failover mode radio group */}
            <div className="space-y-2">
              <label className="block text-[10px] text-[rgb(var(--text-secondary))]">
                Tryb Przełączania (Failover Mode)
              </label>
              <div className="flex flex-col gap-1.5">
                {[
                  { value: 'strict', label: 'Strict (Brak przełączania - darmowy lub błąd)', desc: 'Brak automatycznego przechodzenia na płatne klucze.' },
                  { value: 'interactive', label: 'Interactive (Zaproponuj na czacie użycie płatnego)', desc: 'System wstrzymuje zapytanie i wyświetla przycisk zgody.' },
                  { value: 'automatic', label: 'Automatic (Cichy fallback tam i z powrotem)', desc: 'Automatycznie przekierowuje zapytania do wersji płatnej i wraca do darmowej gdy ożyje.' }
                ].map((modeOpt) => (
                  <label key={modeOpt.value} className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="failoverMode"
                      value={modeOpt.value}
                      checked={failoverMode === modeOpt.value}
                      onChange={(e) => {
                        const m = e.target.value as any;
                        setFailoverMode(m);
                        handleSaveFailoverSettings(m, timeoutSeconds);
                      }}
                      className="mt-0.5 accent-[rgb(var(--accent))]"
                    />
                    <div className="flex flex-col">
                      <span className="text-[11px] text-[rgb(var(--text))]">{modeOpt.label}</span>
                      <span className="text-[9px] text-[rgb(var(--text-secondary))] opacity-60 leading-normal">{modeOpt.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Timeout settings */}
            <div className="space-y-1.5 pt-2 border-t border-[rgb(var(--border))]/50">
              <label className="block text-[10px] text-[rgb(var(--text-secondary))]">
                Czas oczekiwania na decyzję / Timeout (sekundy)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={timeoutSeconds}
                  onChange={(e) => {
                    const sec = Math.max(5, parseInt(e.target.value) || 0);
                    setTimeoutSeconds(sec);
                    handleSaveFailoverSettings(failoverMode, sec);
                  }}
                  className="w-20 px-3 py-1 text-[12px] bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text))] outline-none focus:border-[rgb(var(--accent))]/50"
                />
                <span className="text-[10px] text-[rgb(var(--text-secondary))] opacity-60">
                  Maksymalny czas (w sek.) oczekiwania na akceptację karty failover w trybie Interactive przed przerwaniem zapytania.
                </span>
              </div>
            </div>
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
