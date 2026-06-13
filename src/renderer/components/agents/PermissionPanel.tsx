// ============================================================================
// NEXUS — Permission Panel (F6.7)
// UI do edycji PermissionSet — kontroluje co agent może zrobić
// ============================================================================

import React, { useState } from 'react';
import {
  PermissionSet,
  DEFAULT_PERMISSION_SET,
  TriggerType,
  OutputDestinationType,
} from '../../../shared/types/schema';
import { ToggleSwitch } from '../ui/ToggleSwitch';

// === Props =================================================================
interface ModelOption {
  label: string;
  modelName: string;
  providerLabel: string;
}

interface PermissionPanelProps {
  value?: PermissionSet;
  onChange: (permissions: PermissionSet) => void;
  availableModels?: ModelOption[];
}

// === Trigger labels ========================================================
const TRIGGER_LABELS: Record<TriggerType, string> = {
  [TriggerType.MANUAL]: 'Ręczne (Manual)',
  [TriggerType.HOTKEY]: 'Skrót klawiszowy (Hotkey)',
  [TriggerType.TIMER]: 'Harmonogram (Timer)',
  [TriggerType.CLIPBOARD]: 'Schowek (Clipboard)',
  [TriggerType.FILE_WATCH]: 'Obserwator plików (File Watch)',
  [TriggerType.AGENT_OUTPUT]: 'Output innego agenta',
  [TriggerType.WEBHOOK]: 'Webhook',
};

// === Destination labels ====================================================
const DEST_LABELS: Record<OutputDestinationType, string> = {
  [OutputDestinationType.CHANGELOG]: 'Changelog',
  [OutputDestinationType.FILE]: 'Plik (File)',
  [OutputDestinationType.WEBHOOK]: 'Webhook',
  [OutputDestinationType.AGENT]: 'Inny agent',
  [OutputDestinationType.CLIPBOARD]: 'Schowek (Clipboard)',
  [OutputDestinationType.KNOWLEDGE]: 'Baza Wiedzy',
};

