import React from "react";
import { Download, Settings, FileText, PanelLeft, ScrollText, PenSquare, Bot, History, BookOpen, GitBranch, Network, Workflow, Shield, Sparkles, Tags } from "lucide-react";
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
            Baza Wiedzy
          </button>
          <button
            onClick={() => setActiveView("raw-fragments")}
            className={`px-3 text-[13px] font-medium transition-colors border-b-2 cursor-pointer flex items-center gap-1 ${
              activeView === "raw-fragments"
                ? "text-orange-400 border-orange-400"
                : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] border-transparent"
            }`}
          >
            Raw Fragments
          </button>
          <div className="w-px h-6 bg-[rgb(var(--border))] mx-1" />
          <button
            onClick={() => setActiveView("agents")}
            className={`px-3 text-[13px] font-medium transition-colors border-b-2 cursor-pointer flex items-center gap-1 ${
              activeView === "agents"
                ? "text-violet-400 border-violet-400"
                : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] border-transparent"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            Agenci
          </button>
          <div className="w-px h-6 bg-[rgb(var(--border))] mx-1" />
          <button
            onClick={() => setActiveView("logs")}
            className={`px-3 text-[13px] font-medium transition-colors border-b-2 cursor-pointer flex items-center gap-1 ${
              activeView === "logs"
                ? "text-cyan-400 border-cyan-400"
                : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] border-transparent"
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" />
            Agent Logs
          </button>
          <button
            onClick={() => setActiveView("draft")}
            className={`px-3 text-[13px] font-medium transition-colors border-b-2 cursor-pointer flex items-center gap-1 ${
              activeView === "draft"
                ? "text-emerald-400 border-emerald-400"
                : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] border-transparent"
            }`}
          >
            <PenSquare className="w-3.5 h-3.5" />
            RLHF Draft
          </button>
          <button
            onClick={() => setActiveView("changes")}
            className={`px-3 text-[13px] font-medium transition-colors border-b-2 cursor-pointer flex items-center gap-1 ${
              activeView === "changes"
                ? "text-amber-400 border-amber-400"
                : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] border-transparent"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Zmiany
          </button>
          <button
            onClick={() => setActiveView("wiki")}
            className={`px-3 text-[13px] font-medium transition-colors border-b-2 cursor-pointer flex items-center gap-1 ${
              activeView === "wiki"
                ? "text-emerald-400 border-emerald-400"
                : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] border-transparent"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Wiki
          </button>
          <button
            onClick={() => setActiveView("pipeline")}
            className={`px-3 text-[13px] font-medium transition-colors border-b-2 cursor-pointer flex items-center gap-1 ${
              activeView === "pipeline"
                ? "text-purple-400 border-purple-400"
                : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] border-transparent"
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            Pipeline
          </button>
          <button
            onClick={() => setActiveView("workflows")}
            className={`px-3 text-[13px] font-medium transition-colors border-b-2 cursor-pointer flex items-center gap-1 ${
              activeView === "workflows"
                ? "text-orange-400 border-orange-400"
                : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] border-transparent"
            }`}
          >
            <Workflow className="w-3.5 h-3.5" />
            Workflows
          </button>
          <button
            onClick={() => setActiveView("git")}
            className={`px-3 text-[13px] font-medium transition-colors border-b-2 cursor-pointer flex items-center gap-1 ${
              activeView === "git"
                ? "text-orange-400 border-orange-400"
                : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] border-transparent"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Git
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">

        <div className="flex items-center gap-1">
            {onOpenTagDialog && (
              <button
                onClick={onOpenTagDialog}
                className="p-2 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--background))] transition-colors cursor-pointer rounded-lg"
                title="Taguj notatki"
              >
                <Tags className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={() => setModal("settings")}
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

        {/* Semantic Search trigger — wysyła custom event do SemanticSearch */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('nx:toggle-search', { detail: {} }))}
          className="p-2 text-[rgb(var(--text-muted))] hover:text-purple-400 hover:bg-[rgb(var(--background))] transition-colors cursor-pointer rounded-lg"
          title="Szukaj AI (Ctrl+Shift+F)"
        >
          <Sparkles size={16} />
        </button>

        <div className="w-px h-6 bg-[rgb(var(--border))]" />

        <button
          onClick={() => setRightPanel(rightPanel === "axioms" ? "none" : "axioms")}
           className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${rightPanel === "axioms" ? "bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))] border border-[rgb(var(--accent))]/20" : "bg-[rgb(var(--background))] border border-[rgb(var(--border))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:border-[rgb(var(--text-muted))]"}`}
        >
          <FileText className="w-4 h-4" />
          Axioms
        </button>
      </div>
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
      } catch {}
    };
    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
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
    } catch {}
  };

  return (
    <button
      onClick={toggle}
      className={`p-2 rounded-lg transition-all cursor-pointer ${
        active
          ? 'text-red-400 bg-red-500/20 animate-pulse'
          : hasProcesses
            ? 'text-amber-400'
            : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--background))]'
      }`}
      title={active ? 'Kill Switch aktywny — dezaktywuj' : hasProcesses ? 'Zatrzymaj wszystkie procesy' : 'Kill Switch (emergency stop)'}
    >
      <Shield size={16} />
    </button>
  );
}
