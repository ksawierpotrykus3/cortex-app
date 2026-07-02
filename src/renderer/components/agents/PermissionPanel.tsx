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
import {
  ALL_CAPABILITIES,
  CapabilityCategory,
  CapabilityEntry,
  ApprovalLevel,
} from '../../../shared/types/capabilities';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { FolderPicker } from '../../../components/FolderPicker';

// === Props =================================================================
interface ModelOption {
  label: string;
  modelName: string;
  providerLabel: string;
}

interface PermissionPanelProps {
  permissions?: PermissionSet;
  capabilities?: CapabilityEntry[];
  allowedFolders?: string[];
  onChangePermissions: (perms: PermissionSet) => void;
  onChangeCapabilities: (caps: CapabilityEntry[]) => void;
  onChangeFolders: (folders: string[]) => void;
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
  
};

// === Helpers ===============================================================
function capBadge(level: ApprovalLevel | null) {
  if (level === 'none') return 'R';
  if (level === 'notify') return 'N';
  if (level === 'approve') return 'A';
  return null;
}

function nextApprovalLevel(current: ApprovalLevel | null): ApprovalLevel | null {
  if (current === null) return 'none';
  if (current === 'none') return 'notify';
  if (current === 'notify') return 'approve';
  return null;
}

// === Component =============================================================
export function PermissionPanel({
  permissions,
  capabilities = [],
  allowedFolders = [],
  onChangePermissions,
  onChangeCapabilities,
  onChangeFolders,
  availableModels = [],
}: PermissionPanelProps) {
  const perms = permissions || DEFAULT_PERMISSION_SET;
  const [customModelInput, setCustomModelInput] = useState('');

  const toggleCap = (cap: CapabilityCategory) => {
    const exists = capabilities.find(c => c.capability === cap);
    if (exists) {
      const newLevel = nextApprovalLevel(exists.approvalLevel);
      if (newLevel === null) {
        onChangeCapabilities(capabilities.filter(c => c.capability !== cap));
      } else {
        onChangeCapabilities(
          capabilities.map(c => c.capability === cap ? { ...c, approvalLevel: newLevel } : c)
        );
      }
    } else {
      onChangeCapabilities([...capabilities, { capability: cap, approvalLevel: 'none' as ApprovalLevel }]);
    }
  };

  const setAllCapabilities = (level: ApprovalLevel) => {
    const result: CapabilityEntry[] = [];
    for (const group of ALL_CAPABILITIES) {
      for (const item of group.items) {
        result.push({ capability: item.value, approvalLevel: level });
      }
    }
    onChangeCapabilities(result);
  };

  const clearAllCapabilities = () => {
    onChangeCapabilities([]);
  };

  const toggleTrigger = (t: TriggerType) => {
    const current = perms.allowedTriggers;
    const next = current.includes(t)
      ? current.filter((x) => x !== t)
      : [...current, t];
    onChangePermissions({ ...perms, allowedTriggers: next });
  };

  const toggleDestination = (d: OutputDestinationType) => {
    const current = perms.allowedDestinations;
    const next = current.includes(d)
      ? current.filter((x) => x !== d)
      : [...current, d];
    onChangePermissions({ ...perms, allowedDestinations: next });
  };

  const toggleModel = (modelName: string) => {
    const current = perms.allowedModels;
    const next = current.includes(modelName)
      ? current.filter((x) => x !== modelName)
      : [...current, modelName];
    onChangePermissions({ ...perms, allowedModels: next });
  };

  const addCustomModel = () => {
    const val = customModelInput.trim();
    if (!val) return;
    if (!perms.allowedModels.includes(val)) {
      onChangePermissions({ ...perms, allowedModels: [...perms.allowedModels, val] });
    }
    setCustomModelInput('');
  };

  const uniqueModels = Array.from(
    new Map(availableModels.map((m) => [m.modelName, m])).values()
  );

  const hasNoTriggers = perms.allowedTriggers.length === 0;

  return (
    <div className="space-y-5">
      {/* === Capabilities === */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-medium text-[rgb(var(--text-secondary))] uppercase tracking-wider">
            Capabilities (pozwolenia)
          </label>
          <span className="text-[10px] text-[rgb(var(--text-tertiary))]">
            R(czytaj) / N(powiadom) / A(zatwierdz)
          </span>
        </div>
        <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar mb-2">
          {ALL_CAPABILITIES.map(group => (
            <div key={group.category}>
              <div className="text-[9px] font-mono font-medium text-[rgb(var(--text-tertiary))] uppercase mb-1">
                {group.label}
              </div>
              <div className="flex flex-wrap gap-1">
                {group.items.map(item => {
                  const cap = capabilities.find(c => c.capability === item.value);
                  const level = cap?.approvalLevel || null;
                  return (
                    <button
                      key={item.value}
                      onClick={() => toggleCap(item.value)}
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                        level === 'none'
                          ? 'bg-green-500/10 border-green-500/30 text-green-400'
                          : level === 'notify'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          : level === 'approve'
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                          : 'bg-transparent border-[rgb(var(--border))] text-[rgb(var(--text-tertiary))] hover:text-[rgb(var(--text-muted))]'
                      }`}
                      title={`${item.label}: ${item.description}`}
                    >
                      {capBadge(level) && (
                        <span className="mr-0.5">{capBadge(level)}</span>
                      )}
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAllCapabilities('none')}
            className="px-2.5 py-1 text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/20 transition-colors cursor-pointer"
          >
            Ustaw wszystkie jako R (czytaj)
          </button>
          <button
            onClick={() => setAllCapabilities('approve')}
            className="px-2.5 py-1 text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition-colors cursor-pointer"
          >
            Ustaw wszystkie jako A (zatwierdz)
          </button>
          <button
            onClick={clearAllCapabilities}
            className="px-2.5 py-1 text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors cursor-pointer"
          >
            Odznacz wszystko
          </button>
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-[rgb(var(--border))]" />

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
            onChange={(e) => onChangePermissions({ ...perms, maxTokensPerRun: parseInt(e.target.value) || 0 })}
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
            onChange={(e) => onChangePermissions({ ...perms, maxRunsPerMinute: parseInt(e.target.value) || 0 })}
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
            onChange={() => onChangePermissions({ ...perms, requireApproval: !perms.requireApproval })}
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
            onChange={() => onChangePermissions({ ...perms, gitAccess: !perms.gitAccess })}
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
            onChange={() => onChangePermissions({ ...perms, gitWrite: !perms.gitWrite })}
            ariaLabel="Przełącz Git Write"
          />
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-[rgb(var(--border))]" />

      {/* Foldery */}
      <div>
        <label className="block text-[11px] font-medium text-[rgb(var(--text-secondary))] uppercase tracking-wider mb-2">
          Dozwolone foldery
        </label>
        <FolderPicker value={allowedFolders} onChange={onChangeFolders} />
      </div>
    </div>
  );
}
