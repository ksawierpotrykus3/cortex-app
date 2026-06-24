// ============================================================================
// NEXUS — GitSettingsPanel
// Zakładka integracji z Gitem w ustawieniach
// ============================================================================

import React, { useState, useEffect } from "react";
import { GitConfig, DEFAULT_GIT_CONFIG } from "../shared/types/schema";

export function GitSettingsPanel() {
  const [config, setConfig] = useState<GitConfig>({ ...DEFAULT_GIT_CONFIG });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const c = await window.nexusBridge?.getGitConfig();
      if (c) {
        setConfig(c);
      }
    } catch {
      // ignore
    }
    setLoaded(true);
  };

  const updateField = <K extends keyof GitConfig>(key: K, value: GitConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      await window.nexusBridge?.setGitConfig({ config });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setTestResult({ ok: false, msg: 'Błąd zapisu: ' + (err.message || 'unknown') });
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Save first
      await window.nexusBridge?.setGitConfig({ config });
      const result = await window.nexusBridge?.testGitConnection();
      if (result?.success) {
        setTestResult({ ok: true, msg: 'Połączenie OK! Repozytorium dostępne.' });
      } else {
        setTestResult({ ok: false, msg: result?.error || 'Połączenie nieudane' });
      }
    } catch (err: any) {
      setTestResult({ ok: false, msg: err.message || 'Błąd połączenia' });
    }
    setTesting(false);
  };

  if (!loaded) {
    return <div className="text-sm text-gray-500">Ładowanie konfiguracji...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Remote URL */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-300">URL Repozytorium GitHub</label>
        <input
          type="text"
          value={config.remoteUrl}
          onChange={(e) => updateField('remoteUrl', e.target.value)}
          placeholder="https://github.com/username/repo.git"
          className="w-full bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-gray-500 transition-colors font-mono"
        />
        <p className="text-[11px] text-[rgb(var(--text-muted))]">
          Adres HTTPS repozytorium. Token zostanie wstrzyknięty automatycznie.
        </p>
      </div>

      {/* Access Token */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-300">Token / Klucz dostępu</label>
        <input
          type="password"
          value={config.accessToken}
          onChange={(e) => updateField('accessToken', e.target.value)}
          placeholder="github_pat_..."
          className="w-full bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-gray-500 transition-colors font-mono"
        />
        <p className="text-[11px] text-[rgb(var(--text-muted))]">
          Token GitHub (PAT) z dostępem do repo. Przechowywany lokalnie.
        </p>
      </div>

      {/* Author Info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Autor (nazwa)</label>
          <input
            type="text"
            value={config.authorName}
            onChange={(e) => updateField('authorName', e.target.value)}
            placeholder="Twój nick"
            className="w-full bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-gray-500 transition-colors"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Autor (email)</label>
          <input
            type="email"
            value={config.authorEmail}
            onChange={(e) => updateField('authorEmail', e.target.value)}
            placeholder="email@example.com"
            className="w-full bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-gray-500 transition-colors"
          />
        </div>
      </div>

      {/* AI Branch */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-300">Branch dla agentów AI</label>
        <input
          type="text"
          value={config.aiBranchName}
          onChange={(e) => updateField('aiBranchName', e.target.value)}
          placeholder="ai-agent"
          className="w-full bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-gray-500 transition-colors font-mono"
        />
        <p className="text-[11px] text-[rgb(var(--text-muted))]">
          Na tym branchu agenty AI będą tworzyć swoje commity.
        </p>
      </div>

      {/* Auto-commit */}
      <div className="flex items-center justify-between p-3 bg-[rgb(var(--panel))] rounded-lg border border-[rgb(var(--border))]">
        <div>
          <h3 className="text-sm font-medium text-gray-300">Auto-commit AI</h3>
          <p className="text-[11px] text-[rgb(var(--text-muted))]">
            Agent automatycznie commituje zmiany po każdej akcji
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.autoCommit}
            onChange={(e) => updateField('autoCommit', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-700 rounded-full peer peer-checked:bg-[rgb(var(--accent))] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </div>

      {/* Auto-commit message template */}
      <div>
        <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-0.5">Szablon komunikatu commit</label>
        <input
          type="text"
          value={config.autoCommitMessage || 'Nexus AI: {{summary}}'}
          onChange={(e) => updateField('autoCommitMessage', e.target.value)}
          className="w-full px-2 py-1.5 text-[12px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]/50"
          placeholder="Nexus AI: {{summary}}"
        />
      </div>

      {/* Włącz/Wyłącz Git */}
      <div className="flex items-center justify-between p-3 bg-[rgb(var(--panel))] rounded-lg border border-[rgb(var(--border))]">
        <div>
          <h3 className="text-sm font-medium text-gray-300">Włącz integrację Git</h3>
          <p className="text-[11px] text-[rgb(var(--text-muted))]">
            Aktywuj wszystkie funkcje gita w Nexusie
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => updateField('enabled', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-700 rounded-full peer peer-checked:bg-[rgb(var(--accent))] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </div>

      {/* Harmonogram cykliczny */}
      <div className="pt-4 border-t border-[rgb(var(--border))]">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Harmonogram cykliczny</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Pull (co ms)</label>
            <input
              type="number"
              min={0}
              step={1000}
              value={config.pullIntervalMs || 0}
              onChange={(e) => updateField('pullIntervalMs', parseInt(e.target.value) || 0)}
              placeholder="0 = wył."
              className="w-full bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-gray-500 transition-colors font-mono"
            />
            <p className="text-[11px] text-[rgb(var(--text-muted))]">
              300000 = co 5 min, 60000 = co 1 min
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Push (co ms)</label>
            <input
              type="number"
              min={0}
              step={1000}
              value={config.pushIntervalMs || 0}
              onChange={(e) => updateField('pushIntervalMs', parseInt(e.target.value) || 0)}
              placeholder="0 = wył."
              className="w-full bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-gray-500 transition-colors font-mono"
            />
            <p className="text-[11px] text-[rgb(var(--text-muted))]">
              Jeśli auto-commit włączony, commituje przed pushem
            </p>
          </div>
        </div>
        <div className="space-y-2 mt-3">
          <label className="text-sm font-medium text-gray-300">Tylko na branchu</label>
          <input
            type="text"
            value={config.scheduleOnlyOnBranch}
             onChange={(e) => updateField('scheduleOnlyOnBranch', e.target.value)}
            placeholder="main (zostaw puste = wszystkie)"
            className="w-full bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-gray-500 transition-colors font-mono"
          />
          <p className="text-[11px] text-[rgb(var(--text-muted))]">
            Harmonogram będzie aktywny tylko na tym branchu. Puste = wszystkie.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleTestConnection}
          disabled={testing || !config.remoteUrl}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-[rgb(var(--border))] text-gray-300 hover:text-white hover:border-gray-500 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {testing ? 'Testowanie...' : 'Testuj połączenie'}
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[rgb(var(--accent))] text-black hover:bg-[rgb(var(--accent))]/90 transition-colors cursor-pointer"
        >
          {saved ? 'Zapisano!' : 'Zapisz konfigurację'}
        </button>
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={`p-3 rounded-lg text-sm ${testResult.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {testResult.msg}
        </div>
      )}
    </div>
  );
}
