import React, { useState } from "react";
import { Pencil, Check, Trash2, Plus } from "lucide-react";
import { Task } from "../types";

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
  const [activeList, setActiveList] = useState<string>('Main to do list');

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

  const activeTasks = tasks.filter(t => (t.listId || 'Main to do list') === activeList);

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth()+1).padStart(2,"0")}.${now.getFullYear()}, ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    
    setTasks([{
      id: Math.random().toString(36).substring(2, 9),
      title: newTaskTitle,
      description: newTaskDetails,
      status: "Unresolved",
      priority: newTaskPriority,
      updatedAt: dateStr,
      listId: activeList
    }, ...tasks]);
    setNewTaskTitle("");
    setNewTaskDetails("");
  };

  const handleToggleTask = (id: string) => {
    setTasks(tasks.map(t => {
      if (t.id === id) {
        return { ...t, status: t.status === "Resolved" ? "Unresolved" : "Resolved" };
      }
      return t;
    }));
  };

  const handleDeleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const doneCount = activeTasks.filter(t => t.status === "Resolved").length;
  const todoCount = activeTasks.filter(t => t.status === "Unresolved").length;
  const inProgressCount = activeTasks.filter(t => t.status === "In Progress").length;

  return (
    <div className="flex-1 h-[calc(100vh-3.5rem)] bg-[rgb(var(--background))] flex">
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
          {localLists.map(listName => {
            const listTasks = tasks.filter(t => (t.listId || 'Main to do list') === listName);
            const listOpen = listTasks.filter(t => t.status !== 'Resolved').length;
            return (
              <div 
                key={listName}
                onClick={() => setActiveList(listName)}
                className={`group rounded-xl p-3 cursor-pointer transition-colors ${activeList === listName ? 'bg-[rgb(var(--panel))] border border-[rgb(var(--border))] shadow-sm' : 'hover:bg-[rgb(var(--panel))]/50 border border-transparent'}`}
              >
                <div className="font-medium text-[14px] text-[rgb(var(--text-main))] mb-1 truncate">
                  {listName}
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
                 <button className="px-3 py-1.5 border border-transparent rounded-lg text-[13px] font-medium text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--panel))] hover:text-[rgb(var(--text-main))] transition-colors cursor-pointer">
                   All statuses
                 </button>
                 <button className="px-3 py-1.5 border border-transparent rounded-lg text-[13px] font-medium text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--panel))] hover:text-[rgb(var(--text-main))] transition-colors cursor-pointer">
                   Priority
                 </button>
            </div>
          </div>

          {/* Quick Add */}
          <div className="relative mb-16 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-2xl p-4 shadow-sm focus-within:border-[rgb(var(--text-muted))] focus-within:shadow-md transition-all duration-300">
             <input
               type="text"
               placeholder="Task title..."
               value={newTaskTitle}
               onChange={(e) => setNewTaskTitle(e.target.value)}
               className="w-full bg-transparent text-[16px] font-medium text-[rgb(var(--text-main))] placeholder-[rgb(var(--text-muted))]/60 outline-none mb-2"
             />
             <textarea
               placeholder="Add details... (⌘ + Enter to save)"
               value={newTaskDetails}
               onChange={(e) => setNewTaskDetails(e.target.value)}
               onKeyDown={(e) => {
                  if (e.key === "Enter" && e.metaKey) {
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
                     onChange={(e) => setNewTaskPriority(e.target.value as any)}
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
                      title={task.title}
                      description={task.description}
                      status={task.status}
                      priority={task.priority}
                      date={task.updatedAt}
                      onToggle={() => handleToggleTask(task.id)}
                      onDelete={() => handleDeleteTask(task.id)}
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
                      title={task.title}
                      description={task.description}
                      status={task.status}
                      priority={task.priority}
                      date={task.updatedAt}
                      onToggle={() => handleToggleTask(task.id)}
                      onDelete={() => handleDeleteTask(task.id)}
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
                      title={task.title}
                      description={task.description}
                      status={task.status}
                      priority={task.priority}
                      date={task.updatedAt}
                      accent="green"
                      collapsed={true}
                      onToggle={() => handleToggleTask(task.id)}
                      onDelete={() => handleDeleteTask(task.id)}
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
  title: string;
  description?: string;
  status: string;
  priority?: string;
  date: string;
  accent?: "green";
  collapsed?: boolean;
  onToggle: () => void;
  onDelete: () => void;
}> = ({
  title,
  description,
  status,
  priority,
  date,
  accent,
  collapsed,
  onToggle,
  onDelete
}) => {
  return (
    <div
      className={`group rounded-2xl bg-[rgb(var(--panel))] p-5 flex flex-col relative transition-colors ${accent === "green" ? "opacity-60 bg-transparent border border-[rgb(var(--border))]/50" : "border border-transparent hover:border-[rgb(var(--border))] hover:bg-[rgb(var(--panel))]/30"}`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className={`font-medium text-[16px] text-[rgb(var(--text-main))] ${accent === "green" ? "line-through text-[rgb(var(--text-muted))]" : ""}`}>{title}</h3>
        <div className="flex gap-2">
          {priority && (
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-medium tracking-wide ${priority === "Critical" ? "text-red-400 bg-red-400/10" : priority === "Medium" ? "text-orange-400 bg-orange-400/10" : "text-[rgb(var(--text-muted))] bg-[rgb(var(--border))]/50"}`}
            >
              {priority}
            </span>
          )}
        </div>
      </div>

      {!collapsed && description && (
        <div className="text-[14px] text-[rgb(var(--text-main))] whitespace-pre-wrap leading-relaxed mb-4">
          {description}
        </div>
      )}

      <div
        className={`flex items-center justify-between text-[12px] text-[rgb(var(--text-muted))] ${collapsed ? "" : "mt-2 pt-3 border-t border-[rgb(var(--border))]/50"}`}
      >
        <span>{date}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!collapsed && (
              <button className="p-1.5 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] rounded-md hover:bg-[rgb(var(--border))] transition-colors cursor-pointer">
                <Pencil className="w-3.5 h-3.5" />
              </button>
          )}
          <button onClick={onDelete} className="p-1.5 text-[rgb(var(--text-muted))] hover:text-red-400 rounded-md hover:bg-red-400/10 transition-colors cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onToggle} className={`ml-2 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${status === "Resolved" ? "border border-[rgb(var(--border))] text-[rgb(var(--text-main))] hover:bg-[rgb(var(--panel))]" : "bg-[rgb(var(--text-main))] text-[rgb(var(--background))] hover:bg-[rgb(var(--text-muted))]"}`}>
            {status === "Resolved" ? "Revert" : "Resolve"}
          </button>
        </div>
      </div>
    </div>
  );
}
