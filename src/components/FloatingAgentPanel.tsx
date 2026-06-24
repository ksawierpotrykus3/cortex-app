// ============================================================================
// NEXUS — FloatingAgentPanel
// Plywajacy panel po prawej stronie z agentami-okienkami.
// Wybierasz ktorych istniejacych agentow chcesz tu miec.
// ============================================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import { X, PanelRight, ChevronDown, ChevronUp, Bot, Send, Shield, Plus } from "lucide-react";
import { useContextTracker, TrackerState } from "../hooks/useContextTracker";
import { ContextBar } from "./ContextBar";
import { ViewMode, FeedbackEntry } from "../types";
import { CapabilityCategory, ApprovalLevel, ALL_CAPABILITIES, CapabilityEntry } from "../shared/types/capabilities";
import { saveChatSessions, loadChatSessions, deleteChatSession } from "../utils/chatStorage";
import { AtMentionAutocomplete, MentionableItem, resolveAtReferences } from "./AtMentionAutocomplete";

interface FloatingMessage {
  role: 'user' | 'assistant' | 'system' | 'approval_request' | 'approval_response' | 'action' | 'failover_proposal' | 'recovery_proposal';
  content: string;
  timestamp: string;
  capability?: CapabilityCategory;
  proposalId?: string;
  onApprove?: () => void;
  onReject?: () => void;
}

interface FloatingAgent {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  collapsed: boolean;
  capabilities: CapabilityEntry[];
  allowedFolders: string[];
  messages: FloatingMessage[];
}

interface FloatingAgentPanelProps {
  viewMode: ViewMode;
  selectedNodeId: string | null;
  selectedAgentId: string | null;
  selectedTaskId: string | null;
  selectedManuscriptId: string | null;
  projectId: string | null;
  lastAction: string;
  onSaveFeedback?: (entry: Omit<FeedbackEntry, 'id' | 'timestamp'>) => void;
  onSendToAgent?: (agentId: string, message: string, context: TrackerState) => Promise<string>;
  /** Lista wszystkich agentow w projekcie (z widoku Agents) */
  allAgents?: { id: string; name: string; systemPrompt: string; model: string; capabilities: CapabilityEntry[]; allowedFolders: string[] }[];
  /** 🔁 Lista elementów do wstrzykiwania @ */
  mentionableItems?: MentionableItem[];
}

