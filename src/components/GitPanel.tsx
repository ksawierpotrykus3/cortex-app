// ============================================================================
// NEXUS — GitPanel (Main Git Operations UI)
// GUI do operacji git: status, commit, push, pull, branch, merge, log
// ============================================================================

import React, { useState, useEffect, useCallback } from "react";
import {
  GitBranch, GitCommitHorizontal, ArrowUp, ArrowDown,
  GitFork, Plus, Check, X, FileCode, RefreshCw, Loader2,
} from "lucide-react";
import { GitStatusResult, GitLogEntry, GitBranchInfo } from "../shared/types/schema";
import { NexusBridge } from "../shared/types/ipc";

type Tab = 'status' | 'log' | 'branches';

export function GitPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('status');
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [log, setLog] = useState<GitLogEntry[]>([]);
  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const [commitMsg, setCommitMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [gitEnabled, setGitEnabled] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<{ pullActive: boolean; pushActive: boolean; pullIntervalMs: number; pushIntervalMs: number } | null>(null);

  useEffect(() => {
    loadGitConfig();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (gitEnabled) loadScheduleStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [gitEnabled]);

  const loadGitConfig = async () => {
    try {
      const config = await window.nexusBridge?.getGitConfig();
      setGitEnabled(config?.enabled ?? false);
    } catch {
      setGitEnabled(false);
    }
  };

  const loadScheduleStatus = async () => {
    try {
      const s = await window.nexusBridge?.getGitScheduleStatus();
      if (s) setScheduleStatus(s);
    } catch {
      // ignore
    }
  };

  const toggleSchedule = async (action: 'pull' | 'push', active: boolean) => {
    try {
      await window.nexusBridge?.toggleGitSchedule({ action, active });
      loadScheduleStatus();
    } catch (err: any) {
      setError(err.message || 'Toggle schedule failed');
    }
  };

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const [s, l, b] = await Promise.all([
        window.nexusBridge?.getGitStatus(),
        window.nexusBridge?.getGitLog({ count: 20 }),
        window.nexusBridge?.getGitBranches(),
      ]);
      if (s) setStatus(s);
      if (l) setLog(l);
      if (b) setBranches(b);
    } catch (err: any) {
      setError(err.message || 'Błąd odświeżania');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (gitEnabled) refreshAll();
  }, [gitEnabled, refreshAll]);

  const handleCommit = async () => {
    if (!commitMsg.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.nexusBridge?.gitCommit({ message: commitMsg, all: true });
      if (result?.success) {
        setSuccess('Commit udany!');
        setCommitMsg('');
        refreshAll();
      } else {
        setError(result?.error || 'Commit failed');
      }
    } catch (err: any) {
      setError(err.message || 'Commit failed');
    }
    setLoading(false);
  };

  const handlePush = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.nexusBridge?.gitPush({ branch: status?.branch });
      if (result?.success) {
        setSuccess('Push udany!');
        refreshAll();
      } else {
        setError(result?.error || 'Push failed');
      }
    } catch (err: any) {
      setError(err.message || 'Push failed');
    }
    setLoading(false);
  };

  const handlePull = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.nexusBridge?.gitPull({ branch: status?.branch });
      if (result?.success) {
        setSuccess('Pull udany!');
        refreshAll();
      } else {
        setError(result?.error || 'Pull failed');
      }
    } catch (err: any) {
      setError(err.message || 'Pull failed');
    }
    setLoading(false);
  };

  const handleSwitchBranch = async (name: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.nexusBridge?.gitSwitchBranch({ name });
      if (result?.success) {
        setSuccess(`Przełączono na ${name}`);
        refreshAll();
      } else {
        setError(result?.error || 'Switch failed');
      }
    } catch (err: any) {
      setError(err.message || 'Switch failed');
    }
    setLoading(false);
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.nexusBridge?.gitCreateBranch({ name: newBranchName, from: status?.branch });
      if (result?.success) {
        setSuccess(`Utworzono branch ${newBranchName}`);
        setNewBranchName('');
        setShowNewBranch(false);
        refreshAll();
      } else {
        setError(result?.error || 'Create branch failed');
      }
    } catch (err: any) {
      setError(err.message || 'Create branch failed');
    }
    setLoading(false);
  };

  const handleMerge = async (fromBranch: string) => {
    if (!status?.branch) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.nexusBridge?.gitMerge({ from: fromBranch, to: status.branch });
      if (result?.success) {
        setSuccess(`Merged ${fromBranch} → ${status.branch}`);
        refreshAll();
      } else {
        setError(result?.error || 'Merge failed');
      }
    } catch (err: any) {
      setError(err.message || 'Merge failed');
    }
    setLoading(false);
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  if (!gitEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
        <GitBranch className="w-12 h-12 opacity-30" />
        <p className="text-sm">Git jest wyłączony. Włącz go w Settings → Git.</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'status', label: 'Status' },
    { id: 'log', label: 'Historia' },
    { id: 'branches', label: 'Branche' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border))]">
        <div className="flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-[rgb(var(--accent))]" />
          <div>
            <h2 className="text-lg font-bold text-white">Git</h2>
            {status && (
              <p className="text-xs text-gray-500">
                {status.branch}
                {status.ahead > 0 && <span className="ml-2 text-amber-400">↑{status.ahead}</span>}
                {status.behind > 0 && <span className="ml-2 text-blue-400">↓{status.behind}</span>}
              </p>
            )}
          </div>
          {scheduleStatus && (
            <div className="flex items-center gap-2 ml-4 text-xs">
              <button
                onClick={() => toggleSchedule('pull', !scheduleStatus.pullActive)}
                disabled={!scheduleStatus.pullIntervalMs}
                className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  scheduleStatus.pullActive
                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    : 'border-[rgb(var(--border))] text-gray-500 hover:text-gray-300'
                }`}
              >
                <ArrowDown className="w-3 h-3" />
                Pull{scheduleStatus.pullActive ? ` (${Math.round(scheduleStatus.pullIntervalMs / 1000)}s)` : ''}
              </button>
              <button
                onClick={() => toggleSchedule('push', !scheduleStatus.pushActive)}
                disabled={!scheduleStatus.pushIntervalMs}
                className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  scheduleStatus.pushActive
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    : 'border-[rgb(var(--border))] text-gray-500 hover:text-gray-300'
                }`}
              >
                <ArrowUp className="w-3 h-3" />
                Push{scheduleStatus.pushActive ? ` (${Math.round(scheduleStatus.pushIntervalMs / 1000)}s)` : ''}
              </button>
            </div>
          )}
        </div>
        <button
          onClick={refreshAll}
          disabled={loading}
          className="p-2 text-gray-500 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[rgb(var(--border))] px-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'border-[rgb(var(--accent))] text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-4 mt-3 p-3 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-2">
          <X className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mx-4 mt-3 p-3 rounded-lg text-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'status' && (
          <>
            {/* Commit area */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Commit message</label>
              <textarea
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                placeholder="Opisz co zmieniłeś..."
                rows={3}
                className="w-full bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-gray-500 transition-colors resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCommit}
                  disabled={loading || !commitMsg.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-[rgb(var(--accent))] text-black hover:bg-[rgb(var(--accent))]/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <GitCommitHorizontal className="w-4 h-4" />
                  Commit & Push
                </button>
                <button
                  onClick={handlePush}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg text-sm font-medium border border-[rgb(var(--border))] text-gray-300 hover:text-white hover:border-gray-500 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={handlePull}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg text-sm font-medium border border-[rgb(var(--border))] text-gray-300 hover:text-white hover:border-gray-500 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Changed files */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Zmienione pliki ({status?.entries.length || 0})
              </h3>
              {status?.entries.length === 0 ? (
                <p className="text-sm text-gray-600">Brak zmian — repozytorium czyste.</p>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {status?.entries.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-[rgb(var(--panel))] rounded-lg text-sm">
                      <span className={`text-xs font-bold uppercase ${
                        entry.status === 'added' ? 'text-emerald-400' :
                        entry.status === 'deleted' ? 'text-red-400' :
                        entry.status === 'untracked' ? 'text-gray-500' :
                        'text-amber-400'
                      }`}>
                        {entry.status === 'untracked' ? '??' : entry.status.substring(0, 1).toUpperCase()}
                      </span>
                      <FileCode className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      <span className="text-gray-300 truncate">{entry.path}</span>
                      {entry.staged && <span className="ml-auto text-xs text-emerald-500">staged</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'log' && (
          <div className="space-y-1">
            {log.length === 0 ? (
              <p className="text-sm text-gray-600">Brak commitów w historii.</p>
            ) : (
              log.map((entry, i) => (
                <div key={i} className="flex items-start gap-3 px-3 py-2 bg-[rgb(var(--panel))] rounded-lg text-sm hover:bg-[rgb(var(--panel))]/70 transition-colors">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-[rgb(var(--accent))]" />
                    {i < log.length - 1 && <div className="w-px flex-1 bg-[rgb(var(--border))]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-200 truncate">{entry.message}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                      <span className="font-mono">{entry.hash.substring(0, 7)}</span>
                      <span>{entry.author}</span>
                      <span>{new Date(entry.date).toLocaleDateString()}</span>
                      {entry.refs && <span className="text-amber-400/60 truncate">{entry.refs}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'branches' && (
          <div className="space-y-2">
            {/* Create branch */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNewBranch(!showNewBranch)}
                className="px-3 py-2 rounded-lg text-sm font-medium border border-[rgb(var(--border))] text-gray-300 hover:text-white hover:border-gray-500 transition-colors cursor-pointer flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Nowy branch
              </button>
            </div>
            {showNewBranch && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="nazwa-brancha"
                  className="flex-1 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-gray-500 transition-colors font-mono"
                />
                <button
                  onClick={handleCreateBranch}
                  disabled={loading || !newBranchName.trim()}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-[rgb(var(--accent))] text-black hover:bg-[rgb(var(--accent))]/90 transition-colors cursor-pointer disabled:opacity-40"
                >
                  Utwórz
                </button>
              </div>
            )}

            {/* Branch list */}
            {branches.length === 0 ? (
              <p className="text-sm text-gray-600">Brak branchy.</p>
            ) : (
              branches.map((branch, i) => {
                const isCurrent = branch.current || branch.name === status?.branch;
                const isMergable = !isCurrent && status?.branch && branch.name !== status.branch;
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      isCurrent ? 'bg-[rgb(var(--accent))]/10 border border-[rgb(var(--accent))]/20' : 'bg-[rgb(var(--panel))] hover:bg-[rgb(var(--panel))]/70'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GitFork className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-[rgb(var(--accent))]' : 'text-gray-500'}`} />
                      <span className={`truncate ${isCurrent ? 'text-white font-medium' : 'text-gray-300'}`}>
                        {branch.name}
                      </span>
                      {isCurrent && <span className="text-xs text-[rgb(var(--accent))]">(current)</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!isCurrent && (
                        <>
                          <button
                            onClick={() => handleSwitchBranch(branch.name)}
                            disabled={loading}
                            className="px-2 py-1 rounded text-xs font-medium border border-[rgb(var(--border))] text-gray-400 hover:text-white hover:border-gray-500 transition-colors cursor-pointer disabled:opacity-40"
                          >
                            Switch
                          </button>
                          {isMergable && (
                            <button
                              onClick={() => handleMerge(branch.name)}
                              disabled={loading}
                              className="px-2 py-1 rounded text-xs font-medium border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer disabled:opacity-40"
                            >
                              Merge
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
