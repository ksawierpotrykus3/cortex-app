// ============================================================================
// NEXUS — WorkflowEditor
// Główny edytor workflow: trigger, warunki (bramki logiczne), akcje, sandbox/live
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Plus, Save, Trash2, Play, Square, GitBranch, Bell, BookOpen, Webhook, Clipboard, Settings } from 'lucide-react';
import {
  WorkflowDefinition,
  WorkflowAction,
  WorkflowCondition,
  ConditionGroup,
  WorkflowMode,
  WorkflowActionType,
} from '../shared/types/workflow';
import { uid } from '../utils/ids';
import { WorkflowSandboxBanner } from './WorkflowSandboxBanner';

// === Props =================================================================
interface WorkflowEditorProps {
  workflows: WorkflowDefinition[];
  selectedWorkflowId: string | null;
  onSelectWorkflow: (id: string | null) => void;
  onSaveWorkflow: (workflow: WorkflowDefinition) => void;
  onDeleteWorkflow: (id: string) => void;
  onExecuteWorkflow: (id: string) => Promise<void>;
  onCreateNew: () => void;
}

// === Domyślny workflow =====================================================
function createWorkflow(): WorkflowDefinition {
  const now = new Date().toISOString();
  return {
    id: uid(),
    name: 'Nowy workflow',
    description: '',
    mode: 'sandbox',
    trigger: { type: 'on_approve' },
    conditions: null,
    actions: [],
    createdAt: now,
    updatedAt: now,
    runCount: 0,
    lastRunAt: null,
  };
}

// === Action type metadata ==================================================
const actionTypeMeta: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  webhook: { label: 'Webhook', icon: <Webhook className="w-3.5 h-3.5" />, color: '#60a5fa' },
  save_file: { label: 'Zapisz plik', icon: <Save className="w-3.5 h-3.5" />, color: '#34d399' },
  create_task: { label: 'Utwórz task', icon: <Clipboard className="w-3.5 h-3.5" />, color: '#fbbf24' },
  execute_agent: { label: 'Uruchom agenta', icon: <Play className="w-3.5 h-3.5" />, color: '#a78bfa' },
  append_to_wiki: { label: 'Dodaj do Wiki', icon: <BookOpen className="w-3.5 h-3.5" />, color: '#34d399' },
  copy_to_clipboard: { label: 'Kopiuj do schowka', icon: <Clipboard className="w-3.5 h-3.5" />, color: '#f472b6' },
  send_notification: { label: 'Powiadomienie', icon: <Bell className="w-3.5 h-3.5" />, color: '#f87171' },
  call_api: { label: 'Zadzwoń do API', icon: <Settings className="w-3.5 h-3.5" />, color: '#60a5fa' },
  send_email: { label: 'Wyślij email', icon: <Settings className="w-3.5 h-3.5" />, color: '#fbbf24' },
};

// === Trigger type labels ===================================================
const triggerLabels: Record<string, string> = {
  manual: 'Manualny',
  on_approve: 'Po zatwierdzeniu',
  on_reject: 'Po odrzuceniu',
  on_rating: 'Po ratingu',
  on_agent_complete: 'Po zakończeniu agenta',
  scheduled: 'Zaplanowany',
  webhook: 'Webhook',
};

