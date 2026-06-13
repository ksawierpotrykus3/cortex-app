// ============================================================================
// NEXUS — Agent Config Panel (Phase 1)
// Środkowa kolumna: konfiguracja wybranego agenta
// ============================================================================

import React, { useState, useEffect } from 'react';
import { RotateCcw, Play, Trash2, Settings, Clipboard, Folder, Globe, Bot, BookOpen } from 'lucide-react';
import { useAgentStore } from '../../store/agentStore';
import { PromptEditor } from './PromptEditor';
import { TriggerConfig } from './TriggerConfig';
import { ContextConfigPanel } from './ContextConfigPanel';
import { ContextBuilder } from './ContextBuilder';
import { PermissionPanel } from './PermissionPanel';
import { ProviderSettingsPanel } from './ProviderSettingsPanel';
import { AgentStatus, AIProvider, TriggerType, OutputDestinationType, PermissionSet, DEFAULT_PERMISSION_SET } from '../../../shared/types/schema';

// === Provider options ======================================================
interface ModelOption {
  label: string;
  modelName: string;
  providerLabel: string;
}

// === Props =================================================================
interface AgentConfigPanelProps {
  onExecute: (agentId: string) => void;
}

// === Color Palette =========================================================
const COLOR_OPTIONS = [
  '#a78bfa', // violet
  '#60a5fa', // blue
  '#34d399', // green
  '#fbbf24', // yellow
  '#f87171', // red
  '#f472b6', // pink
  '#2dd4bf', // teal
  '#fb923c', // orange
];

