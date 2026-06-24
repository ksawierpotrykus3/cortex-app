import React, { useState, useRef, useEffect } from "react";
import { Download, Settings, PanelLeft, ScrollText, PenSquare, Bot, History, BookOpen, GitBranch, Network, Workflow, Shield, Tags, ChevronDown, MessageSquareMore } from "lucide-react";
import { ViewMode, RightPanelState, ModalState } from "../types";

export function TopNavigation({
  activeView,
  setActiveView,
  rightPanel,
  setRightPanel,
  setModal,
  isSidebarOpen,
  setIsSidebarOpen,
  onOpenTagDialog,
}: {
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;
  rightPanel: RightPanelState;
  setRightPanel: (panel: RightPanelState) => void;
  setModal: (modal: ModalState) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  onOpenTagDialog?: () => void;
}) {
  return (
    <div className="h-14 border-b border-[rgb(var(--border))] bg-[rgb(var(--panel))] flex items-center justify-between px-6 shrink-0 z-50 shadow-sm">
      <div className="flex items-center gap-6 h-full">
        <div className="flex items-center gap-3">
          {activeView === "nexus" && (
            <button
               onClick={() => setIsSidebarOpen(!isSidebarOpen)}
               aria-label={isSidebarOpen ? "Zwiń panel boczny" : "Rozwiń panel boczny"}
               className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${isSidebarOpen ? 'bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--background))]'}`}
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}
          <div className="text-[15px] font-bold tracking-wide text-[rgb(var(--text-main))] flex items-center gap-2.5 select-none">
            <div className="w-2.5 h-2.5 rounded shadow-[0_0_10px_rgba(45,212,191,0.5)] bg-[rgb(var(--accent))]" />
            NEXUS
          </div>
        </div>

        <div className="w-px h-6 bg-[rgb(var(--border))] mx-1" />

        {/* Core navigation — always visible */}
        <div className="flex gap-2 h-14">
          <button
            onClick={() => setActiveView("nexus")}
            className={`px-3 text-[13px] font-medium transition-colors border-b-2 cursor-pointer ${
              activeView === "nexus"
                ? "text-[rgb(var(--accent))] border-[rgb(var(--accent))]"
                : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] border-transparent"
            }`}
          >
            Topology
          </button>
          <button
            onClick={() => setActiveView("lab-todo")}
            className={`px-3 text-[13px] font-medium transition-colors border-b-2 cursor-pointer ${
              activeView.startsWith("lab")
                ? "text-[rgb(var(--accent))] border-[rgb(var(--accent))]"
                : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] border-transparent"
            }`}
          >
            Laboratory
          </button>
          <button
            onClick={() => setActiveView("sandbox")}
            className={`px-3 text-[13px] font-medium transition-colors border-b-2 cursor-pointer flex items-center gap-1 ${
              activeView === "sandbox"
                ? "text-[rgb(var(--accent))] border-[rgb(var(--accent))]"
                : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] border-transparent"
            }`}
          >
            Knowledge Base
          </button>

          <div className="w-px h-6 bg-[rgb(var(--border))] mx-1" />
          <NavGroup label="More" activeView={activeView} setActiveView={setActiveView} />
        </div>
      </div>

      <div className="flex items-center gap-3">

        <div className="flex items-center gap-1">
            {onOpenTagDialog && (
              <button
                onClick={onOpenTagDialog}
                aria-label="Taguj notatki"
                className="p-2 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--background))] transition-colors cursor-pointer rounded-lg"
                title="Taguj notatki"
              >
                <Tags className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={() => setModal("settings")}
              aria-label="Ustawienia"
              className="p-2 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--background))] transition-colors cursor-pointer rounded-lg"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
               onClick={() => setModal("export")}
               className="p-2 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--background))] transition-colors cursor-pointer rounded-lg"
            >
               <Download className="w-4 h-4" />
            </button>
        </div>
        
        <div className="w-px h-6 bg-[rgb(var(--border))] ml-1" />
        
        {/* KillSwitch button — only icon, full banner in App.tsx */}
        <KillSwitchTopButton />
      </div>
    </div>
  );
}

/** Dropdown group for secondary navigation items — reduces top bar clutter */
function NavGroup({ label, activeView, setActiveView }: { label: string; activeView: ViewMode; setActiveView: (v: ViewMode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const subViews: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'logs', label: 'Agent Logs', icon: <ScrollText className="w-3.5 h-3.5" /> },
    { id: 'raw-fragments', label: 'Raw Fragments', icon: <PenSquare className="w-3.5 h-3.5" /> },
    { id: 'draft', label: 'RLHF Draft', icon: <PenSquare className="w-3.5 h-3.5" /> },
    { id: 'mermaid-plan', label: 'Diagram (Mermaid)', icon: <Workflow className="w-3.5 h-3.5" /> },
    { id: 'changes', label: 'Changes', icon: <History className="w-3.5 h-3.5" /> },
    { id: 'wiki', label: 'Wiki', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'git', label: 'Git', icon: <GitBranch className="w-3.5 h-3.5" /> },
    { id: 'feedback', label: 'Feedback', icon: <MessageSquareMore className="w-3.5 h-3.5" /> },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`px-3 text-[13px] font-medium transition-colors border-b-2 cursor-pointer flex items-center gap-1 ${
          subViews.some(v => activeView === v.id)
            ? 'text-[rgb(var(--accent))] border-[rgb(var(--accent))]'
            : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] border-transparent'
        }`}
      >
        {label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg shadow-xl z-50 py-1">
          {subViews.map(v => (
            <button
              key={v.id}
              onClick={() => { setActiveView(v.id); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-4 py-2 text-[13px] transition-colors cursor-pointer ${
                activeView === v.id
                  ? 'text-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10'
                  : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--background))]'
              }`}
            >
              {v.icon}
              {v.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Mini KillSwitch button for TopNavigation — always visible icon */
function KillSwitchTopButton() {
  const [active, setActive] = React.useState(false);
  const [hasProcesses, setHasProcesses] = React.useState(false);

  React.useEffect(() => {
    const check = async () => {
      try {
        const bridge = (window as any).nexusBridge as any;
        if (bridge?.getKillSwitchStatus) {
          const status = await bridge.getKillSwitchStatus();
          setActive(status.active);
          setHasProcesses(status.activeAgents > 0 || status.activePipelines > 0 || status.activeWorkflows > 0);
        }
      } catch (e) { console.warn('[KillSwitch] Failed to check status', e); }
    };
    check();
    const interval = setInterval(() => {
      // Pause polling when window is not visible to save resources
      if (!document.hidden) check();
    }, 3000);

    const onVisibilityChange = () => {
      if (!document.hidden) check();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const toggle = async () => {
    try {
      const bridge = (window as any).nexusBridge as any;
      if (active) {
        await bridge.deactivateKillSwitch();
        setActive(false);
      } else {
        await bridge.activateKillSwitch({ reason: 'Kill from TopNav' });
        setActive(true);
      }
    } catch (e) { console.warn('[KillSwitch] Failed to toggle', e); }
  };

  return (
    <button
      onClick={toggle}
      aria-label={active ? "Dezaktywuj Kill Switch" : hasProcesses ? "Zatrzymaj wszystkie procesy" : "Kill Switch (awaryjne zatrzymanie)"}
      className={`p-2 rounded-lg transition-all cursor-pointer ${
        active
          ? 'text-red-400 bg-red-500/20 animate-pulse'
          : hasProcesses
            ? 'text-amber-400'
            : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--background))]'
      }`}
      title={active ? 'Kill Switch active — deactivate' : hasProcesses ? 'Stop all processes' : 'Kill Switch (emergency stop)'}
    >
      <Shield size={16} />
    </button>
  );
}
