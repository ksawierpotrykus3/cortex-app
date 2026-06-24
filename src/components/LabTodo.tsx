import React, { useState, useMemo, useEffect } from "react";
import { Pencil, Trash2, Plus, Download } from "lucide-react";
import { Task, ThoughtMarker, NexusAnnotation } from "../types";
import { generateAIExport, downloadFile, generateExportFilename, getExportPreset, TaskExport } from "../exportEngine";
import { uid } from "../utils/ids";
import { HistoryButton } from "./HistoryButton";
import { useDiffStore } from "../renderer/store/diffStore";

export function LabTodo({
  setLabView,
  tasks,
  setTasks
}: {
  setLabView: (v: "todo" | "writing") => void;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
}) {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDetails, setNewTaskDetails] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"Critical"|"Medium"|"Low">("Medium");

  const existingLists = Array.from(new Set(tasks.map(t => t.listId || 'Main to do list')));
  if (!existingLists.includes('Main to do list')) existingLists.unshift('Main to do list');

  const [localLists, setLocalLists] = useState<string[]>(existingLists);
  
  const [activeList, setActiveList] = useState<string>(
    () => localStorage.getItem('nexus_last_tasklist') || 'Main to do list'
  );
  
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  useEffect(() => {
    localStorage.setItem('nexus_last_tasklist', activeList);
  }, [activeList]);

  // Sync new lists
  useEffect(() => {
    setLocalLists(prev => {
      const merged = Array.from(new Set([...prev, ...existingLists]));
      return merged;
    });
  }, [tasks]);

  const sortedLists = useMemo(() => {
    return [...localLists].sort((a, b) => {
      const aTasks = tasks.filter(t => (t.listId || 'Main to do list') === a);
      const bTasks = tasks.filter(t => (t.listId || 'Main to do list') === b);
      const aMax = Math.max(0, ...aTasks.map(t => {
        const time = new Date(t.updatedAt || '').getTime();
        return isNaN(time) ? 0 : time;
      }));
      const bMax = Math.max(0, ...bTasks.map(t => {
        const time = new Date(t.updatedAt || '').getTime();
        return isNaN(time) ? 0 : time;
      }));
      return bMax - aMax;
    });
  }, [localLists, tasks]);

  const handleAddList = () => {
    let num = localLists.length + 1;
    let name = `New List ${num}`;
    while (localLists.includes(name)) {
      num++;
      name = `New List ${num}`;
    }
    setLocalLists([...localLists, name]);
    setActiveList(name);
  };

  const allActiveTasks = tasks.filter(t => (t.listId || 'Main to do list') === activeList);
  const activeTasks = allActiveTasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    
    setTasks([{
      id: uid(),
      title: newTaskTitle,
      description: newTaskDetails,
      status: "Unresolved",
      priority: newTaskPriority,
      updatedAt: new Date().toISOString(),
      listId: activeList,
      annotations: [],
      thoughtMarkers: []
    }, ...tasks]);
    setNewTaskTitle("");
    setNewTaskDetails("");
  };

  const handleToggleTask = (id: string) => {
    setTasks(tasks.map(t => {
      if (t.id === id) {
        return { 
          ...t, 
          status: t.status === "Resolved" ? "Unresolved" : "Resolved",
          updatedAt: new Date().toISOString()
        };
      }
      return t;
    }));
  };

  const handleDeleteTask = (id: string) => {
    // Snapshot before deleting task
    const task = tasks.find(t => t.id === id);
    if (task) {
      useDiffStore.getState().snapshotBeforeEdit(id, 'task', task.description || '', task.title);
    }
    setTasks(tasks.filter(t => t.id !== id));
  };

  const doneCount = activeTasks.filter(t => t.status === "Resolved").length;
  const todoCount = activeTasks.filter(t => t.status === "Unresolved").length;
  const inProgressCount = activeTasks.filter(t => t.status === "In Progress").length;

  return (
    <div className="flex-1 h-full bg-[rgb(var(--background))] flex">
      {/* Sidebar Focus */}
      <div className="w-[280px] border-r border-[rgb(var(--border))]/50 flex flex-col bg-[rgb(var(--panel))]/30 shrink-0">
        <div className="p-6 pb-2 border-b border-[rgb(var(--border))]/50">
          <div className="flex bg-[rgb(var(--background))] rounded-lg p-1 border border-[rgb(var(--border))] mb-8">
            <button className="flex-1 py-1.5 bg-[rgb(var(--panel))] rounded-md shadow-sm border border-[rgb(var(--border))] text-[13px] font-medium text-[rgb(var(--text-main))] cursor-default">
              Tasks
            </button>
            <button
              onClick={() => setLabView("writing")}
              className="flex-1 py-1.5 rounded-md text-[13px] font-medium text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] transition-colors cursor-pointer"
            >
              Writing
            </button>
          </div>
          
          <h2 className="text-[18px] font-medium text-[rgb(var(--text-main))] tracking-tight">Active Lists</h2>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
          {sortedLists.map(listName => {
            const listTasks = tasks.filter(t => (t.listId || 'Main to do list') === listName);
            const listOpen = listTasks.filter(t => t.status !== 'Resolved').length;
            return (
              <div 
                key={listName}
                onClick={() => setActiveList(listName)}
                className={`group/list rounded-xl p-3 cursor-pointer transition-colors ${activeList === listName ? 'bg-[rgb(var(--panel))] border border-[rgb(var(--border))] shadow-sm' : 'hover:bg-[rgb(var(--panel))]/50 border border-transparent'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-[14px] text-[rgb(var(--text-main))] mb-1 truncate">
                    {listName}
                  </div>
                  {listName !== 'Main to do list' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Usunąć "${listName}" i wszystkie taski?`)) {
                          setTasks(tasks.filter(t => (t.listId || 'Main to do list') !== listName));
                          setLocalLists(prev => prev.filter(l => l !== listName));
                          if (activeList === listName) setActiveList('Main to do list');
                        }
                      }}
                      className="p-1 text-[rgb(var(--text-muted))] hover:text-red-400 rounded hover:bg-red-400/10 transition-colors opacity-0 group-hover/list:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="text-[12px] text-[rgb(var(--text-muted))]">
                  {listTasks.length} tasks &bull; {listOpen} open
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-[rgb(var(--border))]/50">
          <button onClick={handleAddList} className="w-full py-2.5 rounded-xl text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--panel))] text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors">
            <Plus className="w-4 h-4" /> New List
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center py-12 px-8 custom-scrollbar">
        <div className="w-full max-w-[680px]">
          
          <div className="mb-12 flex justify-between items-start border-b border-[rgb(var(--border))]/50 pb-6">
            <div className="flex-1 mr-4">
                 <input 
                   value={activeList}
                   onChange={(e) => {
                     const updated = e.target.value;
                     setLocalLists(localLists.map(l => l === activeList ? updated : l));
                     setTasks(tasks.map(t => (t.listId || 'Main to do list') === activeList ? { ...t, listId: updated } : t));
                     setActiveList(updated);
                   }}
                   className="text-[32px] font-serif text-[rgb(var(--text-main))] mb-2 tracking-tight bg-transparent border-none outline-none w-full"
                 />
                 <div className="text-[14px] text-[rgb(var(--text-muted))]">
                 {todoCount} unresolved &bull; {inProgressCount} in progress &bull; {activeTasks.length} total
                 </div>
            </div>
             <div className="flex gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-1.5 border border-[rgb(var(--border))] rounded-lg text-[13px] font-medium text-[rgb(var(--text-main))] bg-[rgb(var(--background))] outline-none cursor-pointer"
                  >
                    <option value="all">All statuses</option>
                    <option value="Unresolved">Unresolved</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="px-3 py-1.5 border border-[rgb(var(--border))] rounded-lg text-[13px] font-medium text-[rgb(var(--text-main))] bg-[rgb(var(--background))] outline-none cursor-pointer"
                  >
                    <option value="all">All priorities</option>
                    <option value="Critical">Critical</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                  <button
                    onClick={() => {
                      const exportTasks: TaskExport[] = activeTasks.map(t => ({
                        id: t.id,
                        title: t.title,
                        description: t.description,
                        priority: t.priority,
                        status: t.status,
                      }));
                      const preset = getExportPreset("lab-todo");
                      const data = generateAIExport([], [], "", preset.scope, exportTasks);
                      downloadFile(data, generateExportFilename(preset.label));
                    }}
                    className="px-3 py-1.5 border border-[rgb(var(--border))] rounded-lg text-[13px] font-medium text-[rgb(var(--text-main))] bg-[rgb(var(--background))] hover:bg-[rgb(var(--panel))] transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Eksportuj zadania (Ctrl+Shift+E)"
                  >
                    <Download className="w-3.5 h-3.5 text-[rgb(var(--accent))]" />
                    Export
                  </button>
             </div>
          </div>

          {/* Quick Add */}
          <div className="relative mb-16 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-2xl p-4 shadow-sm focus-within:border-[rgb(var(--text-muted))] focus-within:shadow-md transition-all duration-300">
             <input
               type="text"
               placeholder="Task title... (Enter to save)"
               value={newTaskTitle}
               onChange={(e) => setNewTaskTitle(e.target.value)}
               onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTask();
                  }
               }}
               className="w-full bg-transparent text-[16px] font-medium text-[rgb(var(--text-main))] placeholder-[rgb(var(--text-muted))]/60 outline-none mb-2"
             />
             <textarea
               placeholder="Add details... (Enter to save, Shift+Enter for new line)"
               value={newTaskDetails}
               onChange={(e) => setNewTaskDetails(e.target.value)}
               onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAddTask();
                  }
               }}
               className="w-full bg-transparent text-[14px] leading-relaxed text-[rgb(var(--text-main))] placeholder-[rgb(var(--text-muted))]/40 resize-none outline-none min-h-[60px]"
             />
             <div className="flex justify-between items-center mt-2 pt-3 border-t border-[rgb(var(--border))]/50">
                 <div className="flex items-center gap-3">
                    <select 
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as 'Low' | 'Medium' | 'Critical')}
                      className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] text-[12px] text-[rgb(var(--text-main))] px-2 py-1 rounded-md outline-none cursor-pointer"
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>Critical</option>
                    </select>
                 </div>
                 <button 
                   onClick={handleAddTask} 
                   disabled={!newTaskTitle.trim()}
                   className={`px-5 py-2 rounded-full text-[13px] font-medium transition-all ${newTaskTitle.trim() ? "bg-[rgb(var(--text-main))] text-[rgb(var(--background))] hover:bg-[rgb(var(--text-muted))] cursor-pointer shadow-sm" : "bg-[rgb(var(--border))] text-[rgb(var(--text-muted))] opacity-50 cursor-not-allowed"}`}
                 >
                   Create Task
                 </button>
             </div>
          </div>

          {/* Task Items */}
          <div className="space-y-10">
              <div>
                <h2 className="text-[12px] font-medium text-[rgb(var(--text-muted))] uppercase tracking-wider mb-4 px-2">Unresolved ({todoCount})</h2>
                <div className="space-y-4">
                  {activeTasks.filter(t => t.status === "Unresolved").map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggle={() => handleToggleTask(task.id)}
                      onDelete={() => handleDeleteTask(task.id)}
                      onEdit={(updates) => {
                        // Snapshot before editing
                        useDiffStore.getState().snapshotBeforeEdit(task.id, 'task', task.description || '', task.title);
                        setTasks(tasks.map(t => t.id === task.id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t));
                      }}
                      onAddAnnotation={(category, content) => {
                        const newAnn: NexusAnnotation = {
                          id: uid(),
                          category,
                          content,
                          author: 'user',
                          timestamp: new Date().toISOString()
                        };
                        setTasks(tasks.map(t => t.id === task.id ? { ...t, annotations: [...(t.annotations || []), newAnn] } : t));
                      }}
                      onDeleteAnnotation={(annId) => {
                        setTasks(tasks.map(t => t.id === task.id ? { ...t, annotations: (t.annotations || []).filter(a => a.id !== annId) } : t));
                      }}
                      onToggleMarker={(marker) => {
                        setTasks(tasks.map(t => {
                          if (t.id === task.id) {
                            const current = t.thoughtMarkers || [];
                            const next = current.includes(marker) ? current.filter(m => m !== marker) : [...current, marker];
                            return { ...t, thoughtMarkers: next };
                          }
                          return t;
                        }));
                      }}
                    />
                  ))}
                  {todoCount === 0 && <div className="text-[14px] text-[rgb(var(--text-muted))] italic px-2">No unresolved tasks.</div>}
                </div>
              </div>

              <div>
                <h2 className="text-[12px] font-medium text-[rgb(var(--text-muted))] uppercase tracking-wider mb-4 px-2">In Progress ({inProgressCount})</h2>
                <div className="space-y-4">
                  {activeTasks.filter(t => t.status === "In Progress").map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggle={() => handleToggleTask(task.id)}
                      onDelete={() => handleDeleteTask(task.id)}
                      onEdit={(updates) => {
                        setTasks(tasks.map(t => t.id === task.id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t));
                      }}
                      onAddAnnotation={(category, content) => {
                        const newAnn: NexusAnnotation = {
                          id: uid(),
                          category,
                          content,
                          author: 'user',
                          timestamp: new Date().toISOString()
                        };
                        setTasks(tasks.map(t => t.id === task.id ? { ...t, annotations: [...(t.annotations || []), newAnn] } : t));
                      }}
                      onDeleteAnnotation={(annId) => {
                        setTasks(tasks.map(t => t.id === task.id ? { ...t, annotations: (t.annotations || []).filter(a => a.id !== annId) } : t));
                      }}
                      onToggleMarker={(marker) => {
                        setTasks(tasks.map(t => {
                          if (t.id === task.id) {
                            const current = t.thoughtMarkers || [];
                            const next = current.includes(marker) ? current.filter(m => m !== marker) : [...current, marker];
                            return { ...t, thoughtMarkers: next };
                          }
                          return t;
                        }));
                      }}
                    />
                  ))}
                  {inProgressCount === 0 && <div className="text-[14px] text-[rgb(var(--text-muted))] italic px-2">No tasks in progress.</div>}
                </div>
              </div>

              <div>
                <h2 className="text-[12px] font-medium text-[rgb(var(--text-muted))] uppercase tracking-wider mb-4 px-2">Resolved ({doneCount})</h2>
                <div className="space-y-4">
                  {activeTasks.filter(t => t.status === "Resolved").map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      accent="green"
                      collapsed={true}
                      onToggle={() => handleToggleTask(task.id)}
                      onDelete={() => handleDeleteTask(task.id)}
                      onEdit={(updates) => {
                        setTasks(tasks.map(t => t.id === task.id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t));
                      }}
                      onAddAnnotation={(category, content) => {
                        const newAnn: NexusAnnotation = {
                          id: uid(),
                          category,
                          content,
                          author: 'user',
                          timestamp: new Date().toISOString()
                        };
                        setTasks(tasks.map(t => t.id === task.id ? { ...t, annotations: [...(t.annotations || []), newAnn] } : t));
                      }}
                      onDeleteAnnotation={(annId) => {
                        setTasks(tasks.map(t => t.id === task.id ? { ...t, annotations: (t.annotations || []).filter(a => a.id !== annId) } : t));
                      }}
                      onToggleMarker={(marker) => {
                        setTasks(tasks.map(t => {
                          if (t.id === task.id) {
                            const current = t.thoughtMarkers || [];
                            const next = current.includes(marker) ? current.filter(m => m !== marker) : [...current, marker];
                            return { ...t, thoughtMarkers: next };
                          }
                          return t;
                        }));
                      }}
                    />
                  ))}
                  {doneCount === 0 && <div className="text-[14px] text-[rgb(var(--text-muted))] italic px-2">No resolved tasks.</div>}
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const TaskCard: React.FC<{
  task: Task;
  accent?: "green";
  collapsed?: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit?: (updates: { title: string; description: string; priority: "Low" | "Medium" | "Critical" }) => void;
  onAddAnnotation: (category: 'comment' | 'raw-fragment' | 'issue', content: string) => void;
  onDeleteAnnotation: (annId: string) => void;
  onToggleMarker: (marker: ThoughtMarker) => void;
}> = ({
  task,
  accent,
  collapsed,
  onToggle,
  onDelete,
  onEdit,
  onAddAnnotation,
  onDeleteAnnotation,
  onToggleMarker
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDesc, setEditDesc] = useState(task.description || "");
  const [editPriority, setEditPriority] = useState<string>(task.priority || "Medium");

  // Annotation Editor state
  const [activeAnnotationEditor, setActiveAnnotationEditor] = useState<string | null>(null);
  const [newAnnotationCategory, setNewAnnotationCategory] = useState<'comment' | 'raw-fragment' | 'issue'>('comment');
  const [newAnnotationText, setNewAnnotationText] = useState("");

  // Thought Marker dropdown state
  const [activeMarkerDropdown, setActiveMarkerDropdown] = useState<string | null>(null);

  const handleSave = () => {
    setIsEditing(false);
    if (onEdit && (editTitle !== task.title || editDesc !== (task.description || "") || editPriority !== task.priority)) {
      onEdit({ title: editTitle, description: editDesc, priority: editPriority as "Low" | "Medium" | "Critical" });
    }
  };

  const getDisplayDate = (dStr?: string) => {
    if (!dStr) return '';
    const t = new Date(dStr).getTime();
    if (isNaN(t)) return dStr;
    return new Date(dStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const displayDate = getDisplayDate(task.updatedAt);

  return (
    <div
      className={`group rounded-2xl bg-[rgb(var(--panel))] p-5 flex flex-col relative transition-colors ${accent === "green" ? "opacity-60 bg-transparent border border-[rgb(var(--border))]/50" : "border border-transparent hover:border-[rgb(var(--border))] hover:bg-[rgb(var(--panel))]/30"}`}
    >
      <div className="flex items-start justify-between mb-2">
        {isEditing ? (
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setIsEditing(false); }}
            className="font-medium text-[16px] text-[rgb(var(--text-main))] bg-[rgb(var(--background))] border border-[rgb(var(--accent))] rounded px-2 py-1 outline-none flex-1 mr-2"
          />
        ) : (
          <div className="flex items-center gap-2 max-w-[80%]">
            <h3 className={`font-medium text-[16px] text-[rgb(var(--text-main))] truncate ${accent === "green" ? "line-through text-[rgb(var(--text-muted))]" : ""}`}>
              {task.title}
            </h3>
            {/* Thought Marker Circles */}
            {task.thoughtMarkers && task.thoughtMarkers.length > 0 && (
              <div className="flex gap-1 shrink-0">
                {task.thoughtMarkers.map(m => (
                  <div 
                    key={m} 
                    title={`Thought status: ${m}`}
                    className={`w-1.5 h-1.5 rounded-full ${
                      m === 'certain' ? 'bg-orange-400' : 
                      m === 'hypothesis' ? 'bg-purple-400' : 
                      m === 'question' ? 'bg-blue-400' : 'bg-green-400'
                    }`} 
                  />
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex gap-2">
          {isEditing ? (
            <select
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value)}
              className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] text-[11px] text-[rgb(var(--text-main))] px-2 py-0.5 rounded outline-none cursor-pointer"
            >
              <option>Low</option>
              <option>Medium</option>
              <option>Critical</option>
            </select>
          ) : task.priority && (
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-medium tracking-wide ${task.priority === "Critical" ? "text-red-400 bg-red-400/10" : task.priority === "Medium" ? "text-orange-400 bg-orange-400/10" : "text-[rgb(var(--text-muted))] bg-[rgb(var(--border))]/50"}`}
            >
              {task.priority}
            </span>
          )}
        </div>
      </div>

      {isEditing ? (
        <textarea
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          onBlur={handleSave}
          className="text-[14px] text-[rgb(var(--text-main))] bg-[rgb(var(--background))] border border-[rgb(var(--accent))] rounded-lg p-2 outline-none resize-none min-h-[60px] mb-4"
        />
      ) : !collapsed && task.description && (
        <div className="text-[14px] text-[rgb(var(--text-main))] whitespace-pre-wrap leading-relaxed mb-4">
          {task.description}
        </div>
      )}

      {/* Render annotations and badges */}
      {task.annotations && task.annotations.length > 0 && (
        <div className="mt-2 space-y-1 mb-3">
          <div className="flex gap-1.5 select-none">
             {(task.annotations.filter(a => a.category === 'comment').length > 0) && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[rgb(var(--border))] text-[rgb(var(--text-muted))]">
                  [N] {task.annotations.filter(a => a.category === 'comment').length}
                </span>
             )}
             {(task.annotations.filter(a => a.category === 'raw-fragment').length > 0) && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-orange-500/30 text-orange-400 bg-orange-500/10">
                  [F] {task.annotations.filter(a => a.category === 'raw-fragment').length}
                </span>
             )}
             {(task.annotations.filter(a => a.category === 'issue').length > 0) && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-red-500/30 text-red-400 bg-red-500/10">
                  [I] {task.annotations.filter(a => a.category === 'issue').length}
                </span>
             )}
          </div>
          <div className="pl-2 border-l border-[rgb(var(--border))]/50 space-y-1 mt-1 text-xs">
            {task.annotations.map(ann => (
              <div key={ann.id} className="flex justify-between items-center text-[12px] text-[rgb(var(--text-muted))] group/ann">
                <span>
                  <strong className={
                    ann.category === 'comment' ? 'text-[rgb(var(--text-muted))]' :
                    ann.category === 'raw-fragment' ? 'text-orange-400' : 'text-red-400'
                  }>
                    [{ann.category === 'comment' ? 'N' : ann.category === 'raw-fragment' ? 'F' : 'I'}]
                  </strong> {ann.content}
                </span>
                <button
                  onClick={() => onDeleteAnnotation(ann.id)}
                  className="text-red-400 opacity-0 group-hover/ann:opacity-100 transition-opacity ml-2 hover:text-red-300 cursor-pointer"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className={`flex items-center justify-between text-[12px] text-[rgb(var(--text-muted))] ${collapsed ? "" : "mt-2 pt-3 border-t border-[rgb(var(--border))]/50"}`}
      >
        <span>{displayDate}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity select-none">
          {/* Thought Marker Trigger */}
          <div className="relative">
            <button
              onClick={() => setActiveMarkerDropdown(activeMarkerDropdown === task.id ? null : task.id)}
              className="p-1.5 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] rounded-md hover:bg-[rgb(var(--border))] transition-colors cursor-pointer"
              title="Stan myśli"
            >
              <div className="w-3.5 h-3.5 rounded-full border border-dashed border-[rgb(var(--text-muted))] flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--text-muted))]" />
              </div>
            </button>
            {activeMarkerDropdown === task.id && (
              <div className="absolute right-0 bottom-8 mt-1 w-32 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg shadow-xl py-1 z-30">
                {(['certain', 'hypothesis', 'question', 'answer'] as ThoughtMarker[]).map(marker => {
                  const hasMarker = task.thoughtMarkers?.includes(marker);
                  return (
                    <button
                      key={marker}
                      onClick={() => {
                        onToggleMarker(marker);
                        setActiveMarkerDropdown(null);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-[rgb(var(--border))] flex items-center gap-2 text-[rgb(var(--text-main))] cursor-pointer"
                    >
                      <div className={`w-2 h-2 rounded-full ${
                        marker === 'certain' ? 'bg-orange-400' :
                        marker === 'hypothesis' ? 'bg-purple-400' :
                        marker === 'question' ? 'bg-blue-400' : 'bg-green-400'
                      }`} />
                      <span className="capitalize">{marker}</span>
                      {hasMarker && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[rgb(var(--accent))]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Annotation Button */}
          <div className="relative">
            <button
              onClick={() => setActiveAnnotationEditor(activeAnnotationEditor === task.id ? null : task.id)}
              className="p-1.5 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] rounded-md hover:bg-[rgb(var(--border))] transition-colors cursor-pointer"
              title="Add annotation"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            {activeAnnotationEditor === task.id && (
              <div className="absolute right-0 bottom-8 mt-1 w-64 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg shadow-xl p-3 z-30 text-left animate-in fade-in-50 duration-200">
                <select
                  value={newAnnotationCategory}
                  onChange={(e) => setNewAnnotationCategory(e.target.value as any)}
                  className="w-full bg-[rgb(var(--background))] border border-[rgb(var(--border))] text-xs text-[rgb(var(--text-main))] p-1 rounded mb-2 outline-none cursor-pointer"
                >
                  <option value="comment">Comment</option>
                  <option value="raw-fragment">Raw Fragment</option>
                  <option value="issue">Issue</option>
                </select>
                <textarea
                  placeholder="Annotation content..."
                  value={newAnnotationText}
                  onChange={(e) => setNewAnnotationText(e.target.value)}
                  className="w-full bg-[rgb(var(--background))] border border-[rgb(var(--border))] text-xs text-[rgb(var(--text-main))] p-2 rounded mb-2 outline-none resize-none h-16"
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={() => {
                      setActiveAnnotationEditor(null);
                      setNewAnnotationText("");
                    }}
                    className="px-2 py-1 text-[10px] uppercase font-bold text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (newAnnotationText.trim()) {
                        onAddAnnotation(newAnnotationCategory, newAnnotationText);
                        setNewAnnotationText("");
                        setActiveAnnotationEditor(null);
                      }
                    }}
                    className="px-2 py-1 text-[10px] uppercase font-bold bg-[rgb(var(--accent))] text-white rounded hover:bg-[rgb(var(--accent))]/80 cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>

          {!collapsed && (
              <button 
                onClick={() => { setIsEditing(true); setEditTitle(task.title); setEditDesc(task.description || ""); setEditPriority(task.priority || "Medium"); }}
                className="p-1.5 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] rounded-md hover:bg-[rgb(var(--border))] transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
          )}

          {/* #5: History button */}
          <HistoryButton
            entityId={task.id}
            entityType="task"
            title={task.title}
            content={task.description || ''}
          />

          <button onClick={onDelete} className="p-1.5 text-[rgb(var(--text-muted))] hover:text-red-400 rounded-md hover:bg-red-400/10 transition-colors cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onToggle} className={`ml-2 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${task.status === "Resolved" ? "border border-[rgb(var(--border))] text-[rgb(var(--text-main))] hover:bg-[rgb(var(--panel))]" : "bg-[rgb(var(--text-main))] text-[rgb(var(--background))] hover:bg-[rgb(var(--text-muted))]"}`}>
            {task.status === "Resolved" ? "Revert" : "Resolve"}
          </button>
        </div>
      </div>
    </div>
  );
}
