import React, { useEffect } from 'react';
import { useUsemeStore } from '../../renderer/store/usemeStore';
import { ExecutionControl } from './ExecutionControl';
import { ReviewQueueModal } from './ReviewQueueModal';
import { PromptRepository } from './PromptRepository';
import { Terminal, BookOpen } from 'lucide-react';

export function UsemeContainer() {
  const { activeTab, setActiveTab, addLog, addReview } = useUsemeStore();

  // Listen for IPC events from main process
  useEffect(() => {
    const bridge = (window as any).nexusBridge;
    if (!bridge) return;

    const cleanupLog = bridge.onUsemeLog((data: { level: string; message: string; timestamp: string }) => {
      addLog({
        level: data.level as 'info' | 'warn' | 'error',
        message: data.message,
        timestamp: data.timestamp || new Date().toISOString(),
      });
    });

    const cleanupReview = bridge.onUsemeReviewRequired((data: { jobId: string; jobTitle: string; price: string; proposal: string; auditReport: string }) => {
      addReview({
        jobId: data.jobId,
        jobTitle: data.jobTitle,
        price: data.price,
        proposal: data.proposal,
        auditReport: data.auditReport,
      });
    });

    return () => {
      cleanupLog?.();
      cleanupReview?.();
    };
  }, [addLog, addReview]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 border-t border-zinc-800">
      {/* Sub-navigation */}
      <div className="flex items-center border-b border-zinc-800 bg-zinc-900/80 px-4">
        <button
          onClick={() => setActiveTab('execution')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'execution'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Terminal size={14} />
          Execution
        </button>
        <button
          onClick={() => setActiveTab('repository')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'repository'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <BookOpen size={14} />
          Prompt Repository
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'execution' ? <ExecutionControl /> : <PromptRepository />}
      </div>

      {/* Review Modal (overlay) */}
      <ReviewQueueModal />
    </div>
  );
}
