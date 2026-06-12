// ============================================================================
// NEXUS — Agent List Panel (Phase 1)
// Lewa kolumna: lista wszystkich agentów z statusem, ratingiem, akcjami
// ============================================================================

import React from 'react';
import { Plus, Play, Square, Copy, Trash2, Settings, Bot, AlertCircle, CheckCircle, PauseCircle, XCircle, Clock } from 'lucide-react';
import { useAgentStore } from '../../store/agentStore';
import { AgentStatus } from '../../../shared/types/schema';

// === Status Icon Map =======================================================
const statusIcons: Record<AgentStatus, React.ReactNode> = {
  [AgentStatus.ACTIVE]: <CheckCircle className="w-3 h-3 text-green-400" />,
  [AgentStatus.RUNNING]: <Bot className="w-3 h-3 text-blue-400 animate-pulse" />,
  [AgentStatus.SUSPENDED]: <PauseCircle className="w-3 h-3 text-yellow-400" />,
  [AgentStatus.CRASHED]: <AlertCircle className="w-3 h-3 text-red-400" />,
  [AgentStatus.DISABLED]: <XCircle className="w-3 h-3 text-gray-500" />,
  [AgentStatus.COOLDOWN]: <Clock className="w-3 h-3 text-orange-400" />,
};

const statusLabels: Record<AgentStatus, string> = {
  [AgentStatus.ACTIVE]: 'Aktywny',
  [AgentStatus.RUNNING]: 'Działa',
  [AgentStatus.SUSPENDED]: 'Wstrzymany',
  [AgentStatus.CRASHED]: 'Błąd',
  [AgentStatus.DISABLED]: 'Wyłączony',
  [AgentStatus.COOLDOWN]: 'Odpoczynek',
};

// === Props =================================================================
interface AgentListPanelProps {
  onExecuteAgent: (agentId: string) => void;
  onStopAgent: (agentId: string) => void;
}

// === Component =============================================================
export function AgentListPanel({ onExecuteAgent, onStopAgent }: AgentListPanelProps) {
  const { agents, selectedAgentId, selectAgent, createNewAgent, removeAgent, duplicateAgent } = useAgentStore();

  return (
    <div className="w-72 border-r border-[rgb(var(--border))] flex flex-col h-full bg-[rgb(var(--background))] overflow-hidden shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[rgb(var(--border))] bg-[rgb(var(--panel))]/30 flex items-center justify-between">
        <h2 className="text-[13px] font-display font-bold tracking-wider text-[rgb(var(--text-muted))] uppercase">
          Agenci
        </h2>
        <button
          onClick={createNewAgent}
          className="p-1.5 rounded-lg text-[rgb(var(--text-muted))] hover:text-[rgb(var(--accent))] hover:bg-[rgb(var(--border))]/50 transition-colors cursor-pointer"
          title="Nowy Agent"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {agents.length === 0 ? (
          <div className="p-6 text-center">
            <Bot className="w-8 h-8 mx-auto mb-3 text-[rgb(var(--text-muted))] opacity-30" />
            <p className="text-[12px] text-[rgb(var(--text-muted))] opacity-50">
              Brak agentów.<br />Kliknij + aby dodać.
            </p>
          </div>
        ) : (
          agents.map((agent) => {
            const isSelected = agent.id === selectedAgentId;
            const isRunning = agent.status === AgentStatus.RUNNING;

            return (
              <div
                key={agent.id}
                onClick={() => selectAgent(agent.id)}
                className={`group px-4 py-2.5 border-b border-[rgb(var(--border))]/50 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[rgb(var(--accent))]/10 border-l-2 border-l-[rgb(var(--accent))]'
                    : 'hover:bg-[rgb(var(--panel))]/50 border-l-2 border-l-transparent'
                }`}
              >
                {/* Name + Status */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: agent.accentColor || '#a78bfa' }} />
                    <span className="text-[13px] font-medium text-[rgb(var(--text-main))] truncate">
                      {agent.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {statusIcons[agent.status]}
                    {agent.rating > 0 && (
                      <span className="text-[10px] text-[rgb(var(--text-muted))] ml-1">
                        {agent.rating}/10
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {agent.description && (
                  <p className="text-[11px] text-[rgb(var(--text-muted))] truncate mb-1.5">
                    {agent.description}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isRunning ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onStopAgent(agent.id); }}
                      className="p-1 rounded text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
                      title="Zatrzymaj"
                    >
                      <Square className="w-3 h-3" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); onExecuteAgent(agent.id); }}
                      className="p-1 rounded text-green-400 hover:bg-green-400/10 transition-colors cursor-pointer"
                      title="Uruchom"
                    >
                      <Play className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); duplicateAgent(agent.id); }}
                    className="p-1 rounded text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--border))]/50 transition-colors cursor-pointer"
                    title="Duplikuj"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeAgent(agent.id); }}
                    className="p-1 rounded text-[rgb(var(--text-muted))] hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
                    title="Usuń"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[rgb(var(--text-muted))]">
                  <span>Uruchomień: {agent.runCount}</span>
                  {agent.errorCount > 0 && (
                    <span className="text-red-400/70">Błędów: {agent.errorCount}</span>
                  )}
                  <span className="ml-auto">{statusLabels[agent.status]}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-4 py-2 border-t border-[rgb(var(--border))] bg-[rgb(var(--panel))]/30">
        <div className="flex items-center justify-between text-[10px] text-[rgb(var(--text-muted))]">
          <span>{agents.length} agentów</span>
          <span>{agents.filter(a => a.status === AgentStatus.RUNNING).length} aktywnych</span>
        </div>
      </div>
    </div>
  );
}
