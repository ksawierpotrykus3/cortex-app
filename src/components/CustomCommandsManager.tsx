// ============================================================================
// NEXUS — Custom Commands Manager
// UI do dodawania/edycji/usuwania custom commands
// ============================================================================

import React, { useState } from 'react';
import { Plus, Pencil, Trash2, X, AlertTriangle } from 'lucide-react';
import { useCommandStore, CustomCommandData, CustomActionType } from '../renderer/store/commandStore';
import { uid } from '../utils/ids';
import { useFocusTrap } from '../hooks/useFocusTrap';

const ACTION_TYPES: CustomActionType[] = [
  'navigate', 'open-url', 'run-workflow', 'run-agent', 'run-pipeline', 'shell',
];

const ACTION_LABELS: Record<CustomActionType, string> = {
  navigate: 'Nawigacja do widoku',
  'open-url': 'Otwórz URL',
  'run-workflow': 'Uruchom workflow',
  'run-agent': 'Uruchom agenta',
  'run-pipeline': 'Uruchom pipeline',
  shell: 'Komenda systemowa',
};

const ACTION_PLACEHOLDER: Record<CustomActionType, string> = {
  navigate: 'np. nexus, lab-todo, agents, wiki, pipeline, workflows',
  'open-url': 'np. https://example.com',
  'run-workflow': 'ID workflow (np. workflow_abc)',
  'run-agent': 'ID agenta (np. agent_xyz)',
  'run-pipeline': 'ID pipeline (np. pipeline_123)',
  shell: 'np. echo hello > output.txt',
};

export function CustomCommandsManager() {
  const { manageOpen, closeManage, customCommands, addCustomCommand, updateCustomCommand, removeCustomCommand } = useCommandStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomCommandData>(defaultForm());

  if (!manageOpen) return null;

  const focusTrapRef = useFocusTrap(manageOpen);

  function defaultForm(): CustomCommandData {
    return {
      id: uid(),
      label: '',
      category: 'Custom',
      keywords: [],
      actionType: 'navigate',
      actionValue: '',
    };
  }

  const resetForm = () => {
    setForm(defaultForm());
    setEditingId(null);
  };

  const handleSave = () => {
    if (!form.label.trim() || !form.actionValue.trim()) return;
    const keywords = form.keywords.length > 0
      ? form.keywords
      : form.label.toLowerCase().split(/\s+/);
    const data = { ...form, keywords };
    if (editingId) {
      updateCustomCommand(editingId, data);
    } else {
      addCustomCommand(data);
    }
    resetForm();
  };

  const handleEdit = (cmd: CustomCommandData) => {
    setForm({ ...cmd });
    setEditingId(cmd.id);
  };

  const handleDelete = (id: string) => {
    removeCustomCommand(id);
    if (editingId === id) resetForm();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={closeManage}>
      <div className="absolute inset-0 bg-black/50" />
      <div ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="Zarządzanie komendami" className="relative w-full max-w-xl bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl shadow-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--border))]">
          <h2 className="text-[14px] font-semibold text-[rgb(var(--text-main))]">Custom Commands</h2>
          <button onClick={closeManage} aria-label="Zamknij" className="p-1 rounded-lg hover:bg-[rgb(var(--border))]/50 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {/* Form */}
          <div className="bg-[rgb(var(--background))] rounded-lg p-3 border border-[rgb(var(--border))] space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-medium text-[rgb(var(--text-muted))] block mb-1">Nazwa</label>
                <input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="np. Otwórz repozytorium"
                  className="w-full bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded px-2.5 py-1.5 text-[12px] text-[rgb(var(--text-main))] placeholder:text-[rgb(var(--text-muted))] outline-none focus:border-[rgb(var(--accent))]"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[rgb(var(--text-muted))] block mb-1">Kategoria</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Custom"
                  className="w-full bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded px-2.5 py-1.5 text-[12px] text-[rgb(var(--text-main))] placeholder:text-[rgb(var(--text-muted))] outline-none focus:border-[rgb(var(--accent))]"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-medium text-[rgb(var(--text-muted))] block mb-1">Typ akcji</label>
              <select
                value={form.actionType}
                onChange={(e) => setForm({ ...form, actionType: e.target.value as CustomActionType })}
                className="w-full bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded px-2.5 py-1.5 text-[12px] text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]"
              >
                {ACTION_TYPES.map((t) => (
                  <option key={t} value={t}>{ACTION_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-[rgb(var(--text-muted))] block mb-1">Wartość</label>
              <input
                value={form.actionValue}
                onChange={(e) => setForm({ ...form, actionValue: e.target.value })}
                placeholder={ACTION_PLACEHOLDER[form.actionType]}
                className="w-full bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded px-2.5 py-1.5 text-[12px] text-[rgb(var(--text-main))] placeholder:text-[rgb(var(--text-muted))] outline-none focus:border-[rgb(var(--accent))]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.dangerous || false}
                  onChange={(e) => setForm({ ...form, dangerous: e.target.checked })}
                  className="rounded border-[rgb(var(--border))]"
                />
                <span className="text-[11px] text-[rgb(var(--text-muted))]">Wymaga potwierdzenia</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer ml-auto">
                <span className="text-[11px] text-[rgb(var(--text-muted))]">Skrót:</span>
                <input
                  value={form.shortcut || ''}
                  onChange={(e) => setForm({ ...form, shortcut: e.target.value || undefined })}
                  placeholder="np. Ctrl+Shift+N"
                  className="w-28 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[11px] text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]"
                />
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={!form.label.trim() || !form.actionValue.trim()}
                className="flex-1 px-3 py-1.5 text-[12px] font-medium bg-[rgb(var(--accent))] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
              >
                {editingId ? 'Zapisz zmiany' : 'Dodaj komendę'}
              </button>
              {editingId && (
                <button onClick={resetForm} className="px-3 py-1.5 text-[12px] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] cursor-pointer">
                  Anuluj
                </button>
              )}
            </div>
          </div>

          {/* List */}
          {customCommands.length === 0 && (
            <p className="text-center text-[12px] text-[rgb(var(--text-muted))] py-6">
              Brak custom komend. Dodaj pierwszą powyżej.
            </p>
          )}
          {customCommands.map((cmd) => (
            <div key={cmd.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--background))]">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-[rgb(var(--text-main))] truncate">{cmd.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgb(var(--border))]/50 text-[rgb(var(--text-muted))]">{cmd.actionType}</span>
                  {cmd.dangerous && <AlertTriangle size={12} className="text-red-400 inline" />}
                </div>
                <div className="text-[10px] text-[rgb(var(--text-muted))] mt-0.5 truncate">{cmd.actionValue}{cmd.shortcut ? ` (${cmd.shortcut})` : ''}</div>
              </div>
              <button onClick={() => handleEdit(cmd)} className="p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] cursor-pointer">
                <Pencil size={14} />
              </button>
              <button onClick={() => handleDelete(cmd.id)} className="p-1 text-[rgb(var(--text-muted))] hover:text-red-400 cursor-pointer">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