export function FloatingAgentPanel(props: FloatingAgentPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [agents, setAgents] = useState<FloatingAgent[]>([]);
  const [showPickList, setShowPickList] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const tracker = useContextTracker({
    activeView: props.viewMode,
    selectedNodeId: props.selectedNodeId,
    selectedAgentId: props.selectedAgentId,
    selectedTaskId: props.selectedTaskId,
    selectedManuscriptId: props.selectedManuscriptId,
    projectId: props.projectId,
    lastAction: props.lastAction,
  });

  // 🔁 Permanentny zapis: wczytaj sesje przy pierwszym otwarciu panelu
  useEffect(() => {
    if (!isOpen || isLoaded) return;
    loadChatSessions().then(sessions => {
      if (sessions.length > 0) {
        const restored: FloatingAgent[] = sessions.map(s => ({
          id: s.id,
          name: s.name,
          model: s.model,
          systemPrompt: '',
          collapsed: s.collapsed,
          capabilities: [],
          allowedFolders: [],
          messages: s.messages.map(m => ({
            role: m.role as FloatingMessage['role'],
            content: m.content,
            timestamp: m.timestamp,
          })),
        }));
        setAgents(restored);
      }
      setIsLoaded(true);
    }).catch(() => setIsLoaded(true));
  }, [isOpen, isLoaded]);

  // Failover Interactive Listeners
  useEffect(() => {
    const bridge = window.nexusBridge;
    if (!bridge) return;

    if (bridge.onFailoverProposal) {
      const unsub = bridge.onFailoverProposal((data) => {
        setAgents(prev => prev.map(a => {
          const isMatch = a.model === data.modelName || a.model.includes(data.modelName);
          if (!isMatch) return a;

          const proposalMessage: FloatingMessage = {
            role: 'failover_proposal',
            content: `⚠️ Darmowy model ${data.modelName.includes('pro') ? 'DeepSeek v4 Pro' : 'DeepSeek v4 Flash'} nie odpowiada. Czy chcesz przełączyć się na płatny odpowiednik? (Limit czasu: ${data.timeoutSeconds}s)`,
            timestamp: new Date().toISOString(),
            proposalId: data.proposalId,
            onApprove: () => {
              bridge.respondFailover({ proposalId: data.proposalId, approved: true });
              setAgents(curr => curr.map(currA => {
                if (currA.id !== a.id) return currA;
                return {
                  ...currA,
                  messages: currA.messages.map(m => m.proposalId === data.proposalId ? {
                    role: 'action',
                    content: '✓ Przełączono na płatny model zapasowy.',
                    timestamp: new Date().toISOString()
                  } : m)
                };
              }));
            },
            onReject: () => {
              bridge.respondFailover({ proposalId: data.proposalId, approved: false });
              setAgents(curr => curr.map(currA => {
                if (currA.id !== a.id) return currA;
                return {
                  ...currA,
                  messages: currA.messages.map(m => m.proposalId === data.proposalId ? {
                    role: 'action',
                    content: '✗ Odrzucono przełączenie. Zapytanie zakończy się błędem.',
                    timestamp: new Date().toISOString()
                  } : m)
                };
              }));
            }
          };

          return {
            ...a,
            messages: [...a.messages, proposalMessage]
          };
        }));
      });
      return unsub;
    }
  }, []);

  useEffect(() => {
    const bridge = window.nexusBridge;
    if (!bridge) return;

    if (bridge.onRecoveryProposal) {
      const unsub = bridge.onRecoveryProposal((data) => {
        setAgents(prev => prev.map(a => {
          const isMatch = a.model === data.modelName || a.model.includes(data.modelName);
          if (!isMatch) return a;

          const recoveryMessage: FloatingMessage = {
            role: 'recovery_proposal',
            content: `💡 Wykryto stabilną darmową wersję ${data.modelName.includes('pro') ? 'DeepSeek v4 Pro' : 'DeepSeek v4 Flash'}. Czy chcesz wrócić na wersję darmową?`,
            timestamp: new Date().toISOString(),
            onApprove: () => {
              bridge.respondRecovery({ modelName: data.modelName, approved: true });
              setAgents(curr => curr.map(currA => {
                if (currA.id !== a.id) return currA;
                return {
                  ...currA,
                  messages: currA.messages.map(m => m.content === recoveryMessage.content ? {
                    role: 'action',
                    content: '✓ Przywrócono darmowy model.',
                    timestamp: new Date().toISOString()
                  } : m)
                };
              }));
            },
            onReject: () => {
              bridge.respondRecovery({ modelName: data.modelName, approved: false });
              setAgents(curr => curr.map(currA => {
                if (currA.id !== a.id) return currA;
                return {
                  ...currA,
                  messages: currA.messages.map(m => m.content === recoveryMessage.content ? {
                    role: 'action',
                    content: 'Zostano przy wersji płatnej.',
                    timestamp: new Date().toISOString()
                  } : m)
                };
              }));
            }
          };

          return {
            ...a,
            messages: [...a.messages, recoveryMessage]
          };
        }));
      });
      return unsub;
    }
  }, []);

  // 🔁 Auto-zapis przy każdej zmianie agentów (debounced)
  useEffect(() => {
    if (!isLoaded || agents.length === 0) return;
    const timer = setTimeout(() => {
      saveChatSessions(agents.map(a => ({
        id: a.id,
        name: a.name,
        model: a.model,
        messages: a.messages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp })),
        collapsed: a.collapsed,
      })));
    }, 1000); // debounce 1s
    return () => clearTimeout(timer);
  }, [agents, isLoaded]);

  const addExistingAgent = useCallback((agent: NonNullable<FloatingAgentPanelProps['allAgents']>[0]) => {
    if (agents.some(a => a.id === agent.id)) return; // juz dodany
    const newAgent: FloatingAgent = {
      id: agent.id,
      name: agent.name,
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      collapsed: false,
      capabilities: agent.capabilities,
      allowedFolders: agent.allowedFolders,
      messages: [
        {
          role: 'system',
          content: `Jestes ${agent.name}. ${agent.systemPrompt}\n\nKontekst uzytkownika bedzie przychodzil automatycznie z kazda wiadomoscia.`,
          timestamp: new Date().toISOString(),
        },
      ],
    };
    setAgents(prev => [...prev, newAgent]);
    setShowPickList(false);
  }, [agents]);

  const sendMessage = useCallback(async (agentId: string, text: string) => {
    setAgents(prev => prev.map(a => {
      if (a.id !== agentId) return a;
      return {
        ...a,
        messages: [...a.messages, { role: 'user', content: text, timestamp: new Date().toISOString() }],
      };
    }));

    if (props.onSendToAgent) {
      try {
        const agent = agents.find(a => a.id === agentId);
        if (!agent) return;

        let fullPrompt = agent.systemPrompt + '\n\n';

        if (agent.capabilities.some(c => c.capability === 'read:context' || c.capability === 'admin')) {
          fullPrompt += `=== KONTEKST UZYTKOWNIKA ===\n${tracker.label}\n\n`;
        }

        if (agent.capabilities.some(c => c.capability === 'read:selection' || c.capability === 'admin')) {
          if (tracker.selectedText) {
            fullPrompt += `=== ZAZNACZONY TEKST ===\n${tracker.selectedText}\n\n`;
          }
        }

        if (agent.capabilities.some(c => c.capability === 'read:clipboard' || c.capability === 'admin')) {
          if (tracker.clipboardContent) {
            fullPrompt += `=== SCHOWEK ===\n${tracker.clipboardContent}\n\n`;
          }
        }

        fullPrompt += `=== WIADOMOSC UZYTKOWNIKA ===\n${text}`;

        const response = await props.onSendToAgent(agentId, fullPrompt, tracker);

        setAgents(prev => prev.map(a => {
          if (a.id !== agentId) return a;
          return {
            ...a,
            messages: [...a.messages, { role: 'assistant', content: response, timestamp: new Date().toISOString() }],
          };
        }));
      } catch (err) {
        setAgents(prev => prev.map(a => {
          if (a.id !== agentId) return a;
          return {
            ...a,
            messages: [...a.messages, {
              role: 'system',
              content: `Blad: ${err instanceof Error ? err.message : 'Nieznany blad'}`,
              timestamp: new Date().toISOString()
            }],
          };
        }));
      }
    }
  }, [agents, tracker, props.onSendToAgent]);

  const removeAgent = useCallback((agentId: string) => {
    setAgents(prev => prev.filter(a => a.id !== agentId));
    deleteChatSession(agentId); // usuń też z IndexedDB
  }, []);

  const toggleCollapse = useCallback((agentId: string) => {
    setAgents(prev => prev.map(a =>
      a.id === agentId ? { ...a, collapsed: !a.collapsed } : a
    ));
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-16 right-4 z-50 bg-[rgb(var(--accent))] text-black p-3 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center cursor-pointer group"
        title="Otworz agentow"
      >
        <PanelRight size={20} />
      </button>
    );
  }

  return (
    <div className="fixed top-2 bottom-2 right-2 z-50 w-[640px] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--border))] shrink-0">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-[rgb(var(--text-secondary))]" />
          <span className="text-sm font-semibold">Agenci</span>
          <span className="text-[11px] text-[rgb(var(--text-muted))]">({agents.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowPickList(!showPickList)}
            className="px-3 py-1.5 text-[11px] font-medium text-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10 rounded-lg hover:bg-[rgb(var(--accent))]/20 transition-colors cursor-pointer"
          >
            <Plus size={14} className="inline mr-1" />
            Dodaj agenta
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--background))] transition-colors cursor-pointer rounded-lg" title="Zamknij">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Pick list — wybierz istniejacego agenta */}
      {showPickList && (
        <div className="px-4 py-2.5 border-b border-[rgb(var(--border))] bg-[rgb(var(--background))]/30 space-y-1.5 max-h-[200px] overflow-y-auto">
          <div className="text-[11px] font-medium text-[rgb(var(--text-muted))] mb-1.5">Wybierz agenta z listy:</div>
          {(props.allAgents && props.allAgents.length > 0) ? (
            props.allAgents.filter(a => !agents.some(fa => fa.id === a.id)).map(agent => (
              <button
                key={agent.id}
                onClick={() => addExistingAgent(agent)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left bg-[rgb(var(--accent))]/5 border border-[rgb(var(--border))] rounded-lg hover:bg-[rgb(var(--accent))]/10 hover:text-[rgb(var(--accent))] transition-colors cursor-pointer"
              >
                <Bot size={14} className="shrink-0 text-[rgb(var(--text-secondary))]" />
                <span className="font-medium truncate">{agent.name}</span>
                <span className="text-[10px] text-[rgb(var(--text-tertiary))] ml-auto">{agent.model}</span>
              </button>
            ))
          ) : (
            <div className="text-[11px] text-[rgb(var(--text-muted))] py-3 text-center">
              Brak agentow. Stworz agenta w widoku Agents.
            </div>
          )}
          <button
            onClick={() => setShowPickList(false)}
            className="w-full text-center text-[11px] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] pt-1 transition-colors cursor-pointer"
          >
            Anuluj
          </button>
        </div>
      )}

      {/* Context bar */}
      <div className="px-4 py-1.5 border-b border-[rgb(var(--border))] bg-[rgb(var(--background))]/20 shrink-0">
        <ContextBar tracker={tracker} />
      </div>

      {/* Agent cards */}
      <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-[rgb(var(--border))]">
        {agents.length === 0 ? (
          <div className="px-6 py-12 text-center text-[11px] text-[rgb(var(--text-muted))]">
            Brak agentow. Kliknij "+ Dodaj agenta" aby dodac.
          </div>
        ) : (
          agents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              tracker={tracker}
              onSend={sendMessage}
              onRemove={removeAgent}
              onToggleCollapse={toggleCollapse}
              mentionableItems={props.mentionableItems || []}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================
// AgentCard
// ============================================================

interface AgentCardProps {
  agent: FloatingAgent;
  tracker: TrackerState;
  onSend: (agentId: string, text: string) => void;
  onRemove: (agentId: string) => void;
  onToggleCollapse: (agentId: string) => void;
  mentionableItems: MentionableItem[];
}

function AgentCard({ agent, tracker, onSend, onRemove, onToggleCollapse, mentionableItems }: AgentCardProps) {
  const [input, setInput] = useState('');
  const [showCaps, setShowCaps] = useState(false);
  const [localCaps, setLocalCaps] = useState(agent.capabilities);
  const cursorPosRef = useRef(0); // Track cursor position via onSelect event

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(agent.id, input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleCap = (cap: CapabilityCategory) => {
    setLocalCaps(prev => {
      const exists = prev.find(c => c.capability === cap);
      if (exists) {
        const nextLevel: Record<string, ApprovalLevel | null> = {
          'none': 'notify',
          'notify': 'approve',
          'approve': null,
        };
        const newLevel = nextLevel[exists.approvalLevel];
        if (newLevel === null) {
          return prev.filter(c => c.capability !== cap);
        }
        return prev.map(c => c.capability === cap ? { ...c, approvalLevel: newLevel } : c);
      } else {
        return [...prev, { capability: cap, approvalLevel: 'none' as ApprovalLevel }];
      }
    });
  };

  const capBadge = (level: ApprovalLevel | null) => {
    if (level === 'none') return 'R';
    if (level === 'notify') return 'N';
    if (level === 'approve') return 'A';
    return null;
  };

  return (
    <div className="flex flex-col">
      {/* Agent header */}
      <button
        onClick={() => onToggleCollapse(agent.id)}
        className="flex items-center justify-between px-4 py-2.5 hover:bg-[rgb(var(--background))]/20 transition-colors cursor-pointer w-full text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Bot size={14} className="shrink-0 text-[rgb(var(--text-secondary))]" />
          <span className="text-[13px] font-medium truncate">{agent.name}</span>
          {localCaps.length > 0 && (
            <span className="text-[10px] font-mono text-[rgb(var(--text-tertiary))]">
              {localCaps.filter(c => c.approvalLevel === 'none').length}R{' '}
              {localCaps.filter(c => c.approvalLevel === 'approve').length}A
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setShowCaps(!showCaps); }}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              showCaps
                ? 'bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]'
                : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--background))]'
            }`}
            title="Pozwolenia"
          >
            <Shield size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(agent.id); }}
            className="p-1.5 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--danger))] hover:bg-red-500/10 transition-colors cursor-pointer rounded-lg"
            title="Usun agenta"
          >
            <X size={12} />
          </button>
          {agent.collapsed ? <ChevronUp size={14} className="text-[rgb(var(--text-muted))]" /> : <ChevronDown size={14} className="text-[rgb(var(--text-muted))]" />}
        </div>
      </button>

      {/* Capability editor */}
      {showCaps && (
        <div className="px-4 py-2.5 border-t border-[rgb(var(--border))] bg-[rgb(var(--background))]/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-[rgb(var(--text-muted))]">Pozwolenia</span>
            <span className="text-[10px] text-[rgb(var(--text-tertiary))]">Kliknij by zmienic: R(czytaj) / N(powiadom) / A(zatwierdz)</span>
          </div>
          <div className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar">
            {ALL_CAPABILITIES.map(group => (
              <div key={group.category}>
                <div className="text-[9px] font-mono font-medium text-[rgb(var(--text-tertiary))] uppercase mb-1">{group.label}</div>
                <div className="flex flex-wrap gap-1">
                  {group.items.map(item => {
                    const cap = localCaps.find(c => c.capability === item.value);
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
        </div>
      )}

      {/* Expanded content */}
      {!agent.collapsed && (
        <div className="flex-1 flex flex-col min-h-0 px-4 pb-3 pt-2">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-2 mb-2 text-[11px] custom-scrollbar min-h-[100px]">
            {agent.messages.filter(m => m.role !== 'system').map((msg, i) => {
              const isFailover = msg.role === 'failover_proposal';
              const isRecovery = msg.role === 'recovery_proposal';

              return (
                <div
                  key={i}
                  className={`p-3 rounded-lg border transition-all ${
                    msg.role === 'user'
                      ? 'bg-[rgb(var(--accent))]/10 border-transparent ml-6'
                      : msg.role === 'approval_request' || isFailover
                      ? 'bg-amber-500/10 border-amber-500/30 mr-6'
                      : msg.role === 'action'
                      ? 'bg-emerald-500/10 border-emerald-500/30 mr-6'
                      : isRecovery
                      ? 'bg-blue-500/10 border-blue-500/30 mr-6'
                      : 'bg-[rgb(var(--background))]/50 mr-6'
                  }`}
                >
                  <div className="text-[10px] font-medium text-[rgb(var(--text-tertiary))] mb-0.5">
                    {msg.role === 'user'
                      ? 'Ty'
                      : msg.role === 'assistant'
                      ? agent.name
                      : isFailover
                      ? 'Router AI: Propozycja Failoveru'
                      : isRecovery
                      ? 'Router AI: Powrót do Darmowego'
                      : msg.role === 'approval_request'
                      ? 'Zadanie: Zatwierdź'
                      : msg.role === 'action'
                      ? 'Status'
                      : 'System'}
                  </div>
                  <div className="text-[rgb(var(--text-secondary))] leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                  {(msg.capability || isFailover || isRecovery) && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={msg.onApprove}
                        className="px-2.5 py-1 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-500/30 transition-colors cursor-pointer"
                      >
                        Zezwól
                      </button>
                      <button
                        onClick={msg.onReject || (() => {})}
                        className="px-2.5 py-1 text-[10px] font-medium bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors cursor-pointer"
                      >
                        Odrzuć
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {agent.messages.filter(m => m.role !== 'system').length === 0 && (
              <div className="text-center text-[rgb(var(--text-tertiary))] py-6 text-[11px]">
                {agent.name} gotowy. Zadaj pytanie.
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-2 relative">
            <AtMentionAutocomplete
              items={mentionableItems}
              value={input}
              onSelect={(item) => {
                // Replace @query with resolved reference using cursorPosRef
                const atIdx = input.lastIndexOf('@', cursorPosRef.current);
                if (atIdx >= 0) {
                  const before = input.slice(0, atIdx);
                  const ref = `@${item.type}:${item.label} `;
                  const newVal = before + ref;
                  setInput(newVal);
                }
                return input;
              }}
            />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Zapytaj ${agent.name}... (użyj @ aby wstrzyknąć kontekst)`}
              className="flex-1 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg px-3 py-1.5 text-[11px] text-[rgb(var(--text-main))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:border-[rgb(var(--text-secondary))] transition-colors"
              onSelect={(e) => {
                // Track cursor position for @ detection
                const target = e.target as HTMLInputElement;
                cursorPosRef.current = target.selectionStart || 0;
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-3 py-1.5 bg-[rgb(var(--accent))] text-black rounded-lg text-[11px] font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
