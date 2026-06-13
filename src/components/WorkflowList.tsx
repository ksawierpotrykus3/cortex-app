// ============================================================================
// NEXUS — WorkflowList
// Lista workflowów z filtrami, search, trybem i statystykami
// ============================================================================

import React from 'react';
import { Plus, GitBranch } from 'lucide-react';
import { WorkflowDefinition } from '../shared/types/workflow';

interface WorkflowListProps {
  workflows: WorkflowDefinition[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreateNew: () => void;
}

export function WorkflowList({
  workflows,
  selectedId,
  onSelect,
  onCreateNew,
}: WorkflowListProps) {
  return (
    <div className="h-full flex flex-col border-r border-[rgb(var(--border))]">
      <div className="px-3 py-3 border-b border-[rgb(var(--border))]">
        <button
          onClick={onCreateNew}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[rgb(var(--accent))] text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer"
        >
          <Plus size={14} />
          Nowy workflow
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {workflows.length === 0 ? (
          <div className="text-[11px] text-[rgb(var(--text-secondary))] text-center py-8 opacity-50">
            <GitBranch size={24} className="mx-auto mb-2 opacity-30" />
            Brak workflowów
          </div>
        ) : (
          workflows.map((wf) => (
            <div
              key={wf.id}
              onClick={() => onSelect(wf.id)}
              className={`px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                wf.id === selectedId
                  ? 'bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]'
                  : 'text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--border))]/30'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  wf.mode === 'live' ? 'bg-green-400' : 'bg-yellow-400'
                }`} />
                <span className="font-medium truncate flex-1">{wf.name}</span>
                <span className={`text-[10px] px-1 py-0.5 rounded ${
                  wf.mode === 'live'
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-yellow-500/10 text-yellow-400'
                }`}>
                  {wf.mode === 'live' ? 'LIVE' : 'SBOX'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] opacity-60 mt-0.5">
                <span>{triggerLabel(wf.trigger.type)}</span>
                <span>·</span>
                <span>{wf.actions.length} akcji</span>
                <span>·</span>
                <span>uruchomień: {wf.runCount}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function triggerLabel(type: string): string {
  const labels: Record<string, string> = {
    manual: 'Manualny',
    on_approve: 'Po approve',
    on_reject: 'Po reject',
    on_rating: 'Po ratingu',
    on_agent_complete: 'Po zakończeniu',
    scheduled: 'Harmonogram',
    webhook: 'Webhook',
  };
  return labels[type] || type;
}
