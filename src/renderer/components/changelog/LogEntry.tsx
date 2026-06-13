// ============================================================================
// NEXUS — Log Entry (Phase 1)
// Pojedynczy wpis w changelogu: streamowanie, finalny output, approve/reject
// ============================================================================

import React, { useRef, useEffect, useState } from 'react';
import { ThumbsUp, ThumbsDown, Copy, CheckCircle, AlertCircle, Bot, X, Check } from 'lucide-react';
import { ChangelogEntry, AgentStatus } from '../../../shared/types/schema';
import { useChangelogStore } from '../../store/changelogStore';

// === Status Icons ==========================================================
const statusIcon: Record<string, React.ReactNode> = {
  [AgentStatus.RUNNING]: <Bot className="w-3 h-3 text-blue-400" />,
  [AgentStatus.CRASHED]: <AlertCircle className="w-3 h-3 text-red-400" />,
  [AgentStatus.ACTIVE]: <CheckCircle className="w-3 h-3 text-green-400" />,
};

// === Props =================================================================
interface LogEntryProps {
  entry: ChangelogEntry;
}

// === Component =============================================================
export function LogEntry({ entry }: LogEntryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { approveEntry, rejectEntry, removeEntry } = useChangelogStore();
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Auto-scroll podczas streamowania
  useEffect(() => {
    if (entry.isStreaming) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entry.streamedContent, entry.isStreaming]);

  const displayContent = entry.output?.content || entry.streamedContent || '';
  const isError = entry.output?.status === AgentStatus.CRASHED || !!entry.output?.error;
  const isComplete = !entry.isStreaming;
  const isApproved = entry.output?.approved === true;
  const isRejected = entry.output?.approved === false;

  const handleCopy = () => {
    if (displayContent) {
      navigator.clipboard.writeText(displayContent);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1200);
    }
  };

  return (
    <div className={`group border-b border-[rgb(var(--border))]/30 transition-colors ${
      isError ? 'bg-red-500/5' : isApproved ? 'bg-green-500/5' : ''
    }`}>
      {/* Header */}
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {/* Agent color dot */}
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.agentColor || '#a78bfa' }}
          />
          {/* Agent name */}
          <span className="text-[12px] font-medium text-[rgb(var(--text))] truncate">
            {entry.agentName}
          </span>
          {/* Status icon */}
          {entry.output?.status && statusIcon[entry.output.status]}
          {entry.isStreaming && (
            <span className="text-[10px] text-blue-400 animate-pulse">Streamuje...</span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Copy with feedback */}
          {displayContent && (
            <button
              onClick={handleCopy}
              className={`p-1 rounded transition-colors cursor-pointer ${
                copyFeedback
                  ? 'text-green-400 bg-green-400/10'
                  : 'text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--border))]/50'
              }`}
              title={copyFeedback ? 'Skopiowano!' : 'Kopiuj'}
            >
              {copyFeedback ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
          {/* Approve */}
          {isComplete && !isApproved && !isRejected && (
            <button
              onClick={() => approveEntry(entry.id)}
              className="p-1 rounded text-green-400/50 hover:text-green-400 hover:bg-green-400/10 transition-colors cursor-pointer"
              title="Zatwierdź"
            >
              <ThumbsUp className="w-3 h-3" />
            </button>
          )}
          {/* Reject */}
          {isComplete && !isApproved && !isRejected && (
            <button
              onClick={() => rejectEntry(entry.id)}
              className="p-1 rounded text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
              title="Odrzuć"
            >
              <ThumbsDown className="w-3 h-3" />
            </button>
          )}
          {/* Remove */}
          <button
            onClick={() => removeEntry(entry.id)}
            className="p-1 rounded text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--border))]/50 transition-colors cursor-pointer"
            title="Usuń"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Timestamp */}
      <div className="px-4 pb-1">
        <span className="text-[9px] text-[rgb(var(--text-secondary))] opacity-50">
          {new Date(entry.createdAt).toLocaleTimeString('pl-PL')}
          {entry.output?.executionMs && ` · ${entry.output.executionMs}ms`}
          {entry.output?.tokensUsed && ` · ${entry.output.tokensUsed} tokenów`}
        </span>
      </div>

      {/* Content */}
      {displayContent && (
        <div className="px-4 pb-2">
          <pre className="text-[11px] leading-relaxed text-[rgb(var(--text))] font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto custom-scrollbar">
            {displayContent}
            {entry.isStreaming && <span className="animate-pulse text-[rgb(var(--accent))]">▍</span>}
          </pre>
        </div>
      )}

      {/* Error */}
      {isError && entry.output?.error && (
        <div className="px-4 pb-2">
          <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-[11px] text-red-400 font-mono">
            {entry.output.error}
          </div>
        </div>
      )}

      {/* Approved/Rejected badge */}
      <div className="px-4 pb-2 flex items-center gap-2">
        {isApproved && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] bg-green-500/10 text-green-400">
            <ThumbsUp className="w-2.5 h-2.5" />
            Zatwierdzono
          </span>
        )}
        {isRejected && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] bg-red-500/10 text-red-400">
            <ThumbsDown className="w-2.5 h-2.5" />
            Odrzucono
          </span>
        )}
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
