import React, { useEffect, useRef } from 'react';
import { useUsemeStore } from '../../renderer/store/usemeStore';

export function ExecutionControl() {
  const {
    status,
    mode,
    logs,
    startExecution,
    stopExecution,
    clearLogs,
  } = useUsemeStore();

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const isRunning = status === 'RUNNING' || status === 'AWAITING_REVIEW';

  return (
    <div className="flex flex-col h-full">
      {/* Action Bar */}
      <div className="flex items-center gap-3 p-4 border-b border-zinc-800 bg-zinc-900/50">
        <span className="text-sm font-medium text-zinc-300 mr-2">Useme Engine</span>

        <button
          onClick={() => startExecution('dry', false)}
          disabled={isRunning}
          className={`px-4 py-1.5 rounded text-xs font-medium transition-colors ${
            isRunning
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              : 'bg-emerald-700 hover:bg-emerald-600 text-emerald-100'
          }`}
        >
          Run Simulation
        </button>

        <button
          onClick={() => startExecution('prod', true)}
          disabled={isRunning}
          className={`px-4 py-1.5 rounded text-xs font-medium transition-colors ${
            isRunning
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              : 'bg-red-800 hover:bg-red-700 text-red-100'
          }`}
        >
          Execute Live Submission
        </button>

        {isRunning && (
          <button
            onClick={stopExecution}
            className="px-4 py-1.5 rounded text-xs font-medium bg-amber-800 hover:bg-amber-700 text-amber-100"
          >
            Stop
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {isRunning && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-emerald-400">
                {status === 'AWAITING_REVIEW' ? 'Awaiting Review' : 'Running'}
              </span>
            </div>
          )}
          {!isRunning && status === 'IDLE' && (
            <span className="text-xs text-zinc-500">Idle</span>
          )}
          {status === 'ERROR' && (
            <span className="text-xs text-red-400">Error</span>
          )}
        </div>

        <button
          onClick={clearLogs}
          className="px-2 py-1 rounded text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Log Viewer */}
      <div className="flex-1 overflow-y-auto bg-zinc-950 p-4">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
            <div className="text-center">
              <p className="text-lg mb-1">No logs yet</p>
              <p className="text-xs">Start a simulation or live submission to see output</p>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {logs.map((log, i) => (
              <div
                key={i}
                className={`font-mono text-xs leading-5 ${
                  log.level === 'error'
                    ? 'text-red-400'
                    : log.level === 'warn'
                    ? 'text-amber-400'
                    : 'text-zinc-400'
                }`}
              >
                <span className="text-zinc-600 mr-2">
                  {new Date(log.timestamp).toLocaleTimeString('pl-PL')}
                </span>
                {log.message}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
