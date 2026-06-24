import React, { useState, useMemo } from "react";
import { ChevronRight, Edit2, Plus, Trash2, MousePointerClick, GripVertical, Maximize, FolderOpen, Folder } from "lucide-react";
import { NexusNode } from "../types";

export function LeftSidebar({
  nodes,
  selectedNodeId,
  onSelectNode,
  expandedProjects,
  toggleProject,
  onRenameProject,
  onDeleteProject,
  onCreateProject,
  onCreateNode,
  onSelectProject,
  onProjectDragStart,
  onProjectCenter
}: {
  nodes?: NexusNode[];
  selectedNodeId?: string | null;
  onSelectNode?: (id: string) => void;
  expandedProjects: Record<string, boolean>;
  toggleProject: (pid: string) => void;
  onRenameProject?: (oldName: string, newName: string) => void;
  onDeleteProject?: (name: string) => void;
  onCreateProject?: () => void;
  onCreateNode?: (projectId: string) => void;
  onSelectProject?: (projectId: string) => void;
  onProjectDragStart?: (projectId: string) => void;
  onProjectCenter?: (projectId: string) => void;
}) {
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const projects = useMemo<Record<string, NexusNode[]>>(() => {
    const groups: Record<string, NexusNode[]> = {};
    if (nodes) {
      nodes.forEach(n => {
        const pid = n.projectId || 'Uncategorized';
        if (!groups[pid]) groups[pid] = [];
        groups[pid].push(n);
      });
    }
    return groups;
  }, [nodes]);

  return (
    <div className="w-64 border-r border-[rgb(var(--border))]/40 flex flex-col h-full bg-[rgb(var(--panel))]/30 backdrop-blur-xl shrink-0 custom-scrollbar z-10 select-none">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[rgb(var(--border))]/40 flex items-center justify-between">
        <span className="text-[11px] font-display font-bold tracking-widest text-[rgb(var(--text-muted))] uppercase">
          Projekty
        </span>
        <div className="flex items-center gap-2.5">
          <button 
            onClick={onCreateProject} 
            className="p-1.5 hover:bg-[rgb(var(--accent))]/10 hover:text-[rgb(var(--accent))] rounded-lg transition-all duration-200 text-[rgb(var(--text-muted))] cursor-pointer" 
            title="Dodaj projekt" 
            aria-label="Dodaj projekt"
          >
            <Plus className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-semibold text-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10 border border-[rgb(var(--accent))]/20 px-2 py-0.5 rounded-md">
            {nodes ? nodes.length : 0} węzłów
          </span>
        </div>
      </div>

      {/* Projects List */}
      <div className="flex flex-col py-3 overflow-y-auto flex-1 custom-scrollbar">
        {Object.entries(projects).map(([projectId, pNodes]) => {
          const isExpanded = expandedProjects[projectId] === true;
          const projectNodes = pNodes as NexusNode[];

          return (
            <div 
              key={projectId} 
              className={`flex flex-col mx-3 my-1.5 rounded-xl border transition-all duration-300 ${
                isExpanded 
                  ? "bg-[rgb(var(--panel))]/50 border-[rgb(var(--border))]/50 shadow-sm" 
                  : "bg-transparent border-transparent hover:bg-[rgb(var(--panel))]/30 hover:border-[rgb(var(--border))]/30"
              }`}
            >
              {/* Project Title Bar */}
              <div className="flex items-center group px-3 py-2 justify-between">
                <button
                  onClick={(e) => {
                    if (e.shiftKey) return;
                    toggleProject(projectId);
                  }}
                  className="flex items-center gap-2 text-left cursor-pointer flex-1 min-w-0"
                >
                  <GripVertical 
                    className="w-3.5 h-3.5 shrink-0 text-[rgb(var(--text-muted))] opacity-0 group-hover:opacity-60 cursor-grab active:cursor-grabbing hover:text-[rgb(var(--text-main))] transition-opacity" 
                    onPointerDown={(e) => {
                      if (onProjectDragStart) {
                        e.preventDefault();
                        e.stopPropagation();
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                        onProjectDragStart(projectId);
                      }
                    }}
                    onPointerUp={(e) => {
                      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                    }}
                  />
                  <ChevronRight className={`w-3.5 h-3.5 shrink-0 text-[rgb(var(--text-muted))] transition-transform duration-300 ${isExpanded ? 'rotate-90 text-[rgb(var(--accent))]' : ''}`} />
                  
                  {isExpanded ? (
                    <FolderOpen className="w-3.5 h-3.5 shrink-0 text-[rgb(var(--accent))]" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 shrink-0 text-[rgb(var(--text-muted))]" />
                  )}

                  {editingProject === projectId ? (
                    <input 
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => {
                        if (onRenameProject && editValue.trim() && editValue !== projectId) {
                          onRenameProject(projectId, editValue);
                        }
                        setEditingProject(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="bg-[rgb(var(--background))] border border-[rgb(var(--accent))] text-[12px] font-semibold text-[rgb(var(--text-main))] px-1.5 py-0.5 rounded w-full focus:outline-none"
                    />
                  ) : (
                    <span className="text-[12px] font-semibold text-[rgb(var(--text-main))] capitalize truncate shrink-0 select-none">
                      {projectId.replace(/_/g, ' ')}
                    </span>
                  )}
                </button>

                {/* Hover Action Buttons */}
                {!editingProject && (
                  <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 gap-0.5 ml-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onProjectCenter) onProjectCenter(projectId);
                      }}
                      className="p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--background))] cursor-pointer rounded-md transition-all"
                      title="Centruj widok"
                      aria-label="Wyśrodkuj na płótnie"
                    >
                      <Maximize className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectProject) onSelectProject(projectId);
                      }}
                      className="p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--background))] cursor-pointer rounded-md transition-all"
                      title="Zaznacz węzły"
                      aria-label="Zaznacz węzły projektu"
                    >
                      <MousePointerClick className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onCreateNode) onCreateNode(projectId);
                      }}
                      className="p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--background))] cursor-pointer rounded-md transition-all"
                      title="Dodaj notatkę"
                      aria-label="Dodaj notatkę do projektu"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditValue(projectId);
                        setEditingProject(projectId);
                      }}
                      className="p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--background))] cursor-pointer rounded-md transition-all"
                      title="Zmień nazwę"
                      aria-label="Zmień nazwę projektu"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDeleteProject) onDeleteProject(projectId);
                      }}
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer rounded-md transition-all"
                      title="Usuń projekt"
                      aria-label="Usuń projekt"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Expandable Inner Nodes List */}
              {isExpanded && (!editingProject || editingProject !== projectId) && (
                <div className="flex flex-col pb-2.5 relative">
                  {/* Subtle fade tree line */}
                  <div className="absolute left-[20px] top-0 bottom-3 w-px bg-gradient-to-b from-[rgb(var(--border))]/40 to-transparent" />
                  
                  {projectNodes.map(node => {
                    const isSelected = selectedNodeId === node.id;
                    return (
                      <button
                        key={node.id}
                        onClick={() => onSelectNode?.(node.id)}
                        className={`flex items-center gap-2.5 pl-8 pr-4 py-1.5 w-full text-left transition-all duration-200 cursor-pointer relative group/item
                          ${isSelected 
                            ? "text-[rgb(var(--accent))] bg-[rgb(var(--accent))]/5 font-semibold" 
                            : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--panel))]/20"
                          }
                        `}
                      >
                        {/* Custom indicator bullet with shadow glow when active */}
                        {isSelected ? (
                          <div className="absolute left-[17.5px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[rgb(var(--accent))] shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
                        ) : (
                          <div className="absolute left-[18.5px] top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[rgb(var(--text-muted))]/40 transition-colors group-hover/item:bg-[rgb(var(--text-main))]" />
                        )}
                        
                        <span className="text-[11.5px] truncate">
                          {node.title || 'Bez tytułu'}
                        </span>
                      </button>
                    );
                  })}
                  
                  {projectNodes.length === 0 && (
                    <div className="pl-8 text-[10px] text-[rgb(var(--text-muted))] italic py-1">
                      Brak węzłów
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {Object.keys(projects).length === 0 && (
          <div className="mx-4 my-6 p-6 rounded-2xl border border-dashed border-[rgb(var(--border))]/60 bg-[rgb(var(--panel))]/10 text-center flex flex-col items-center gap-3">
            <Folder className="w-8 h-8 text-[rgb(var(--text-muted))]/30" />
            <div className="text-xs font-semibold text-[rgb(var(--text-muted))]">
              Brak projektów
            </div>
            <button 
              onClick={onCreateProject} 
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-[rgb(var(--accent))]/80 to-[rgb(var(--accent))] hover:opacity-90 shadow-md text-black transition-all cursor-pointer"
            >
              Utwórz projekt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
