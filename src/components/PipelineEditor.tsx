// ============================================================================
// NEXUS — PipelineEditor
// Wizualny edytor pipeline'ów DAG — lista pipeline'ów + siatka konfiguracji
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Save, Trash2, Play, Square, Settings, GripVertical, Bot, FileText, SplitSquareVertical, Network, GitBranch, Activity } from 'lucide-react';
import { Pipeline, WorkflowNode, PortConnection, DryRunResult } from '../shared/types/schema';
import { uid } from '../utils/ids';
import { TemplateAutocomplete } from "./TemplateAutocomplete";
import { DryRunResultModal } from "./DryRunResultModal";

// === Props =================================================================
interface PipelineEditorProps {
  pipelines: Pipeline[];
  onSavePipeline: (pipeline: Pipeline) => void;
  onDeletePipeline: (id: string) => void;
  onExecutePipeline: (id: string) => void;
  runningPipelineId: string | null;
}

// === Domyślny pipeline =====================================================
function createEmptyPipeline(): Pipeline {
  const now = new Date().toISOString();
  return {
    id: uid(),
    name: 'Nowy pipeline',
    description: '',
    nodes: [],
    connections: [],
    createdAt: now,
    updatedAt: now,
    isHeadless: false,
  };
}

// === Node type labels & icons ==============================================
const nodeTypeMeta: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  'llm-agent': { label: 'Agent AI', icon: <Bot className="w-3.5 h-3.5" />, color: '#a78bfa' },
  'accumulator': { label: 'Akumulator', icon: <FileText className="w-3.5 h-3.5" />, color: '#34d399' },
  'router': { label: 'Router', icon: <SplitSquareVertical className="w-3.5 h-3.5" />, color: '#fbbf24' },
  'human-in-the-loop': { label: 'Człowiek w pętli', icon: <Network className="w-3.5 h-3.5" />, color: '#f87171' },
  'condition': { label: 'Warunek IF/THEN', icon: <GitBranch className="w-3.5 h-3.5" />, color: '#60a5fa' },
};