// ============================================================================
// WorkflowEditor Component
// ============================================================================
export function WorkflowEditor({
  workflows,
  selectedWorkflowId,
  onSelectWorkflow,
  onSaveWorkflow,
  onDeleteWorkflow,
  onExecuteWorkflow,
  onCreateNew,
}: WorkflowEditorProps) {
  const selected = workflows.find((w) => w.id === selectedWorkflowId) || null;
  const [editing, setEditing] = useState<WorkflowDefinition | null>(null);
  const [newActionType, setNewActionType] = useState<string>('webhook');
  const [showNewAction, setShowNewAction] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (selected) {
      setEditing({ ...selected });
    } else {
      setEditing(null);
    }
  }, [selected]);

  if (!editing) {
    return (
      <div className="h-full flex items-center justify-center text-[rgb(var(--text-secondary))]">
        <div className="text-center">
          <GitBranch size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Wybierz workflow z listy lub utwórz nowy</p>
          <p className="text-[11px] opacity-50 mt-1">
            Workflow automatyzuje akcje po zatwierdzeniu outputu agenta
          </p>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    if (editing) {
      onSaveWorkflow({ ...editing, updatedAt: new Date().toISOString() });
    }
  };

  const handleExecute = async () => {
    setIsRunning(true);
    try {
      await onExecuteWorkflow(editing.id);
    } finally {
      setIsRunning(false);
    }
  };

  const updateEditing = (updates: Partial<WorkflowDefinition>) => {
    setEditing({ ...editing, ...updates });
  };

  const addAction = () => {
    const action: WorkflowAction = {
      id: uid(),
      type: newActionType as WorkflowActionType,
      label: actionTypeMeta[newActionType]?.label || 'Nowa akcja',
      enabled: true,
      config: {},
    };
    updateEditing({ actions: [...editing.actions, action] });
    setShowNewAction(false);
  };

  const removeAction = (actionId: string) => {
    updateEditing({ actions: editing.actions.filter((a) => a.id !== actionId) });
  };

  const updateAction = (actionId: string, updates: Partial<WorkflowAction>) => {
    updateEditing({
      actions: editing.actions.map((a) =>
        a.id === actionId ? { ...a, ...updates } : a
      ),
    });
  };

  const addCondition = (parentGroup: ConditionGroup) => {
    const newCondition: WorkflowCondition = {
      id: uid(),
      source: { type: 'output_field', field: 'rating' },
      operator: 'gte',
      value: 7,
      label: 'Nowy warunek',
    };

    const updateGroup = (group: ConditionGroup): ConditionGroup => ({
      ...group,
      conditions: [...group.conditions, newCondition],
    });

    if (editing.conditions) {
      updateEditing({
        conditions: updateGroup(editing.conditions),
      });
    } else {
      updateEditing({
        conditions: {
          id: uid(),
          logic: 'and',
          conditions: [newCondition],
        },
      });
    }
  };

  const removeCondition = (groupId: string, conditionId: string) => {
    const removeFromGroup = (group: ConditionGroup): ConditionGroup | null => {
      const filtered = group.conditions.filter((c: any) => {
        if ('id' in c && c.id === conditionId) return false;
        return true;
      });

      const updated: ConditionGroup = {
        ...group,
        conditions: filtered.map((c: any) =>
          c.logic ? removeFromGroup(c) || c : c
        ),
      };
      return updated.conditions.length > 0 ? updated : null;
    };

    if (editing.conditions) {
      const result = removeFromGroup(editing.conditions);
      updateEditing({ conditions: result });
    }
  };

  const updateCondition = (groupId: string, conditionId: string, updates: Partial<WorkflowCondition>) => {
    const updateInGroup = (group: ConditionGroup): ConditionGroup => ({
      ...group,
      conditions: group.conditions.map((c: any) => {
        if (c.id === conditionId) return { ...c, ...updates };
        if (c.logic) return updateInGroup(c as ConditionGroup);
        return c;
      }),
    });

    if (editing.conditions) {
      updateEditing({ conditions: updateInGroup(editing.conditions) });
    }
  };

  const renderConditions = (group: ConditionGroup, depth = 0) => {
    return (
      <div key={group.id} className="space-y-1" style={{ marginLeft: depth * 16 }}>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[rgb(var(--text-secondary))] uppercase tracking-wide mb-1">
          {group.logic}
          <span className="opacity-30">({group.conditions.length} warunków)</span>
        </div>
        {group.conditions.map((c: any) => {
          if (c.logic) {
            return renderConditions(c as ConditionGroup, depth + 1);
          }
          const cond = c as WorkflowCondition;
          return (
            <div key={cond.id} className="flex items-center gap-2 px-2 py-1 rounded bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))]/50 text-xs">
              <span className="text-[10px] text-[rgb(var(--text-secondary))] w-20 truncate">
                {cond.source.type === 'output_field' ? cond.source.field : cond.source.type}
              </span>
              <select
                value={cond.operator}
                onChange={(e) => updateCondition(group.id, cond.id, { operator: e.target.value as any })}
                className="bg-transparent border border-[rgb(var(--border))] rounded px-1 py-0.5 text-[11px] outline-none"
              >
                <option value="gt">&gt;</option>
                <option value="gte">&gt;=</option>
                <option value="lt">&lt;</option>
                <option value="lte">&lt;=</option>
                <option value="eq">===</option>
                <option value="neq">!==</option>
                <option value="contains">zawiera</option>
                <option value="matches">pasuje</option>
                <option value="exists">istnieje</option>
                <option value="not_exists">nie istnieje</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
              <input
                value={String(cond.value ?? '')}
                onChange={(e) => updateCondition(group.id, cond.id, { value: e.target.value })}
                className="flex-1 bg-transparent border border-[rgb(var(--border))] rounded px-1.5 py-0.5 text-[11px] outline-none w-20"
                placeholder="wartość"
              />
              <button
                onClick={() => removeCondition(group.id, cond.id)}
                className="p-0.5 text-[rgb(var(--text-secondary))] hover:text-red-400 cursor-pointer"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
        <button
          onClick={() => addCondition(group)}
          className="text-[10px] text-[rgb(var(--accent))] hover:underline cursor-pointer"
        >
          + Dodaj warunek
        </button>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Sandbox/Live Banner */}
      <WorkflowSandboxBanner
        mode={editing.mode}
        onChangeMode={(mode) => updateEditing({ mode })}
      />

      {/* Header */}
      <div className="px-4 py-2 border-b border-[rgb(var(--border))] flex items-center gap-3 shrink-0">
        <div className="flex-1 flex items-center gap-2">
          <input
            value={editing.name}
            onChange={(e) => updateEditing({ name: e.target.value })}
            className="text-sm font-semibold bg-transparent border-none outline-none flex-1"
            placeholder="Nazwa workflow"
          />
          <textarea
            value={editing.description}
            onChange={(e) => updateEditing({ description: e.target.value })}
            className="text-[11px] bg-transparent border border-[rgb(var(--border))] rounded px-2 py-1 outline-none resize-none w-48"
            placeholder="Opis (opcjonalnie)"
            rows={1}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-3 py-1.5 bg-[rgb(var(--accent))] text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Save size={14} />
            Zapisz
          </button>
          <button
            onClick={handleExecute}
            disabled={isRunning || editing.actions.length === 0}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              isRunning
                ? 'bg-red-500/20 text-red-400'
                : 'bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent))]/20'
            } disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            {isRunning ? <Square size={14} /> : <Play size={14} />}
            {isRunning ? 'Działa...' : 'Uruchom'}
          </button>
          <button
            onClick={() => onDeleteWorkflow(editing.id)}
            className="p-1.5 rounded text-[rgb(var(--text-secondary))] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Trigger */}
        <section>
          <h3 className="text-xs font-semibold text-[rgb(var(--text-secondary))] uppercase tracking-wide mb-2">Trigger</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(triggerLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => updateEditing({ trigger: { type: key as any, config: editing.trigger.config } })}
                className={`px-2.5 py-1 rounded text-xs border transition-colors cursor-pointer ${
                  editing.trigger.type === key
                    ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]'
                    : 'border-[rgb(var(--border))] text-[rgb(var(--text-secondary))] hover:border-[rgb(var(--text-secondary))]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {editing.trigger.type === 'on_rating' && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span>Próg ratingu:</span>
              <input
                type="number"
                min={1}
                max={10}
                value={editing.trigger.config?.ratingThreshold ?? 7}
                onChange={(e) =>
                  updateEditing({
                    trigger: {
                      ...editing.trigger,
                      config: { ...editing.trigger.config, ratingThreshold: parseInt(e.target.value) },
                    },
                  })
                }
                className="w-16 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[11px] outline-none"
              />
              <select
                value={editing.trigger.config?.ratingDirection || 'above'}
                onChange={(e) =>
                  updateEditing({
                    trigger: {
                      ...editing.trigger,
                      config: { ...editing.trigger.config, ratingDirection: e.target.value as any },
                    },
                  })
                }
                className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[11px] outline-none"
              >
                <option value="above">powyżej</option>
                <option value="below">poniżej</option>
              </select>
            </div>
          )}
          <div className="mt-2 text-xs text-[rgb(var(--text-secondary))]">
            Agent:{' '}
            <span className="font-mono text-[rgb(var(--accent))]">{editing.agentId || 'nie przypisano'}</span>
          </div>
        </section>

        {/* Conditions (Bramki Logiczne) */}
        <section>
          <h3 className="text-xs font-semibold text-[rgb(var(--text-secondary))] uppercase tracking-wide mb-2">
            Warunki (Bramki Logiczne)
            <span className="ml-2 text-[10px] opacity-50 font-normal">AND / OR / NOT</span>
          </h3>
          {editing.conditions ? (
            renderConditions(editing.conditions)
          ) : (
            <button
              onClick={() => addCondition({
                id: uid(),
                logic: 'and',
                conditions: [],
              })}
              className="text-xs text-[rgb(var(--accent))] hover:underline cursor-pointer"
            >
              + Dodaj warunki
            </button>
          )}
        </section>

        {/* Actions */}
        <section>
          <h3 className="text-xs font-semibold text-[rgb(var(--text-secondary))] uppercase tracking-wide mb-2">
            Akcje ({editing.actions.length})
          </h3>
          <div className="space-y-2">
            {editing.actions.map((action, idx) => {
              const meta = actionTypeMeta[action.type] || {
                label: action.type,
                icon: <Settings className="w-3.5 h-3.5" />,
                color: '#888',
              };

              return (
                <div key={action.id} className="border border-[rgb(var(--border))] rounded-lg bg-[rgb(var(--bg-surface))]">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-[rgb(var(--border))]/50">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                    <span className="text-xs font-medium">{idx + 1}. {action.label}</span>
                    <span className="text-[10px] text-[rgb(var(--text-secondary))]">{meta.label}</span>
                    <label className="ml-auto flex items-center gap-1 text-[10px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={action.enabled}
                        onChange={(e) => updateAction(action.id, { enabled: e.target.checked })}
                        className="cursor-pointer"
                      />
                      Aktywna
                    </label>
                    <button
                      onClick={() => removeAction(action.id)}
                      className="p-0.5 text-[rgb(var(--text-secondary))] hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[rgb(var(--text-secondary))] w-16">Typ:</span>
                      <select
                        value={action.type}
                        onChange={(e) => updateAction(action.id, { type: e.target.value as any, config: {} })}
                        className="flex-1 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[11px] outline-none"
                      >
                        {Object.entries(actionTypeMeta).map(([key, m]) => (
                          <option key={key} value={key}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[rgb(var(--text-secondary))] w-16">Nazwa:</span>
                      <input
                        value={action.label}
                        onChange={(e) => updateAction(action.id, { label: e.target.value })}
                        className="flex-1 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[11px] outline-none"
                      />
                    </div>

                    {/* Type-specific config */}
                    {action.type === 'webhook' && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[rgb(var(--text-secondary))] w-16">URL:</span>
                          <input
                            value={action.config.url || ''}
                            onChange={(e) => updateAction(action.id, { config: { ...action.config, url: e.target.value } })}
                            className="flex-1 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[11px] outline-none font-mono"
                            placeholder="https://discord.com/api/webhooks/..."
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[rgb(var(--text-secondary))] w-16">Metoda:</span>
                          <select
                            value={action.config.method || 'POST'}
                            onChange={(e) => updateAction(action.id, { config: { ...action.config, method: e.target.value } })}
                            className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[11px] outline-none"
                          >
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                          </select>
                        </div>
                      </>
                    )}

                    {action.type === 'save_file' && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[rgb(var(--text-secondary))] w-16">Ścieżka:</span>
                          <input
                            value={action.config.path || ''}
                            onChange={(e) => updateAction(action.id, { config: { ...action.config, path: e.target.value } })}
                            className="flex-1 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[11px] outline-none font-mono"
                            placeholder="./raporty/"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[rgb(var(--text-secondary))] w-16">Nazwa:</span>
                          <input
                            value={action.config.filename || ''}
                            onChange={(e) => updateAction(action.id, { config: { ...action.config, filename: e.target.value } })}
                            className="flex-1 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[11px] outline-none font-mono"
                            placeholder="raport_{{date}}"
                          />
                          <select
                            value={action.config.format || 'md'}
                            onChange={(e) => updateAction(action.id, { config: { ...action.config, format: e.target.value } })}
                            className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[11px] outline-none"
                          >
                            <option value="md">.md</option>
                            <option value="txt">.txt</option>
                            <option value="json">.json</option>
                            <option value="html">.html</option>
                          </select>
                        </div>
                      </>
                    )}

                    {action.type === 'execute_agent' && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[rgb(var(--text-secondary))] w-16">Agent ID:</span>
                        <input
                          value={action.config.agentId || ''}
                          onChange={(e) => updateAction(action.id, { config: { ...action.config, agentId: e.target.value } })}
                          className="flex-1 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[11px] outline-none font-mono"
                          placeholder="agent_123"
                        />
                      </div>
                    )}

                    {/* Template editor for all action types */}
                    <div>
                      <span className="text-[10px] text-[rgb(var(--text-secondary))]">Szablon:</span>
                      <textarea
                        value={action.template || ''}
                        onChange={(e) => updateAction(action.id, { template: e.target.value })}
                        className="w-full mt-1 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[11px] font-mono outline-none resize-none"
                        rows={2}
                        placeholder="{{output.content}}"
                      />
                      <div className="text-[10px] text-[rgb(var(--text-secondary))] mt-0.5">
                        Zmienne: {'{{output.content}}'} {'{{agent.name}}'} {'{{date}}'} {'{{time}}'}
                        {'{{now}}'} {'{{nl}}'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add action */}
          <div className="mt-3 flex items-center gap-2">
            <select
              value={newActionType}
              onChange={(e) => setNewActionType(e.target.value)}
              className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1.5 text-[11px] outline-none"
            >
              {Object.entries(actionTypeMeta).map(([key, m]) => (
                <option key={key} value={key}>{m.label}</option>
              ))}
            </select>
            <button
              onClick={addAction}
              className="flex items-center gap-1 px-3 py-1.5 border border-dashed border-[rgb(var(--border))] rounded-lg text-xs text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--accent))] hover:border-[rgb(var(--accent))]/50 transition-colors cursor-pointer"
            >
              <Plus size={14} />
              Dodaj akcję
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}


