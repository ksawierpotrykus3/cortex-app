import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Edit2, Plus, Trash2, MousePointerClick, GripVertical, Maximize } from "lucide-react";
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
    <div className="w-64 border-r border-[rgb(var(--border))] flex flex-col h-full bg-[rgb(var(--background))] overflow-y-auto shrink-0 custom-scrollbar z-10">
      <div className="px-5 py-4 border-b border-[rgb(var(--border))] flex items-center justify-between bg-[rgb(var(--panel))]/30">
        <span className="text-[11px] font-display font-bold tracking-wider text-[rgb(var(--text-muted))] uppercase">
          Projects
        </span>
        <div className="flex items-center gap-2">
            <button onClick={onCreateProject} className="p-1 hover:bg-[rgb(var(--border))] rounded transition-colors text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))]" title="Add Project" aria-label="Dodaj projekt">
                <Plus className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-medium text-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10 px-2 py-0.5 rounded-full ring-1 ring-[rgb(var(--accent))]/20">
              {nodes ? nodes.length : 0} nodes
            </span>
        </div>
      </div>

      <div className="flex flex-col py-3">
        {Object.entries(projects).map(([projectId, pNodes]) => {
          const isExpanded = expandedProjects[projectId] === true;
          const projectNodes = pNodes as NexusNode[];

          return (
            <div key={projectId} className="flex flex-col mb-1 relative">
              <div className="flex items-center group px-5 hover:bg-[rgb(var(--panel))] transition-colors">
                <button
                  onClick={(e) => {
                    if (e.shiftKey) return;
                    toggleProject(projectId);
                  }}
                  className="flex items-center gap-2 py-2 text-left cursor-pointer flex-1 min-w-0"
                >
                  <GripVertical className="w-3.5 h-3.5 shrink-0 text-[rgb(var(--text-muted))] cursor-grab" />
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[rgb(var(--text-muted))]" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[rgb(var(--text-muted))]" />
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
                          className="bg-[rgb(var(--background))] border border-[rgb(var(--accent))] text-[13px] font-medium text-[rgb(var(--text-main))] px-1 py-0.5 w-full focus:outline-none"
                      />
                  ) : (
                      <span 
                          className="text-[13px] font-medium text-[rgb(var(--text-main))] capitalize truncate shrink-0 select-none"
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
                      >
                        {projectId.replace(/_/g, ' ')}
                      </span>
                  )}
                </button>

                {!editingProject && (
                    <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                        <button
                           onClick={(e) => {
                               e.stopPropagation();
                               if (onProjectCenter) onProjectCenter(projectId);
                           }}
                           className="p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] cursor-pointer rounded hover:bg-[rgb(var(--border))]"
                           title="Center on canvas"
                           aria-label="Wyśrodkuj na płótnie"
                        >
                           <Maximize className="w-3 h-3" />
                        </button>
                        <button
                           onClick={(e) => {
                               e.stopPropagation();
                               if (onSelectProject) onSelectProject(projectId);
                           }}
                           className="p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] cursor-pointer rounded hover:bg-[rgb(var(--border))]"
                           title="Select Project Nodes"
                           aria-label="Zaznacz węzły projektu"
                        >
                            <MousePointerClick className="w-3 h-3" />
                        </button>
                        <button
                           onClick={(e) => {
                               e.stopPropagation();
                               if (onCreateNode) onCreateNode(projectId);
                           }}
                           className="p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] cursor-pointer rounded hover:bg-[rgb(var(--border))]"
                           title="Add Note to Project"
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
                           className="p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] cursor-pointer rounded hover:bg-[rgb(var(--border))]"
                           title="Rename Project"
                           aria-label="Zmień nazwę projektu"
                        >
                            <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                           onClick={(e) => {
                               e.stopPropagation();
                               if (onDeleteProject) onDeleteProject(projectId);
                           }}
                           className="p-1 text-red-500 hover:text-red-400 cursor-pointer rounded hover:bg-red-500/20"
                           title="Delete Project"
                           aria-label="Usuń projekt"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                )}
              </div>

              {isExpanded && (!editingProject || editingProject !== projectId) && (
                <div className="flex flex-col mt-1 relative pt-1 pb-2">
                  <div className="absolute left-[22px] top-0 bottom-0 w-px bg-[rgb(var(--border))]" />
                  
                  {projectNodes.map(node => (
                    <button
                      key={node.id}
                      onClick={() => onSelectNode?.(node.id)}
                      className={`flex items-center gap-3 pl-10 pr-5 py-1.5 w-full text-left transition-colors cursor-pointer relative group
                        ${selectedNodeId === node.id 
                            ? "text-[rgb(var(--accent))] bg-[rgb(var(--accent))]/5" 
                            : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--panel))]/50"
                        }
                      `}
                    >
                      {selectedNodeId === node.id && (
                         <div className="absolute left-[19.5px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[rgb(var(--accent))] ring-2 ring-[rgb(var(--background))]" />
                      )}
                      {selectedNodeId !== node.id && (
                         <div className="absolute left-[20.5px] top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[rgb(var(--text-muted))] transition-colors group-hover:bg-[rgb(var(--text-main))]" />
                      )}
                      
                      <span className="text-[12px] font-medium truncate">
                        {node.title || 'Untitled Node'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {Object.keys(projects).length === 0 && (
          <div className="px-5 py-6 text-xs font-medium text-[rgb(var(--text-muted))] text-center flex flex-col items-center gap-2">
            Directory is empty
            <button onClick={onCreateProject} className="text-[rgb(var(--accent))] hover:underline cursor-pointer">
                Create a project
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