// === Component =============================================================
export function PermissionPanel({ value, onChange, availableModels = [] }: PermissionPanelProps) {
  const perms = value || DEFAULT_PERMISSION_SET;
  const [customModelInput, setCustomModelInput] = useState('');

  const toggleTrigger = (t: TriggerType) => {
    const current = perms.allowedTriggers;
    const next = current.includes(t)
      ? current.filter((x) => x !== t)
      : [...current, t];
    onChange({ ...perms, allowedTriggers: next });
  };

  const toggleDestination = (d: OutputDestinationType) => {
    const current = perms.allowedDestinations;
    const next = current.includes(d)
      ? current.filter((x) => x !== d)
      : [...current, d];
    onChange({ ...perms, allowedDestinations: next });
  };

  const toggleModel = (modelName: string) => {
    const current = perms.allowedModels;
    const next = current.includes(modelName)
      ? current.filter((x) => x !== modelName)
      : [...current, modelName];
    onChange({ ...perms, allowedModels: next });
  };

  const addCustomModel = () => {
    const val = customModelInput.trim();
    if (!val) return;
    if (!perms.allowedModels.includes(val)) {
      onChange({ ...perms, allowedModels: [...perms.allowedModels, val] });
    }
    setCustomModelInput('');
  };

  const uniqueModels = Array.from(
    new Map(availableModels.map((m) => [m.modelName, m])).values()
  );

  const hasNoTriggers = perms.allowedTriggers.length === 0;

  return (
    <div className="space-y-5">
      {/* Allowed Triggers */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-[11px] font-medium text-[rgb(var(--text-secondary))] uppercase tracking-wider">
            Dozwolone triggery
          </label>
          {hasNoTriggers && (
            <span
              className="text-[10px] text-[rgb(var(--warning))] bg-[rgb(var(--warning))]/10 px-1.5 py-0.5 rounded-full"
              title="Brak dozwolonych triggerów — agent nie może być uruchomiony"
            >
              Brak — agent nie może być uruchomiony
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.values(TriggerType).map((t) => {
            const active = perms.allowedTriggers.includes(t);
            return (
              <button
                key={t}
                onClick={() => toggleTrigger(t)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border ${
                  active
                    ? 'bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))] border-[rgb(var(--accent))]/30'
                    : 'bg-[rgb(var(--bg-elevated))] text-[rgb(var(--text-secondary))] border-[rgb(var(--border))] hover:border-[rgb(var(--accent))]/30'
                }`}
                title={TRIGGER_LABELS[t]}
              >
                {TRIGGER_LABELS[t]}
              </button>
            );
          })}
        </div>
        {hasNoTriggers && (
          <p className="text-[10px] text-[rgb(var(--text-secondary))] mt-1 italic">
            Dodaj co najmniej jeden trigger, aby agent mógł być uruchomiony.
          </p>
        )}
      </div>

      {/* Allowed Models */}
      <div>
        <label className="block text-[11px] font-medium text-[rgb(var(--text-secondary))] uppercase tracking-wider mb-2">
          Dozwolone modele AI
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {perms.allowedModels.map((m) => (
            <span
              key={m}
              className="px-2 py-0.5 text-[10px] bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))] rounded-full flex items-center gap-1"
            >
              {m}
              <button
                onClick={() => toggleModel(m)}
                className="hover:text-[rgb(var(--danger))] cursor-pointer leading-none text-[14px]"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {uniqueModels.map((m) => {
            const active = perms.allowedModels.includes(m.modelName);
            return (
              <button
                key={m.modelName}
                onClick={() => toggleModel(m.modelName)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer border ${
                  active
                    ? 'bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))] border-[rgb(var(--accent))]/30'
                    : 'bg-[rgb(var(--bg-elevated))] text-[rgb(var(--text-secondary))] border-[rgb(var(--border))] hover:border-[rgb(var(--accent))]/30'
                }`}
              >
                {m.modelName}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={customModelInput}
            onChange={(e) => setCustomModelInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addCustomModel(); }}
            placeholder="Wpisz własny model i naciśnij Enter..."
            className="flex-1 px-2 py-1.5 text-[11px] bg-[rgb(var(--bg-elevated))] border border-[rgb(var(--border))] rounded text-[rgb(var(--text))] outline-none focus:border-[rgb(var(--accent))]/50 placeholder:text-[rgb(var(--text-tertiary))]"
          />
          <button
            onClick={addCustomModel}
            className="px-2.5 py-1.5 text-[11px] font-medium bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))] rounded hover:bg-[rgb(var(--accent))]/25 transition-colors cursor-pointer"
          >
            Dodaj
          </button>
        </div>
      </div>

      {/* Allowed Destinations */}
      <div>
        <label className="block text-[11px] font-medium text-[rgb(var(--text-secondary))] uppercase tracking-wider mb-2">
          Dozwolone destination
        </label>
        <div className="flex flex-wrap gap-1.5">
          {Object.values(OutputDestinationType).map((d) => {
            const active = perms.allowedDestinations.includes(d);
            return (
              <button
                key={d}
                onClick={() => toggleDestination(d)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border ${
                  active
                    ? 'bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))] border-[rgb(var(--accent))]/30'
                    : 'bg-[rgb(var(--bg-elevated))] text-[rgb(var(--text-secondary))] border-[rgb(var(--border))] hover:border-[rgb(var(--accent))]/30'
                }`}
              >
                {DEST_LABELS[d]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Limits */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-[rgb(var(--text-secondary))] mb-1">
            Max tokenów / uruchomienie
          </label>
          <input
            type="number"
            min={0}
            value={perms.maxTokensPerRun}
            onChange={(e) => onChange({ ...perms, maxTokensPerRun: parseInt(e.target.value) || 0 })}
            className="w-full px-2 py-1 text-[12px] bg-[rgb(var(--bg-elevated))] border border-[rgb(var(--border))] rounded text-[rgb(var(--text))] outline-none"
          />
          <span className="text-[9px] text-[rgb(var(--text-secondary))]">0 = brak limitu</span>
        </div>
        <div>
          <label className="block text-[10px] text-[rgb(var(--text-secondary))] mb-1">
            Max uruchomień / minutę
          </label>
          <input
            type="number"
            min={0}
            value={perms.maxRunsPerMinute}
            onChange={(e) => onChange({ ...perms, maxRunsPerMinute: parseInt(e.target.value) || 0 })}
            className="w-full px-2 py-1 text-[12px] bg-[rgb(var(--bg-elevated))] border border-[rgb(var(--border))] rounded text-[rgb(var(--text))] outline-none"
          />
          <span className="text-[9px] text-[rgb(var(--text-secondary))]">0 = brak limitu</span>
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-[rgb(var(--border))]" />

      {/* Toggles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-[12px] text-[rgb(var(--text-secondary))]">Wymagaj akceptacji outputu</label>
            <p className="text-[9px] text-[rgb(var(--text-secondary))] opacity-60">Output czeka na approve/reject przed finalizacją</p>
          </div>
          <ToggleSwitch
            checked={perms.requireApproval}
            onChange={() => onChange({ ...perms, requireApproval: !perms.requireApproval })}
            ariaLabel="Przełącz wymagaj akceptacji outputu"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-[12px] text-[rgb(var(--text-secondary))]">Git Access (odczyt)</label>
            <p className="text-[9px] text-[rgb(var(--text-secondary))] opacity-60">Status, log, diff</p>
          </div>
          <ToggleSwitch
            checked={perms.gitAccess}
            onChange={() => onChange({ ...perms, gitAccess: !perms.gitAccess })}
            ariaLabel="Przełącz Git Access"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-[12px] text-[rgb(var(--text-secondary))]">Git Write (zapis)</label>
            <p className="text-[9px] text-[rgb(var(--text-secondary))] opacity-60">Commit, push, merge</p>
          </div>
          <ToggleSwitch
            checked={perms.gitWrite}
            onChange={() => onChange({ ...perms, gitWrite: !perms.gitWrite })}
            ariaLabel="Przełącz Git Write"
          />
        </div>
      </div>
    </div>
  );
}
