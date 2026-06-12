// ============================================================================
// NEXUS — Trigger Config (Phase 1)
// Konfiguracja triggera dla agenta: timer, hotkey, schowek, plik
// ============================================================================

import React from 'react';
import { Keyboard, Clock, FileText, Clipboard, MousePointer, Zap, Power } from 'lucide-react';
import { TriggerConfig as TriggerConfigType, TriggerType } from '../../../shared/types/schema';

// === Props =================================================================
interface TriggerConfigProps {
  config: TriggerConfigType;
  onChange: (config: TriggerConfigType) => void;
}

// === Component =============================================================
export function TriggerConfig({ config, onChange }: TriggerConfigProps) {
  const update = (updates: Partial<TriggerConfigType>) => {
    onChange({ ...config, ...updates });
  };

  const triggerOptions = [
    { type: TriggerType.MANUAL, label: 'Ręcznie', icon: MousePointer, desc: 'Uruchamiasz kliknięciem' },
    { type: TriggerType.HOTKEY, label: 'Hotkey', icon: Keyboard, desc: 'Skrót klawiszowy' },
    { type: TriggerType.TIMER, label: 'Timer', icon: Clock, desc: 'Harmonogram czasowy' },
    { type: TriggerType.CLIPBOARD, label: 'Schowek', icon: Clipboard, desc: 'Nasłuchiwanie schowka' },
    { type: TriggerType.FILE_WATCH, label: 'Plik', icon: FileText, desc: 'Nowy plik w folderze' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-[11px] font-medium text-[rgb(var(--text-muted))] uppercase tracking-wider">
          Trigger / Wyzwalacz
        </label>
        <button
          onClick={() => update({ enabled: !config.enabled })}
          className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
            config.enabled
              ? 'bg-green-500/10 text-green-400'
              : 'bg-red-500/10 text-red-400'
          }`}
        >
          <Power className="w-3 h-3" />
          {config.enabled ? 'Włączony' : 'Wyłączony'}
        </button>
      </div>

      {/* Trigger Type Selection */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {triggerOptions.map((opt) => {
          const isActive = config.type === opt.type;
          return (
            <button
              key={opt.type}
              onClick={() => update({ type: opt.type })}
              className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[rgb(var(--accent))]/15 border-[rgb(var(--accent))]/40 text-[rgb(var(--accent))]'
                  : 'bg-[rgb(var(--panel))] border-[rgb(var(--border))] text-[rgb(var(--text-muted))] hover:border-[rgb(var(--accent))]/30'
              }`}
            >
              <opt.icon className="w-4 h-4 mb-1" />
              <div className="text-[11px] font-medium">{opt.label}</div>
              <div className="text-[9px] opacity-60">{opt.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Trigger-specific config */}
      {config.enabled && (
        <div className="space-y-3 p-3 bg-[rgb(var(--panel))] rounded-lg border border-[rgb(var(--border))]">
          {/* Hotkey Config */}
          {config.type === TriggerType.HOTKEY && (
            <div>
              <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-1">Skrót klawiszowy</label>
              <input
                value={config.hotkey || ''}
                onChange={(e) => update({ hotkey: e.target.value })}
                className="w-full px-3 py-2 text-[13px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]/50"
                placeholder="Ctrl+Shift+A"
              />
              <p className="text-[9px] text-[rgb(var(--text-muted))] mt-1">
                Użyj formatu: Ctrl+Shift+A, Alt+R, F5 itp.
              </p>
            </div>
          )}

          {/* Timer Config */}
          {config.type === TriggerType.TIMER && (
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-1">Interwał (ms)</label>
                <input
                  type="number"
                  value={config.intervalMs || 3600000}
                  onChange={(e) => update({ intervalMs: parseInt(e.target.value) || 3600000 })}
                  className="w-full px-3 py-2 text-[13px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]/50"
                  placeholder="3600000 (co godzinę)"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-1">Wyrażenie cron (opcjonalne)</label>
                <input
                  value={config.cron || ''}
                  onChange={(e) => update({ cron: e.target.value })}
                  className="w-full px-3 py-2 text-[13px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]/50"
                  placeholder="0 15 * * * (codziennie o 15:00)"
                />
              </div>
            </div>
          )}

          {/* Clipboard Config */}
          {config.type === TriggerType.CLIPBOARD && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.useClipboard}
                  onChange={(e) => update({ useClipboard: e.target.checked })}
                  className="accent-[rgb(var(--accent))]"
                />
                <span className="text-[12px] text-[rgb(var(--text-main))]">Użyj schowka jako {'{{SCHOWEK}}'}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.useScreenshot}
                  onChange={(e) => update({ useScreenshot: e.target.checked })}
                  className="accent-[rgb(var(--accent))]"
                />
                <span className="text-[12px] text-[rgb(var(--text-main))]">Użyj zrzutu ekranu</span>
              </label>
            </div>
          )}

          {/* File Watch Config */}
          {config.type === TriggerType.FILE_WATCH && (
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-1">Ścieżka folderu</label>
                <input
                  value={config.watchPath || ''}
                  onChange={(e) => update({ watchPath: e.target.value })}
                  className="w-full px-3 py-2 text-[13px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]/50"
                  placeholder="C:/Users/.../watched/"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-1">Wzorzec pliku (glob)</label>
                <input
                  value={config.watchPattern || ''}
                  onChange={(e) => update({ watchPattern: e.target.value })}
                  className="w-full px-3 py-2 text-[13px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]/50"
                  placeholder="*.md, *.txt, **/*.json"
                />
              </div>
            </div>
          )}

          {/* Source agent trigger */}
          {config.type === TriggerType.AGENT_OUTPUT && (
            <div>
              <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-1">Agent źródłowy</label>
              <input
                value={config.sourceAgentId || ''}
                onChange={(e) => update({ sourceAgentId: e.target.value })}
                className="w-full px-3 py-2 text-[13px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]/50"
                placeholder="ID agenta..."
              />
              <input
                value={config.condition || ''}
                onChange={(e) => update({ condition: e.target.value })}
                className="w-full px-3 py-2 text-[13px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]/50 mt-2"
                placeholder="Warunek: contains 'error'"
              />
            </div>
          )}

          {/* Manual — no extra config */}
          {config.type === TriggerType.MANUAL && (
            <p className="text-[11px] text-[rgb(var(--text-muted))]">
              Agent uruchamiany ręcznie z UI. Możesz też dodać przycisk w list panelu.
            </p>
          )}
        </div>
      )}

      {/* Conditional logic (always visible) */}
      <div className="mt-2">
        <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-1">
          Wyrażenie warunkowe (algebra boolowska — opcjonalne)
        </label>
        <input
          value={config.conditionExpression || ''}
          onChange={(e) => update({ conditionExpression: e.target.value })}
          className="w-full px-3 py-2 text-[12px] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]/50"
          placeholder='np. (clipboard contains "code") AND (rating >= 7)'
        />
      </div>
    </div>
  );
}