// === Component =============================================================
export function PipelineEditor({
  pipelines,
  onSavePipeline,
  onDeletePipeline,
  onExecutePipeline,
  runningPipelineId,
}: PipelineEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Pipeline | null>(null);
  const [newNodeType, setNewNodeType] = useState<string>('llm-agent');
  const [showNewNode, setShowNewNode] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);

  const selected = pipelines.find(p => p.id === selectedId) || null;

  // Start editing when selected
  useEffect(() => {
    if (selected) {
      setEditing({ ...selected });
    } else {
      setEditing(null);
    }
  }, [selected]);

  const handleNew = () => {
    const pipeline = createEmptyPipeline();
    onSavePipeline(pipeline);
    setSelectedId(pipeline.id);
  };

  const handleSave = () => {
    if (editing) {
      onSavePipeline({ ...editing, updatedAt: new Date().toISOString() });
    }
  };

  const handleDelete = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
    }
    onDeletePipeline(id);
  };

  const handleAddNode = () => {
    if (!editing) return;
    const node: WorkflowNode = {
      id: `node_${uid()}`,
      type: newNodeType as WorkflowNode['type'],
      name: nodeTypeMeta[newNodeType]?.label || 'Nowy node',
      config: {},
      position: {
        x: 50 + editing.nodes.length * 30,
        y: 50 + editing.nodes.length * 20,
      },
    };
    if (newNodeType === 'llm-agent') {
      node.agentId = '';
      node.systemPrompt = '';
    }
    if (newNodeType === 'condition') {
      node.config = { expression: '{{prev.output}} contains ""' };
    }
    setEditing({
      ...editing,
      nodes: [...editing.nodes, node],
    });
    setShowNewNode(false);
  };

  const handleRemoveNode = (nodeId: string) => {
    if (!editing) return;
    setEditing({
      ...editing,
      nodes: editing.nodes.filter(n => n.id !== nodeId),
      connections: editing.connections.filter(c => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId),
    });
  };

  const handleUpdateNode = (nodeId: string, updates: Partial<WorkflowNode>) => {
    if (!editing) return;
    setEditing({
      ...editing,
      nodes: editing.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n),
    });
  };

  const handleAddConnection = (sourceNodeId: string, targetNodeId: string) => {
    if (!editing || sourceNodeId === targetNodeId) return;
    const exists = editing.connections.some(
      c => c.sourceNodeId === sourceNodeId && c.targetNodeId === targetNodeId
    );
    if (exists) return;

    const conn: PortConnection = {
      id: `conn_${uid()}`,
      sourceNodeId,
      sourcePort: 'output',
      targetNodeId,
      targetPort: 'input',
    };
    setEditing({
      ...editing,
      connections: [...editing.connections, conn],
    });
  };

  const handleRemoveConnection = (connId: string) => {
    if (!editing) return;
    setEditing({
      ...editing,
      connections: editing.connections.filter(c => c.id !== connId),
    });
  };

  const isRunning = runningPipelineId === selectedId;

  return (
    <div className="h-full flex bg-[rgb(var(--background))]">
      {/* Left: Pipeline list */}
      <div className="w-56 border-r border-[rgb(var(--border))] flex flex-col shrink-0">
        <div className="px-3 py-3 border-b border-[rgb(var(--border))]">
          <button
            onClick={handleNew}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[rgb(var(--accent))] text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus size={14} />
            Nowy pipeline
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {pipelines.length === 0 ? (
            <p className="text-[11px] text-[rgb(var(--text-secondary))] text-center py-8 opacity-50">
              Brak pipeline'ów
            </p>
          ) : (
            pipelines.map(p => (
              <div
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                  p.id === selectedId
                    ? 'bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]'
                    : 'text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--border))]/30'
                }`}
              >
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-[10px] opacity-60 mt-0.5">
                  {p.nodes.length} nodów · {p.connections.length} połączeń
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {editing ? (
          <>
            {/* Header */}
            <div className="px-4 py-2 border-b border-[rgb(var(--border))] flex items-center gap-3 shrink-0">
              <input
                value={editing.name}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
                className="text-sm font-semibold bg-transparent border-none outline-none flex-1"
                placeholder="Nazwa pipeline'u"
              />
              <textarea
                value={editing.description}
                onChange={e => setEditing({ ...editing, description: e.target.value })}
                className="text-[11px] bg-transparent border border-[rgb(var(--border))] rounded px-2 py-1 outline-none resize-none w-48"
                placeholder="Opis (opcjonalnie)"
                rows={1}
              />
              <button
                onClick={handleSave}
                className="flex items-center gap-1 px-3 py-1.5 bg-[rgb(var(--accent))] text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Save size={14} />
                Zapisz
              </button>
              <button
                onClick={() => onExecutePipeline(editing.id)}
                disabled={isRunning || editing.nodes.length === 0}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isRunning
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                } disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                {isRunning ? <Square size={14} /> : <Play size={14} />}
                {isRunning ? 'Działa...' : 'Uruchom'}
              </button>
              {/* #10: Dry-Run */}
              <button
                onClick={async () => {
                  try {
                    const bridge = (window as any).nexusBridge as any;
                    if (bridge?.dryRunPipeline && editing) {
                      const result = await bridge.dryRunPipeline({ pipeline: editing });
                      setDryRunResult(result);
                    }
                  } catch (err) {
                    console.error('[Dry-Run] Error:', err);
                  }
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] border border-[rgb(var(--border))] hover:border-[rgb(var(--accent))] transition-colors cursor-pointer"
              >
                <Activity size={14} />
                Dry-Run
              </button>
              <button
                onClick={() => handleDelete(editing.id)}
                className="p-1.5 rounded text-[rgb(var(--text-secondary))] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Nodes grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Node list */}
              <div className="space-y-2">
                {editing.nodes.map((node, idx) => {
                  const meta = nodeTypeMeta[node.type] || { label: node.type, icon: <Settings className="w-3.5 h-3.5" />, color: '#888' };
                  const incomingConns = editing.connections.filter(c => c.targetNodeId === node.id);
                  const outgoingConns = editing.connections.filter(c => c.sourceNodeId === node.id);

                  return (
                    <div key={node.id} className="border border-[rgb(var(--border))] rounded-lg bg-[rgb(var(--bg-surface))]">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-[rgb(var(--border))]/50">
                        <GripVertical size={14} className="text-[rgb(var(--text-secondary))] opacity-30" />
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                        <span className="text-xs font-medium">{node.name}</span>
                        <span className="text-[10px] text-[rgb(var(--text-secondary))]">{meta.label}</span>
                        {node.condition && node.condition.mode !== 'always' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 ml-1">
                            IF {node.condition.expression.slice(0, 20)}...
                          </span>
                        )}
                        <div className="flex-1" />
                        {/* Connection targets dropdown */}
                        {editing.nodes.filter(n => n.id !== node.id).length > 0 && (
                          <select
                            value=""
                            onChange={e => {
                              if (e.target.value) {
                                handleAddConnection(node.id, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            className="text-[10px] bg-transparent border border-[rgb(var(--border))] rounded px-1 py-0.5 outline-none cursor-pointer"
                          >
                            <option value="">→ połącz...</option>
                            {editing.nodes
                              .filter(n => n.id !== node.id && !editing.connections.some(c => c.sourceNodeId === node.id && c.targetNodeId === n.id))
                              .map(n => (
                                <option key={n.id} value={n.id}>{n.name}</option>
                              ))}
                          </select>
                        )}
                        <button
                          onClick={() => handleRemoveNode(node.id)}
                          className="p-0.5 rounded text-[rgb(var(--text-secondary))] hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[rgb(var(--text-secondary))] w-16">Nazwa:</span>
                          <input
                            value={node.name}
                            onChange={e => handleUpdateNode(node.id, { name: e.target.value })}
                            className="flex-1 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[11px] outline-none"
                          />
                        </div>
                        {node.type === 'llm-agent' && (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-[rgb(var(--text-secondary))] w-16">Agent ID:</span>
                              <input
                                value={node.agentId || ''}
                                onChange={e => handleUpdateNode(node.id, { agentId: e.target.value })}
                                className="flex-1 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[11px] outline-none font-mono"
                                placeholder="agent_123"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-[rgb(var(--text-secondary))]">System prompt:</span>
                              <textarea
                                value={node.systemPrompt || ''}
                                onChange={e => handleUpdateNode(node.id, { systemPrompt: e.target.value })}
                                className="w-full mt-1 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[11px] font-mono outline-none resize-none"
                                rows={2}
                                placeholder="Opcjonalnie — nadpisuje promptTemplate agenta"
                              />
                            </div>
                          </>
                        )}
                        {/* #6: IF/THEN Condition dla każdego node'a */}
                        <div className="pt-2 border-t border-[rgb(var(--border))]/50">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] text-[rgb(var(--text-secondary))] font-medium">IF/THEN:</span>
                            <select
                              value={node.condition?.mode || 'always'}
                              onChange={e => {
                                const mode = e.target.value as 'skip-when-false' | 'skip-when-true' | 'always';
                                if (mode === 'always') {
                                  const { condition, ...rest } = node;
                                  handleUpdateNode(node.id, rest as any);
                                } else {
                                  handleUpdateNode(node.id, {
                                    condition: { expression: node.condition?.expression || '', mode },
                                  });
                                }
                              }}
                              className="text-[10px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-1.5 py-0.5 outline-none cursor-pointer"
                            >
                              <option value="always">Zawsze wykonuj</option>
                              <option value="skip-when-false">Pomiń gdy FALSE</option>
                              <option value="skip-when-true">Pomiń gdy TRUE</option>
                            </select>
                          </div>
                          {node.condition && node.condition.mode !== 'always' && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-[rgb(var(--text-secondary))] w-10">Expr:</span>
                              <div className="flex-1">
                                <TemplateAutocomplete
                                  value={node.condition.expression}
                                  onChange={v => handleUpdateNode(node.id, {
                                    condition: { ...node.condition!, expression: v },
                                  })}
                                  context="pipeline"
                                  placeholder='{{prev.output}} contains "błąd"'
                                  className="w-full bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[10px] outline-none font-mono"
                                  rows={1}
                                />
                              </div>
                            </div>
                          )}
                          {node.condition && node.condition.mode !== 'always' && (
                            <div className="mt-1 text-[9px] text-[rgb(var(--text-secondary))]">
                              Dostępne: <code className="bg-[rgb(var(--background))] px-1 rounded">contains</code>,{' '}
                              <code className="bg-[rgb(var(--background))] px-1 rounded">===</code>,{' '}
                              <code className="bg-[rgb(var(--background))] px-1 rounded">matches /regex/</code>,{' '}
                              <code className="bg-[rgb(var(--background))] px-1 rounded">output.length &gt; N</code>,{' '}
                              <code className="bg-[rgb(var(--background))] px-1 rounded">is empty</code>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[rgb(var(--text-secondary))] w-16">Konfig:</span>
                          <input
                            value={JSON.stringify(node.config)}
                            onChange={e => {
                              try {
                                handleUpdateNode(node.id, { config: JSON.parse(e.target.value) });
                              } catch {}
                            }}
                            className="flex-1 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[11px] outline-none font-mono"
                            placeholder='{"key": "value"}'
                          />
                        </div>
                        {/* Connection info */}
                        <div className="flex items-center gap-3 text-[10px] text-[rgb(var(--text-secondary))]">
                          {incomingConns.length > 0 && (
                            <span>← {incomingConns.map(c => editing.nodes.find(n => n.id === c.sourceNodeId)?.name).filter(Boolean).join(', ')}</span>
                          )}
                          {outgoingConns.length > 0 && (
                            <span>→ {outgoingConns.map(c => editing.nodes.find(n => n.id === c.targetNodeId)?.name).filter(Boolean).join(', ')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add node button */}
              <div className="mt-3 flex items-center gap-2">
                <select
                  value={newNodeType}
                  onChange={e => setNewNodeType(e.target.value)}
                  className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1.5 text-[11px] outline-none"
                >
                  {Object.entries(nodeTypeMeta).map(([key, meta]) => (
                    <option key={key} value={key}>{meta.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleAddNode}
                  className="flex items-center gap-1 px-3 py-1.5 border border-dashed border-[rgb(var(--border))] rounded-lg text-xs text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--accent))] hover:border-[rgb(var(--accent))]/50 transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  Dodaj node
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[rgb(var(--text-secondary))]">
            <div className="text-center">
              <Network size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Wybierz pipeline z listy lub utwórz nowy</p>
              <p className="text-[11px] opacity-50 mt-1">
                Pipeline łączy agentów w łańcuchy — output jednego jest inputem następnego
              </p>
            </div>
          </div>
        )}
      </div>

      <DryRunResultModal
        result={dryRunResult}
        open={dryRunResult !== null}
        onClose={() => setDryRunResult(null)}
      />
    </div>
  );
}