// === Component =============================================================
export function AgentConfigPanel({ onExecute }: AgentConfigPanelProps) {
  const { agents, selectedAgentId, updateAgent, removeAgent, selectAgent } = useAgentStore();
  const agent = agents.find(a => a.id === selectedAgentId);

  // HOOKS MUST be before any early return (Rules of Hooks)
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [providerSettingsOpen, setProviderSettingsOpen] = useState(false);
  useEffect(() => {
    const bridge = window.nexusBridge;
    if (bridge?.getAvailableModels) {
      bridge.getAvailableModels().then(models => setAvailableModels(models));
    }
  }, []);

  if (!agent) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[rgb(var(--background))]">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-[rgb(var(--panel))] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[rgb(var(--text-muted))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-[13px] text-[rgb(var(--text-muted))]">Wybierz agenta z listy</p>
          <p className="text-[11px] text-[rgb(var(--text-muted))] opacity-50 mt-1">lub utwórz nowego (+)</p>
        </div>
      </div>
    );
  }

  const isRunning = agent.status === AgentStatus.RUNNING;
  const [activeTab, setActiveTab] = useState<'general' | 'context' | 'triggers' | 'permissions'>('general');

  // Get unique provider configs
  const providerConfigs = Array.from(new Set(availableModels.map(m => m.providerLabel)));
  const modelsForCurrentProvider = availableModels.filter(m => m.providerLabel === agent.model.providerLabel);

  return (
    <>
    <div className="flex-1 flex flex-col bg-[rgb(var(--background))] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[rgb(var(--border))] bg-[rgb(var(--panel))]/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <input
            value={agent.name}
            onChange={(e) => updateAgent(agent.id, { name: e.target.value })}
            className="text-[16px] font-semibold bg-transparent border-none outline-none text-[rgb(var(--text-main))] placeholder:text-[rgb(var(--text-muted))] focus:ring-0 w-64"
            placeholder="Nazwa agenta"
          />
          <div className="flex items-center gap-1.5">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color}
                onClick={() => updateAgent(agent.id, { accentColor: color })}
                className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                  agent.accentColor === color ? 'ring-2 ring-white scale-125' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRunning ? (
            <span className="text-[11px] text-blue-400 animate-pulse">Działa...</span>
          ) : (
            <button
              onClick={() => onExecute(agent.id)}
              disabled={isRunning}
              className="px-3 py-1.5 text-[12px] font-medium bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))] rounded-lg hover:bg-[rgb(var(--accent))]/30 transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-3 h-3" />
              Uruchom
            </button>
          )}
          <button
            onClick={() => { removeAgent(agent.id); }}
            className="p-1.5 rounded-lg text-[rgb(var(--text-muted))] hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
            title="Usuń agenta"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[rgb(var(--border))] bg-[rgb(var(--panel))]/20 px-6">
        {(['general', 'context', 'triggers', 'permissions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === tab
                ? 'text-[rgb(var(--accent))] border-[rgb(var(--accent))]'
                : 'text-[rgb(var(--text-muted))] border-transparent hover:text-[rgb(var(--text-main))] hover:border-[rgb(var(--text-muted))]/30'
            }`}
          >
            {tab === 'general' ? 'Ogólne' :
             tab === 'context' ? 'Kontekst' :
             tab === 'triggers' ? 'Triggers' :
             tab === 'permissions' ? 'Uprawnienia' : tab}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'general' && (
        <div className="p-6 space-y-6">
          {/* Description */}
          <div>
            <label className="block text-[11px] font-medium text-[rgb(var(--text-muted))] uppercase tracking-wider mb-1.5">
              Opis
            </label>
            <input
              value={agent.description}
              onChange={(e) => updateAgent(agent.id, { description: e.target.value })}
              className="w-full px-3 py-2 text-[13px] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-main))] placeholder:text-[rgb(var(--text-muted))] outline-none focus:border-[rgb(var(--accent))]/50 transition-colors"
              placeholder="Krótki opis agenta..."
            />
          </div>

          {/* Prompt Editor */}
          <PromptEditor
            value={agent.promptTemplate}
            onChange={(v) => updateAgent(agent.id, { promptTemplate: v })}
          />

          {/* AI Model — dynamicznie z ProviderRegistry */}
          <div>
            <label className="block text-[11px] font-medium text-[rgb(var(--text-muted))] uppercase tracking-wider mb-1.5">
              Model AI
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <select
                  value={agent.model.providerLabel}
                  onChange={(e) => {
                    const newModels = availableModels.filter(m => m.providerLabel === e.target.value);
                    updateAgent(agent.id, {
                      model: {
                        ...agent.model,
                        providerLabel: e.target.value,
                        modelName: newModels[0]?.modelName || agent.model.modelName,
                      }
                    });
                  }}
                  className="w-full px-3 py-2 text-[13px] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]/50 transition-colors"
                >
                  {providerConfigs.length === 0 && (
                    <option value={agent.model.providerLabel}>{agent.model.providerLabel}</option>
                  )}
                  {providerConfigs.map((label) => (
                    <option key={label} value={label}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={agent.model.modelName}
                  onChange={(e) => updateAgent(agent.id, {
                    model: { ...agent.model, modelName: e.target.value }
                  })}
                  className="w-full px-3 py-2 text-[13px] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-main))] outline-none focus:border-[rgb(var(--accent))]/50 transition-colors"
                >
                  {modelsForCurrentProvider.map((m) => (
                    <option key={m.modelName} value={m.modelName}>{m.modelName}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Link do zarządzania kluczami */}
            <div className="mt-1.5 text-right">
              <button
                onClick={() => setProviderSettingsOpen(true)}
                className="text-[10px] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--accent))] transition-colors flex items-center gap-1 ml-auto cursor-pointer"
              >
                <Settings className="w-3 h-3" />
                Zarządzaj kluczami API
              </button>
            </div>
          </div>

          {/* Model Parameters */}
          <div>
            <label className="block text-[11px] font-medium text-[rgb(var(--text-muted))] uppercase tracking-wider mb-1.5">
              Parametry modelu
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-1">Temperatura</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={agent.model.temperature}
                  onChange={(e) => updateAgent(agent.id, {
                    model: { ...agent.model, temperature: parseFloat(e.target.value) }
                  })}
                  className="w-full accent-[rgb(var(--accent))]"
                />
                <span className="text-[10px] text-[rgb(var(--text-muted))]">{agent.model.temperature}</span>
              </div>
              <div>
                <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-1">Max tokenów</label>
                <input
                  type="number"
                  value={agent.model.maxTokens}
                  onChange={(e) => updateAgent(agent.id, {
                    model: { ...agent.model, maxTokens: parseInt(e.target.value) || 4096 }
                  })}
                  className="w-full px-2 py-1 text-[12px] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded text-[rgb(var(--text-main))] outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-1">Top P</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={agent.model.topP}
                  onChange={(e) => updateAgent(agent.id, {
                    model: { ...agent.model, topP: parseFloat(e.target.value) }
                  })}
                  className="w-full accent-[rgb(var(--accent))]"
                />
                <span className="text-[10px] text-[rgb(var(--text-muted))]">{agent.model.topP}</span>
              </div>
            </div>
          </div>

          {/* Safety / Budget */}
          <div>
            <label className="block text-[11px] font-medium text-[rgb(var(--text-muted))] uppercase tracking-wider mb-1.5">
              Bezpieczeństwo
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-1">Max restartów</label>
                <input
                  type="number"
                  value={agent.maxRetries}
                  onChange={(e) => updateAgent(agent.id, { maxRetries: parseInt(e.target.value) || 3 })}
                  className="w-full px-2 py-1 text-[12px] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded text-[rgb(var(--text-main))] outline-none"
                  min={0}
                  max={10}
                />
              </div>
              <div>
                <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-1">Cooldown (s)</label>
                <input
                  type="number"
                  value={agent.cooldownSeconds}
                  onChange={(e) => updateAgent(agent.id, { cooldownSeconds: parseInt(e.target.value) || 30 })}
                  className="w-full px-2 py-1 text-[12px] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded text-[rgb(var(--text-main))] outline-none"
                  min={0}
                  max={300}
                />
              </div>
              <div>
                <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-1">Budget tokenów</label>
                <input
                  type="number"
                  value={agent.budgetTokens}
                  onChange={(e) => updateAgent(agent.id, { budgetTokens: parseInt(e.target.value) || 100000 })}
                  className="w-full px-2 py-1 text-[12px] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded text-[rgb(var(--text-main))] outline-none"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-[10px] text-[rgb(var(--text-muted))] mb-1">Budget głębokości</label>
                <input
                  type="number"
                  value={agent.budgetDepth}
                  onChange={(e) => updateAgent(agent.id, { budgetDepth: parseInt(e.target.value) || 100 })}
                  className="w-full px-2 py-1 text-[12px] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded text-[rgb(var(--text-main))] outline-none"
                  min={0}
                />
              </div>
            </div>
          </div>

          {/* Output Routing */}
          <div>
            <label className="block text-[11px] font-medium text-[rgb(var(--text-muted))] uppercase tracking-wider mb-1.5">
              Routing outputu
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.values(OutputDestinationType).map((dest) => {
                const isActive = agent.outputDestinations.some(d => d.type === dest);
                return (
                  <button
                    key={dest}
                    onClick={() => {
                      const current = agent.outputDestinations;
                      const exists = current.find(d => d.type === dest);
                      updateAgent(agent.id, {
                        outputDestinations: exists
                          ? current.filter(d => d.type !== dest)
                          : [...current, { type: dest, config: {} }]
                      });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border ${
                      isActive
                        ? 'bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))] border-[rgb(var(--accent))]/30'
                        : 'bg-[rgb(var(--panel))] text-[rgb(var(--text-muted))] border-[rgb(var(--border))] hover:border-[rgb(var(--accent))]/30'
                    }`}
                  >
                    {dest === 'CHANGELOG' ? <><Clipboard className="w-3 h-3 inline mr-1" />Changelog</> :
                     dest === 'FILE' ? <><Folder className="w-3 h-3 inline mr-1" />Plik</> :
                     dest === 'WEBHOOK' ? <><Globe className="w-3 h-3 inline mr-1" />Webhook</> :
                     dest === 'AGENT' ? <><Bot className="w-3 h-3 inline mr-1" />Agent</> :
                     dest === 'CLIPBOARD' ? <><Clipboard className="w-3 h-3 inline mr-1" />Schowek</> :
                     dest === 'KNOWLEDGE' ? <><BookOpen className="w-3 h-3 inline mr-1" />Baza Wiedzy</> : dest}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[11px] font-medium text-[rgb(var(--text-muted))] uppercase tracking-wider mb-1.5">
              Tagi
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {agent.tags.map((tag, i) => (
                <span key={i} className="px-2 py-0.5 text-[10px] bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))] rounded-full flex items-center gap-1">
                  {tag}
                  <button
                    onClick={() => updateAgent(agent.id, { tags: agent.tags.filter((_, j) => j !== i) })}
                    className="hover:text-red-400 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              placeholder="Dodaj tag i naciśnij Enter..."
              className="w-full px-3 py-2 text-[12px] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-main))] placeholder:text-[rgb(var(--text-muted))] outline-none focus:border-[rgb(var(--accent))]/50 transition-colors"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const input = e.currentTarget;
                  const val = input.value.trim();
                  if (val && !agent.tags.includes(val)) {
                    updateAgent(agent.id, { tags: [...agent.tags, val] });
                  }
                  input.value = '';
                }
              }}
            />
          </div>
        </div>
        )}

        {activeTab === 'context' && (
          <div className="p-6 space-y-6">
            <ContextConfigPanel
              config={agent.contextConfig}
              onChange={(cfg) => updateAgent(agent.id, { contextConfig: cfg })}
              agentId={agent.id}
              agentName={agent.name}
            />

            {/* Separator */}
            <div className="border-t border-[rgb(var(--border))]" />

            {/* Context Builder (F6.8) */}
            <div>
              <label className="block text-[11px] font-medium text-[rgb(var(--text-muted))] uppercase tracking-wider mb-2">
                Builder kontekstu — wybierz elementy z workspace
              </label>
              <ContextBuilder
                config={agent.contextConfig}
                onChange={(cfg) => updateAgent(agent.id, { contextConfig: cfg })}
              />
            </div>
          </div>
        )}

        {activeTab === 'triggers' && (
          <div className="p-6">
            <TriggerConfig
              config={agent.trigger}
              onChange={(v) => updateAgent(agent.id, { trigger: v })}
            />
          </div>
        )}

        {activeTab === 'permissions' && (
        <div className="p-6">
          <PermissionPanel
            value={agent.permissions}
            onChange={(perms) => updateAgent(agent.id, { permissions: perms })}
            availableModels={availableModels}
          />
        </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-[rgb(var(--border))] bg-[rgb(var(--panel))]/30 flex items-center justify-between">
        <div className="text-[10px] text-[rgb(var(--text-muted))]">
          Utworzono: {new Date(agent.createdAt).toLocaleDateString('pl-PL')}
          {agent.lastRunAt && ` · Ostatnie uruchomienie: ${new Date(agent.lastRunAt).toLocaleDateString('pl-PL')}`}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateAgent(agent.id, { status: AgentStatus.ACTIVE })}
            className="px-2.5 py-1 text-[11px] bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))] rounded-lg hover:bg-[rgb(var(--accent))]/20 transition-colors cursor-pointer flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Aktywuj
          </button>
        </div>
      </div>
    </div>
      <ProviderSettingsPanel
        isOpen={providerSettingsOpen}
        onClose={() => {
          setProviderSettingsOpen(false);
          // Reload available models after closing
          const bridge = window.nexusBridge;
          if (bridge?.getAvailableModels) {
            bridge.getAvailableModels().then(models => setAvailableModels(models));
          }
        }}
      />
    </>
  );
}
