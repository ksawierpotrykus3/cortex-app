import React from "react";
import { Activity, Download, Settings, FileText, PanelLeft, ScrollText, PenSquare, Bot } from "lucide-react";
import { ViewMode, RightPanelState, ModalState } from "../types";

export function TopNavigation({
  activeView,
  setActiveView,
  rightPanel,
  setRightPanel,
  setModal,
  isSidebarOpen,
  setIsSidebarOpen,
  fsConnected,
  hasStoredFS,
  onConnectFS,
}: {
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;
  rightPanel: RightPanelState;
  setRightPanel: (panel: RightPanelState) => void;
  setModal: (modal: ModalState) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  fsConnected?: boolean;
  hasStoredFS?: boolean;
  onConnectFS?: () => void;
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
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-3">

        <div className="flex items-center gap-1">
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
