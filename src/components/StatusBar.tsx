// ============================================================================
// NEXUS — StatusBar (bottom bar)
// Wyświetla: aktualny widok, licznik encji, status FS, git branch
// ============================================================================

import React from "react";
import {
  CircleDot, HardDrive, GitBranch, Activity,
} from "lucide-react";
import { ViewMode } from "../types";

interface StatusBarProps {
  activeView: ViewMode;
  nodeCount: number;
  taskCount: number;
  fsConnected: boolean;
  gitBranch?: string | null;
}

export function StatusBar({
  activeView,
  nodeCount,
  taskCount,
  fsConnected,
  gitBranch,
}: StatusBarProps) {
  const viewLabels: Record<ViewMode, string> = {
    nexus: "Topology",
    "lab-todo": "Laboratory",
    "lab-writing": "Writing",
    sandbox: "Baza Wiedzy",
    "raw-fragments": "Raw Fragments",
    logs: "Agent Logs",
    draft: "RLHF Draft",
    agents: "Agenci",
    changes: "Zmiany",
    wiki: "Wiki",
    git: "Git",
    pipeline: "Pipeline",
    workflows: "Workflows",
  };

  return (
    <div className="h-7 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-canvas))] flex items-center justify-between px-4 shrink-0 select-none">
      {/* Left: view name + counters */}
      <div className="flex items-center gap-4 text-[11px]">
        <div className="flex items-center gap-1.5 text-[rgb(var(--text-main))] font-medium">
          <Activity className="w-3 h-3" />
          <span>{viewLabels[activeView] || activeView}</span>
        </div>

        <div className="w-px h-3 bg-[rgb(var(--border))]" />

        <span className="text-[rgb(var(--text-secondary))]">
          Notatki: <span className="text-[rgb(var(--text-main))]">{nodeCount}</span>
        </span>

        <span className="text-[rgb(var(--text-secondary))]">
          Taski: <span className="text-[rgb(var(--text-main))]">{taskCount}</span>
        </span>
      </div>

      {/* Right: status indicators */}
      <div className="flex items-center gap-4 text-[11px]">
        {/* FS status */}
        <div className="flex items-center gap-1.5">
          <HardDrive className={`w-3 h-3 ${fsConnected ? 'text-[rgb(var(--success))]' : 'text-[rgb(var(--text-tertiary))]'}`} />
          <span className={fsConnected ? 'text-[rgb(var(--text-secondary))]' : 'text-[rgb(var(--text-tertiary))]'}>
            {fsConnected ? "FS OK" : "FS disconnected"}
          </span>
        </div>

        {/* Git branch */}
        {gitBranch && (
          <>
            <div className="w-px h-3 bg-[rgb(var(--border))]" />
            <div className="flex items-center gap-1.5 text-[rgb(var(--text-secondary))]">
              <GitBranch className="w-3 h-3" />
              <span>{gitBranch}</span>
            </div>
          </>
        )}

        {/* App version / status dot */}
        <div className="w-px h-3 bg-[rgb(var(--border))]" />
        <div className="flex items-center gap-1.5 text-[rgb(var(--text-tertiary))]">
          <CircleDot className="w-3 h-3 text-[rgb(var(--success))]" />
          <span>Nexus v1.0</span>
        </div>
      </div>
    </div>
  );
}
