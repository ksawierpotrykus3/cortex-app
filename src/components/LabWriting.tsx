import React, { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, Edit3, Download, ChevronDown, ChevronRight, Folder, FolderPlus } from "lucide-react";
import { WritingDraft, ManuscriptFolder, ManuscriptTab, SourceReference, ManuscriptMeta, ThoughtMarker, NexusAnnotation } from "../types";
import { generateAIExport, downloadFile, generateExportFilename, getExportPreset, DraftExport } from "../exportEngine";
import { uid } from "../utils/ids";
import { HistoryButton } from "./HistoryButton";
import { useDiffStore } from "../renderer/store/diffStore";

export function LabWriting({
  setLabView,
  drafts,
  setDrafts,
  manuscriptFolders,
  setManuscriptFolders,
  manuscriptTabs,
  setManuscriptTabs,
  manuscriptMetas,
  setManuscriptMetas
}: {
  setLabView: (v: "todo" | "writing") => void;
  drafts: WritingDraft[];
  setDrafts: React.Dispatch<React.SetStateAction<WritingDraft[]>>;
  manuscriptFolders: ManuscriptFolder[];
  setManuscriptFolders: React.Dispatch<React.SetStateAction<ManuscriptFolder[]>>;
  manuscriptTabs: ManuscriptTab[];
  setManuscriptTabs: React.Dispatch<React.SetStateAction<ManuscriptTab[]>>;
  manuscriptMetas: ManuscriptMeta[];
  setManuscriptMetas: React.Dispatch<React.SetStateAction<ManuscriptMeta[]>>;
}) {
  const [newNote, setNewNote] = useState("");
  
  const existingProjectIds = Array.from(new Set(drafts.map(d => d.manuscriptId || 'Main writing project')));
  if (!existingProjectIds.includes('Main writing project')) existingProjectIds.unshift('Main writing project');

  const [localManuscripts, setLocalManuscripts] = useState<string[]>(existingProjectIds);
  
  const [activeManuscript, setActiveManuscript] = useState<string>(
    () => localStorage.getItem('nexus_last_manuscript') || 'Main writing project'
  );

  const [activeTabId, setActiveTabId] = useState<string>('default');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [tempFolderMapping, setTempFolderMapping] = useState<Record<string, string>>({});
  
  // Folder Renaming State
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");

  // Text Selection and Branching State
  const [selectedText, setSelectedText] = useState("");
  const [selectionCoords, setSelectionCoords] = useState<{ x: number, y: number } | null>(null);
  const [showBranchModal, setShowBranchModal] = useState(false);

  useEffect(() => {
    localStorage.setItem('nexus_last_manuscript', activeManuscript);
    // Reset active tab on manuscript change
    setActiveTabId('default');
  }, [activeManuscript]);

  // Merge newly added manuscripts from drafts load
  useEffect(() => {
    setLocalManuscripts(prev => {
      const merged = Array.from(new Set([...prev, ...existingProjectIds]));
      return merged;
    });
  }, [drafts]);

  const sortedManuscripts = useMemo(() => {
    return [...localManuscripts].sort((a, b) => {
      const aDrafts = drafts.filter(d => (d.manuscriptId || 'Main writing project') === a);
      const bDrafts = drafts.filter(d => (d.manuscriptId || 'Main writing project') === b);
      const aMax = Math.max(0, ...aDrafts.map(d => {
        const time = new Date(d.updatedAt || '').getTime();
        return isNaN(time) ? 0 : time;
      }));
      const bMax = Math.max(0, ...bDrafts.map(d => {
        const time = new Date(d.updatedAt || '').getTime();
        return isNaN(time) ? 0 : time;
      }));
      return bMax - aMax;
    });
  }, [localManuscripts, drafts]);

  const getManuscriptFolderId = (mName: string) => {
    const d = drafts.find(d => (d.manuscriptId || 'Main writing project') === mName && d.folderId);
    return d ? d.folderId : tempFolderMapping[mName];
  };

  const handleAssignFolder = (mName: string, folderId: string | undefined) => {
    setDrafts(prev => prev.map(d => (d.manuscriptId || 'Main writing project') === mName ? { ...d, folderId } : d));
    if (folderId) {
      setTempFolderMapping(prev => ({ ...prev, [mName]: folderId }));
    } else {
      setTempFolderMapping(prev => {
        const copy = { ...prev };
        delete copy[mName];
        return copy;
      });
    }
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const wordsCount = newNote.trim().split(/\s+/).length;
    const folderId = getManuscriptFolderId(activeManuscript);

    setDrafts([{
      id: uid(),
      content: newNote,
      words: wordsCount,
      updatedAt: new Date().toISOString(),
      manuscriptId: activeManuscript,
      tabId: activeTabId === 'default' ? undefined : activeTabId,
      folderId: folderId,
      replyTo: replyingTo || undefined
    }, ...drafts]);
    setNewNote("");
    setReplyingTo(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleAddNote();
    }
  };

  const handleDeleteDraft = (id: string) => {
    // Snapshot before deleting draft
    const draft = drafts.find(d => d.id === id);
    if (draft) {
      useDiffStore.getState().snapshotBeforeEdit(id, 'manuscript', draft.content, draft.content.slice(0, 80));
    }
    // Also delete any replies recursively
    const idsToDelete = new Set<string>([id]);
    let checkMore = true;
    while (checkMore) {
      const beforeCount = idsToDelete.size;
      drafts.forEach(d => {
        if (d.replyTo && idsToDelete.has(d.replyTo)) {
          idsToDelete.add(d.id);
        }
      });
      if (idsToDelete.size === beforeCount) checkMore = false;
    }
    setDrafts(drafts.filter(d => !idsToDelete.has(d.id)));
  };

  const activeDrafts = drafts.filter(d => 
    (d.manuscriptId || 'Main writing project') === activeManuscript &&
    (d.tabId || 'default') === activeTabId
  );
  
  const totalWords = activeDrafts.reduce((sum, curr) => sum + curr.words, 0);

  const handleAddManuscript = () => {
    let nameNum = localManuscripts.length + 1;
    let newName = `New Manuscript ${nameNum}`;
    while (localManuscripts.includes(newName)) {
      nameNum++;
      newName = `New Manuscript ${nameNum}`;
    }
    setLocalManuscripts([...localManuscripts, newName]);
    setActiveManuscript(newName);
  };

  const updateMeta = (mId: string, updates: Partial<ManuscriptMeta>) => {
    setManuscriptMetas(prev => {
      const exists = prev.find(m => m.manuscriptId === mId);
      if (exists) {
        return prev.map(m => m.manuscriptId === mId ? { ...m, ...updates } : m);
      } else {
        return [...prev, { manuscriptId: mId, ...updates }];
      }
    });
  };

  const currentMeta = manuscriptMetas.find(m => m.manuscriptId === activeManuscript);

  const handleTextSelection = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : "";
    if (text && text.length > 0) {
      setSelectedText(text);
      setSelectionCoords({ x: e.clientX, y: e.clientY - 40 });
    } else {
      setSelectedText("");
      setSelectionCoords(null);
    }
  };

  const renderManuscriptItem = (title: string) => {
    const mDrafts = drafts.filter(d => (d.manuscriptId || 'Main writing project') === title);
    const mWords = mDrafts.reduce((sum, curr) => sum + curr.words, 0);
    return (
      <div 
        key={title}
        onClick={() => setActiveManuscript(title)}
        className={`group/ms rounded-xl p-3 cursor-pointer transition-colors border ${activeManuscript === title ? "bg-[rgb(var(--panel))] border-[rgb(var(--border))] shadow-sm" : "hover:bg-[rgb(var(--panel))]/50 border-transparent"}`}
      >
        <div className="flex items-center justify-between">
          <div className="font-medium text-[14px] text-[rgb(var(--text-main))] mb-1 truncate">
            {title}
          </div>
          {title !== 'Main writing project' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Usunąć "${title}" i wszystkie wpisy?`)) {
                  setDrafts(drafts.filter(d => (d.manuscriptId || 'Main writing project') !== title));
                  setLocalManuscripts(prev => prev.filter(m => m !== title));
                  if (activeManuscript === title) setActiveManuscript('Main writing project');
                }
              }}
              className="p-1 text-[rgb(var(--text-muted))] hover:text-red-400 rounded hover:bg-red-400/10 transition-colors opacity-0 group-hover/ms:opacity-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="text-[12px] text-[rgb(var(--text-muted))]">
          {mDrafts.length} entries &bull; {mWords} words
        </div>
      </div>
    );
  };

  const renderNoteAndReplies = (draft: WritingDraft, depth = 0): React.ReactNode => {
    const children = activeDrafts.filter(d => d.replyTo === draft.id);
    return (
      <div key={draft.id} className="flex flex-col">
        <div 
          style={{ marginLeft: `${Math.min(depth * 2, 6)}rem` }} 
          className={depth > 0 ? "border-l-2 border-[rgb(var(--border))]/50 pl-6 relative mb-2 mt-2" : "mb-2"}
        >
          {depth > 0 && (
            <div className="absolute left-0 top-6 w-4 h-px bg-[rgb(var(--border))]/50" />
          )}
          <NoteEntry 
            draft={draft}
            onDelete={() => handleDeleteDraft(draft.id)}
            onEdit={(newContent) => {
              const newWords = newContent.trim().split(/\s+/).length;
              // Snapshot before editing
              useDiffStore.getState().snapshotBeforeEdit(draft.id, 'manuscript', draft.content, draft.content.slice(0, 80));
              setDrafts(drafts.map(d => d.id === draft.id ? { ...d, content: newContent, words: newWords, updatedAt: new Date().toISOString() } : d));
            }}
            onReply={() => setReplyingTo(draft.id)}
            onAddAnnotation={(category, content) => {
              const newAnn: NexusAnnotation = {
                id: uid(),
                category,
                content,
                author: 'user',
                timestamp: new Date().toISOString()
              };
              setDrafts(drafts.map(d => d.id === draft.id ? { ...d, annotations: [...(d.annotations || []), newAnn] } : d));
            }}
            onDeleteAnnotation={(annId) => {
              setDrafts(drafts.map(d => d.id === draft.id ? { ...d, annotations: (d.annotations || []).filter(a => a.id !== annId) } : d));
            }}
            onToggleMarker={(marker) => {
              setDrafts(drafts.map(d => {
                if (d.id === draft.id) {
                  const current = d.thoughtMarkers || [];
                  const next = current.includes(marker) ? current.filter(m => m !== marker) : [...current, marker];
                  return { ...d, thoughtMarkers: next };
                }
                return d;
              }));
            }}
            onTextSelect={handleTextSelection}
          />
        </div>
        {children.map(child => renderNoteAndReplies(child, depth + 1))}
      </div>
    );
  };

  // Filter root drafts for active flow
  const rootDrafts = activeDrafts.filter(d => !d.replyTo || !activeDrafts.some(parent => parent.id === d.replyTo));

  return (
    <div className="flex-1 h-full bg-[rgb(var(--background))] flex select-text">
      {/* Sidebar Focus */}
      <div className="w-[280px] border-r border-[rgb(var(--border))]/50 flex flex-col bg-[rgb(var(--panel))]/30 shrink-0">
        <div className="p-6 pb-2 border-b border-[rgb(var(--border))]/50">
          <div className="flex bg-[rgb(var(--background))] rounded-lg p-1 border border-[rgb(var(--border))] mb-8">
            <button
              onClick={() => setLabView("todo")}
              className="flex-1 py-1.5 rounded-md text-[13px] font-medium text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] transition-colors cursor-pointer"
            >
              Tasks
            </button>
            <button className="flex-1 py-1.5 bg-[rgb(var(--panel))] rounded-md shadow-sm border border-[rgb(var(--border))] text-[13px] font-medium text-[rgb(var(--text-main))] cursor-default">
              Writing
            </button>
          </div>
          
          <h2 className="text-[18px] font-medium text-[rgb(var(--text-main))] tracking-tight">Manuscripts</h2>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {/* Collapsible Folders */}
          {manuscriptFolders.map(folder => {
            const isExpanded = expandedFolders[folder.id] === true;
            return (
              <div key={folder.id} className="flex flex-col mb-1 relative">
                <div className="flex items-center group px-3 hover:bg-[rgb(var(--panel))]/50 transition-colors rounded-xl">
                  <button
                    onClick={() => setExpandedFolders(prev => ({ ...prev, [folder.id]: !prev[folder.id] }))}
                    className="flex items-center gap-2 py-2 text-left cursor-pointer flex-1 min-w-0"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[rgb(var(--text-muted))]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[rgb(var(--text-muted))]" />
                    )}
                    <Folder className="w-4 h-4 shrink-0 text-[rgb(var(--accent))]" />
                    {editingFolderId === folder.id ? (
                      <input
                        value={editingFolderName}
                        onChange={(e) => setEditingFolderName(e.target.value)}
                        onBlur={() => {
                          if (editingFolderName.trim() && editingFolderName !== folder.name) {
                            setManuscriptFolders(manuscriptFolders.map(f => f.id === folder.id ? { ...f, name: editingFolderName.trim() } : f));
                          }
                          setEditingFolderId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        className="bg-[rgb(var(--background))] border border-[rgb(var(--accent))] text-[13px] font-medium text-[rgb(var(--text-main))] px-1 py-0.5 w-full focus:outline-none"
                      />
                    ) : (
                      <span className="text-[13px] font-medium text-[rgb(var(--text-main))] truncate select-none">
                        {folder.name}
                      </span>
                    )}
                  </button>
                  {!editingFolderId && (
                    <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFolderId(folder.id);
                          setEditingFolderName(folder.name);
                        }}
                        className="p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] rounded"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Czy chcesz usunąć folder "${folder.name}"? Manuskrypty w nim zostaną przeniesione na poziom główny.`)) {
                            setManuscriptFolders(manuscriptFolders.filter(f => f.id !== folder.id));
                            setDrafts(prev => prev.map(d => d.folderId === folder.id ? { ...d, folderId: undefined } : d));
                            setTempFolderMapping(prev => {
                              const copy = { ...prev };
                              Object.keys(copy).forEach(k => {
                                if (copy[k] === folder.id) delete copy[k];
                              });
                              return copy;
                            });
                          }
                        }}
                        className="p-1 text-red-500 hover:text-red-400 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                {isExpanded && (
                  <div className="pl-4 mt-1 border-l border-[rgb(var(--border))]/30 ml-4 space-y-1">
                    {sortedManuscripts
                      .filter(m => getManuscriptFolderId(m) === folder.id)
                      .map(mName => renderManuscriptItem(mName))}
                    {sortedManuscripts.filter(m => getManuscriptFolderId(m) === folder.id).length === 0 && (
                      <div className="text-[11px] text-[rgb(var(--text-muted))] italic p-2 pl-4">Folder empty</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Root Level Manuscripts */}
          <div className="space-y-1">
            {sortedManuscripts
              .filter(m => !getManuscriptFolderId(m))
              .map(mName => renderManuscriptItem(mName))}
          </div>
        </div>

        <div className="p-4 border-t border-[rgb(var(--border))]/50 space-y-2">
          <button 
            onClick={() => {
              const name = prompt("Podaj nazwę nowego folderu:");
              if (name && name.trim()) {
                const newFolder: ManuscriptFolder = {
                  id: uid(),
                  name: name.trim(),
                  order: manuscriptFolders.length
                };
                setManuscriptFolders([...manuscriptFolders, newFolder]);
                setExpandedFolders(prev => ({ ...prev, [newFolder.id]: true }));
              }
            }} 
            className="w-full py-2 rounded-xl text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--panel))] text-[12px] font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <FolderPlus className="w-4 h-4" /> New Folder
          </button>
          <button onClick={handleAddManuscript} className="w-full py-2 rounded-xl text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--panel))] text-[12px] font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors">
            <Plus className="w-4 h-4" /> New Manuscript
          </button>
        </div>
      </div>

      {/* Main Flow */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center py-12 px-8 custom-scrollbar">
        <div className="w-full max-w-[680px]">
          
          <div className="mb-6 flex justify-between items-end">
            <div className="flex-1 mr-4">
              <input 
                value={activeManuscript}
                onChange={(e) => {
                  const updated = e.target.value;
                  setLocalManuscripts(localManuscripts.map(m => m === activeManuscript ? updated : m));
                  setDrafts(drafts.map(d => (d.manuscriptId || 'Main writing project') === activeManuscript ? { ...d, manuscriptId: updated } : d));
                  updateMeta(updated, { aiContext: currentMeta?.aiContext, sourceRefs: currentMeta?.sourceRefs });
                  setActiveManuscript(updated);
                }}
                className="text-[32px] font-serif text-[rgb(var(--text-main))] mb-2 tracking-tight bg-transparent border-none outline-none w-full"
              />
              <div className="text-[14px] text-[rgb(var(--text-muted))] mb-2">
                Continuous flow &bull; {totalWords} words total
              </div>
              
              {/* Folder Selector Dropdown */}
              <div className="flex items-center gap-2 text-[12px] text-[rgb(var(--text-muted))]">
                <span>Folder:</span>
                <select
                  value={getManuscriptFolderId(activeManuscript) || ""}
                  onChange={(e) => handleAssignFolder(activeManuscript, e.target.value || undefined)}
                  className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded px-2 py-0.5 outline-none text-[rgb(var(--text-main))] cursor-pointer text-xs"
                >
                  <option value="">(None - Root)</option>
                  {manuscriptFolders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <button 
              onClick={() => {
                const exportDrafts: DraftExport[] = activeDrafts.map(d => ({
                  id: d.id,
                  title: `Draft ${d.id.slice(0, 6)}`,
                  content: d.content,
                  status: 'draft' as const,
                  folderId: d.folderId,
                }));
                const preset = getExportPreset("lab-writing");
                const exportData = generateAIExport([], [], "", preset.scope, undefined, exportDrafts);
                downloadFile(exportData, generateExportFilename(preset.label));
              }}
              className="px-4 py-2 shrink-0 rounded-lg bg-[rgb(var(--panel))] hover:bg-[rgb(var(--border))] border border-[rgb(var(--border))] text-[13px] font-medium transition-colors flex items-center gap-2 text-[rgb(var(--text-main))] cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4 text-[rgb(var(--accent))]" /> Export
            </button>
          </div>

          {/* AI Message Foldable Details Box */}
          <details className="mb-6 bg-[rgb(var(--panel))]/20 border border-[rgb(var(--border))]/50 rounded-xl p-3">
            <summary className="text-[12px] text-[rgb(var(--text-muted))] cursor-pointer hover:text-[rgb(var(--text-main))] font-medium outline-none select-none">
              Wiadomość dla AI (opcjonalne)
            </summary>
            <textarea
              placeholder="AI, to jest projekt o..."
              value={currentMeta?.aiContext || ''}
              onChange={(e) => updateMeta(activeManuscript, { aiContext: e.target.value })}
              className="w-full mt-2 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg p-3 text-[14px] text-[rgb(var(--text-main))] outline-none resize-none min-h-[60px] focus:border-[rgb(var(--accent))]"
            />
          </details>

          {/* Tab Bar Bar */}
          <div className="flex items-center gap-2 border-b border-[rgb(var(--border))]/50 pb-2 mb-6 overflow-x-auto select-none">
            <button
              onClick={() => setActiveTabId('default')}
              className={`px-3 py-1 rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
                activeTabId === 'default'
                  ? "bg-[rgb(var(--panel))] border border-[rgb(var(--border))] text-[rgb(var(--text-main))]"
                  : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))]"
              }`}
            >
              Główna
            </button>
            {manuscriptTabs
              .filter(t => t.manuscriptId === activeManuscript)
              .sort((a, b) => a.order - b.order)
              .map(tab => (
                <div key={tab.id} className="relative group/tab flex items-center">
                  <button
                    onClick={() => setActiveTabId(tab.id)}
                    className={`px-3 py-1 rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
                      activeTabId === tab.id
                        ? "bg-[rgb(var(--panel))] border border-[rgb(var(--border))] text-[rgb(var(--text-main))]"
                        : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))]"
                    }`}
                  >
                    {tab.name}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Usunąć zakładkę "${tab.name}" i jej wpisy?`)) {
                        setDrafts(drafts.filter(d => d.tabId !== tab.id));
                        setManuscriptTabs(manuscriptTabs.filter(t => t.id !== tab.id));
                        if (activeTabId === tab.id) setActiveTabId('default');
                      }
                    }}
                    className="opacity-0 group-hover/tab:opacity-100 absolute -right-1.5 -top-1.5 bg-red-500 text-white rounded-full w-3.5 h-3.5 text-[9px] flex items-center justify-center hover:bg-red-400 cursor-pointer"
                  >
                    &times;
                  </button>
                </div>
              ))}
            <button
              onClick={() => {
                const name = prompt("Podaj nazwę nowej zakładki:");
                if (name && name.trim()) {
                  const newTab: ManuscriptTab = {
                    id: uid(),
                    manuscriptId: activeManuscript,
                    name: name.trim(),
                    order: manuscriptTabs.filter(t => t.manuscriptId === activeManuscript).length,
                    createdAt: new Date().toISOString()
                  };
                  setManuscriptTabs([...manuscriptTabs, newTab]);
                  setActiveTabId(newTab.id);
                }
              }}
              className="p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] rounded hover:bg-[rgb(var(--panel))] transition-colors cursor-pointer"
              title="Dodaj zakładkę"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Showcase (Gablota) */}
          <div className="mb-8 bg-[rgb(var(--panel))]/30 border border-dashed border-[rgb(var(--border))] rounded-2xl p-5 select-text">
            <div className="text-[12px] font-bold uppercase tracking-wider text-[rgb(var(--text-muted))] mb-3 flex items-center gap-1.5 select-none">
              <span>Gablota (Showcase)</span>
            </div>
            {currentMeta?.sourceRefs && currentMeta.sourceRefs.length > 0 ? (
              <div className="space-y-3">
                {currentMeta.sourceRefs.map(ref => (
                  <div key={ref.id} className="text-[14px] bg-[rgb(var(--background))] border border-[rgb(var(--border))]/50 rounded-xl p-4 relative">
                    <div className="text-xl text-[rgb(var(--accent))] font-serif leading-none absolute left-3 top-3 opacity-30 select-none">“</div>
                    <div className="pl-6 italic text-[rgb(var(--text-main))] whitespace-pre-wrap">{ref.originalText}</div>
                    <div className="pl-6 mt-2 flex justify-between items-center text-[11px] text-[rgb(var(--text-muted))] select-none">
                      <span>Utworzono: {new Date(ref.createdAt).toLocaleString()}</span>
                      <button
                        onClick={() => {
                          if (confirm("Czy usunąć ten cytat z Gabloty?")) {
                            const updatedRefs = currentMeta.sourceRefs?.filter(r => r.id !== ref.id);
                            updateMeta(activeManuscript, { sourceRefs: updatedRefs });
                          }
                        }}
                        className="text-red-400 hover:text-red-300 cursor-pointer"
                      >
                        Usuń
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[13px] text-[rgb(var(--text-muted))] italic text-center py-4 select-none">
                Gablota jest pusta. Zaznacz tekst w dowolnej notatce i kliknij "Branch", aby dodać cytaty do tego manuskryptu.
              </div>
            )}
          </div>

          {/* Quick Add Area */}
          <div className="relative mb-16 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-2xl p-4 shadow-sm focus-within:border-[rgb(var(--text-muted))] focus-within:shadow-md transition-all duration-300">
             {replyingTo && (
               <div className="flex justify-between items-center bg-[rgb(var(--panel))] px-4 py-2 border-b border-[rgb(var(--border))] rounded-t-2xl text-[13px] text-[rgb(var(--text-muted))] mb-2">
                 <span>Odpowiadasz na: <span className="italic">"{drafts.find(d => d.id === replyingTo)?.content.substring(0, 40)}..."</span></span>
                 <button onClick={() => setReplyingTo(null)} className="text-red-400 hover:text-red-300 cursor-pointer">Anuluj</button>
               </div>
             )}
             <textarea
               placeholder="Start typing your thoughts... (Enter to save, Shift+Enter for new line)"
               value={newNote}
               onChange={(e) => setNewNote(e.target.value)}
               onKeyDown={handleKeyDown}
               className="w-full bg-transparent text-[16px] leading-relaxed text-[rgb(var(--text-main))] placeholder-[rgb(var(--text-muted))]/60 resize-none outline-none min-h-[100px]"
             />
             <div className="flex justify-between items-end mt-2">
                <span className="text-[12px] text-[rgb(var(--text-muted))]/60">
                   {newNote.trim().split(/\s+/).filter(Boolean).length} words
                </span>
                <button 
                  onClick={handleAddNote} 
                  disabled={!newNote.trim()}
                  className={`px-5 py-2 rounded-full text-[13px] font-medium transition-all ${newNote.trim() ? "bg-[rgb(var(--text-main))] text-[rgb(var(--background))] hover:bg-[rgb(var(--text-muted))] cursor-pointer shadow-sm" : "bg-[rgb(var(--border))] text-[rgb(var(--text-muted))] opacity-50 cursor-not-allowed"}`}
                >
                  Save Entry
                </button>
             </div>
          </div>

          {/* Note Stream Flow */}
          <div className="flex flex-col gap-8">
            {rootDrafts.map((draft) => renderNoteAndReplies(draft, 0))}
            
            {activeDrafts.length === 0 && (
                <div className="py-24 text-center text-[rgb(var(--text-muted))] text-[15px]">
                    No entries yet. Start writing above.
                </div>
            )}
          </div>
          
        </div>
      </div>

      {/* Floating Branch Button */}
      {selectionCoords && selectedText && (
        <button
          style={{ left: `${selectionCoords.x}px`, top: `${selectionCoords.y}px` }}
          onClick={() => setShowBranchModal(true)}
          className="fixed z-50 bg-[rgb(var(--accent))] text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-xl hover:bg-[rgb(var(--accent))]/80 cursor-pointer flex items-center gap-1.5 border border-white/20"
        >
          <Plus className="w-3.5 h-3.5" /> Branch
        </button>
      )}

      {/* Branch Selection Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-[18px] font-medium text-[rgb(var(--text-main))] mb-4">Branch Selection</h3>
            <p className="text-[13px] text-[rgb(var(--text-muted))] mb-4 italic max-h-24 overflow-y-auto bg-[rgb(var(--panel))]/50 p-2.5 rounded-lg border border-[rgb(var(--border))]/50">
              "{selectedText.substring(0, 200)}{selectedText.length > 200 ? '...' : ''}"
            </p>
            
            <div className="space-y-4">
              <div>
                <button
                  onClick={() => {
                    const name = prompt("Podaj nazwę nowego manuskryptu:");
                    if (name && name.trim()) {
                      const newName = name.trim();
                      if (!localManuscripts.includes(newName)) {
                        setLocalManuscripts([...localManuscripts, newName]);
                      }
                      const newRef: SourceReference = {
                        id: uid(),
                        originalText: selectedText,
                        createdAt: new Date().toISOString()
                      };
                      setManuscriptMetas(prev => [
                        ...prev.filter(m => m.manuscriptId !== newName),
                        { manuscriptId: newName, sourceRefs: [newRef] }
                      ]);
                      setActiveManuscript(newName);
                      setShowBranchModal(false);
                      setSelectedText("");
                      setSelectionCoords(null);
                    }
                  }}
                  className="w-full py-2.5 px-4 bg-[rgb(var(--text-main))] text-[rgb(var(--background))] rounded-xl text-[14px] font-medium hover:opacity-90 transition-opacity text-center cursor-pointer block"
                >
                  Stwórz nowy manuskrypt
                </button>
              </div>
              
              <div className="border-t border-[rgb(var(--border))]/50 pt-4">
                <label className="block text-xs font-semibold text-[rgb(var(--text-muted))] uppercase mb-2">Dodaj do istniejącego:</label>
                <select
                  onChange={(e) => {
                    const dest = e.target.value;
                    if (dest) {
                      const newRef: SourceReference = {
                        id: uid(),
                        originalText: selectedText,
                        createdAt: new Date().toISOString()
                      };
                      setManuscriptMetas(prev => {
                        const exists = prev.find(m => m.manuscriptId === dest);
                        if (exists) {
                          return prev.map(m => m.manuscriptId === dest ? { ...m, sourceRefs: [...(m.sourceRefs || []), newRef] } : m);
                        } else {
                          return [...prev, { manuscriptId: dest, sourceRefs: [newRef] }];
                        }
                      });
                      setActiveManuscript(dest);
                      setShowBranchModal(false);
                      setSelectedText("");
                      setSelectionCoords(null);
                    }
                  }}
                  value=""
                  className="w-full bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-2.5 text-[14px] text-[rgb(var(--text-main))] outline-none cursor-pointer"
                >
                  <option value="" disabled>Wybierz manuskrypt...</option>
                  {localManuscripts.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex justify-end mt-6 pt-4 border-t border-[rgb(var(--border))]/50">
              <button
                onClick={() => {
                  setShowBranchModal(false);
                  setSelectedText("");
                  setSelectionCoords(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] transition-colors cursor-pointer"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const NoteEntry: React.FC<{
  draft: WritingDraft;
  onDelete: () => void;
  onEdit: (newContent: string) => void;
  onReply: () => void;
  onAddAnnotation: (category: 'comment' | 'raw-fragment' | 'issue', content: string) => void;
  onDeleteAnnotation: (annId: string) => void;
  onToggleMarker: (marker: ThoughtMarker) => void;
  onTextSelect: (e: React.MouseEvent) => void;
}> = ({
  draft,
  onDelete,
  onEdit,
  onReply,
  onAddAnnotation,
  onDeleteAnnotation,
  onToggleMarker,
  onTextSelect
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(draft.content);

  // Annotation Editor state
  const [activeAnnotationEditor, setActiveAnnotationEditor] = useState<string | null>(null);
  const [newAnnotationCategory, setNewAnnotationCategory] = useState<'comment' | 'raw-fragment' | 'issue'>('comment');
  const [newAnnotationText, setNewAnnotationText] = useState("");

  // Thought Marker dropdown state
  const [activeMarkerDropdown, setActiveMarkerDropdown] = useState<string | null>(null);

  const getDisplayDate = (dStr?: string) => {
    if (!dStr) return '';
    const t = new Date(dStr).getTime();
    if (isNaN(t)) return dStr;
    return new Date(dStr).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  };

  const displayDate = getDisplayDate(draft.updatedAt);

  return (
    <div className="group flex gap-6 relative select-text">
       <div className="w-16 shrink-0 flex flex-col items-end pt-1 select-none">
          <div className="text-[12px] font-medium text-[rgb(var(--text-muted))]">
             {displayDate}
          </div>
          <div className="text-[11px] text-[rgb(var(--text-muted))]/60 mt-1">
             {draft.words || 0} w
          </div>
          {/* Thought Marker Circles */}
          {draft.thoughtMarkers && draft.thoughtMarkers.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap justify-end max-w-full">
              {draft.thoughtMarkers.map(m => (
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
       
       <div className="absolute left-[72px] top-6 bottom-[-32px] w-px bg-[rgb(var(--border))]/50 group-last:hidden" />
       
       <div className="flex-1 bg-[rgb(var(--background))] hover:bg-[rgb(var(--panel))]/30 border border-transparent hover:border-[rgb(var(--border))] rounded-2xl p-5 -m-5 transition-colors relative">
         {isEditing ? (
           <textarea
             autoFocus
             value={editContent}
             onChange={(e) => setEditContent(e.target.value)}
             onBlur={() => {
               setIsEditing(false);
               if (editContent.trim() && editContent !== draft.content) {
                 onEdit(editContent);
               }
             }}
             onKeyDown={(e) => {
               if (e.key === 'Escape') { setIsEditing(false); setEditContent(draft.content); }
             }}
             className="w-full text-[16px] text-[rgb(var(--text-main))] leading-[1.7] bg-[rgb(var(--panel))] border border-[rgb(var(--accent))] rounded-lg p-3 outline-none resize-none min-h-[80px]"
           />
         ) : (
           <div 
             onMouseUp={onTextSelect}
             className="text-[16px] text-[rgb(var(--text-main))] leading-[1.7] whitespace-pre-wrap select-text"
           >
             {draft.content}
           </div>
         )}

         {/* Render annotations and badges */}
         {draft.annotations && draft.annotations.length > 0 && (
           <div className="mt-3 space-y-1">
             <div className="flex gap-1.5 select-none">
                {(draft.annotations.filter(a => a.category === 'comment').length > 0) && (
                   <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[rgb(var(--border))] text-[rgb(var(--text-muted))]">
                     [N] {draft.annotations.filter(a => a.category === 'comment').length}
                   </span>
                )}
                {(draft.annotations.filter(a => a.category === 'raw-fragment').length > 0) && (
                   <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-orange-500/30 text-orange-400 bg-orange-500/10">
                     [F] {draft.annotations.filter(a => a.category === 'raw-fragment').length}
                   </span>
                )}
                {(draft.annotations.filter(a => a.category === 'issue').length > 0) && (
                   <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-red-500/30 text-red-400 bg-red-500/10">
                     [I] {draft.annotations.filter(a => a.category === 'issue').length}
                   </span>
                )}
             </div>
             <div className="pl-2 border-l border-[rgb(var(--border))]/50 space-y-1 mt-1.5 text-xs">
               {draft.annotations.map(ann => (
                 <div key={ann.id} className="flex justify-between items-center text-[12px] text-[rgb(var(--text-muted))] group/ann">
                   <span className="select-text">
                     <strong className={
                       ann.category === 'comment' ? 'text-[rgb(var(--text-muted))]' :
                       ann.category === 'raw-fragment' ? 'text-orange-400' : 'text-red-400'
                     }>
                       [{ann.category === 'comment' ? 'N' : ann.category === 'raw-fragment' ? 'F' : 'I'}]
                     </strong> {ann.content}
                   </span>
                   <button
                     onClick={() => onDeleteAnnotation(ann.id)}
                     className="text-red-400 opacity-0 group-hover/ann:opacity-100 transition-opacity ml-2 hover:text-red-300 cursor-pointer select-none"
                   >
                     &times;
                   </button>
                 </div>
               ))}
             </div>
           </div>
         )}
         
         <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 select-none">
            {/* Thought Marker Trigger */}
            <div className="relative">
              <button
                onClick={() => setActiveMarkerDropdown(activeMarkerDropdown === draft.id ? null : draft.id)}
                className="p-1.5 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] rounded-md hover:bg-[rgb(var(--border))] transition-colors cursor-pointer"
                title="Stan myśli (Thought markers)"
              >
                <div className="w-3.5 h-3.5 rounded-full border border-dashed border-[rgb(var(--text-muted))] flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--text-muted))]" />
                </div>
              </button>
              {activeMarkerDropdown === draft.id && (
                <div className="absolute right-0 bottom-8 mt-1 w-32 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg shadow-xl py-1 z-30">
                  {(['certain', 'hypothesis', 'question', 'answer'] as ThoughtMarker[]).map(marker => {
                    const hasMarker = draft.thoughtMarkers?.includes(marker);
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
                onClick={() => setActiveAnnotationEditor(activeAnnotationEditor === draft.id ? null : draft.id)}
                className="p-1.5 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] rounded-md hover:bg-[rgb(var(--border))] transition-colors cursor-pointer"
                title="Add annotation"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {activeAnnotationEditor === draft.id && (
                <div className="absolute right-0 bottom-8 mt-1 w-64 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg shadow-xl p-3 z-30 text-left">
                  <select
                    value={newAnnotationCategory}
                    onChange={(e) => setNewAnnotationCategory(e.target.value as 'comment' | 'raw-fragment' | 'issue')}
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

            {/* Reply Button */}
            <button 
              onClick={onReply}
              className="p-1.5 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] rounded-md hover:bg-[rgb(var(--border))] transition-colors cursor-pointer"
              title="Reply"
            >
               <Plus className="w-3.5 h-3.5 rotate-45" />
            </button>
            
            {/* #5: History button */}
            <HistoryButton
              entityId={draft.id}
              entityType="manuscript"
              title={draft.content.slice(0, 80)}
              content={draft.content}
            />
            
            <button 
              onClick={() => { setIsEditing(true); setEditContent(draft.content); }}
              className="p-1.5 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] rounded-md hover:bg-[rgb(var(--border))] transition-colors cursor-pointer"
            >
               <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="p-1.5 text-[rgb(var(--text-muted))] hover:text-red-400 rounded-md hover:bg-red-400/10 transition-colors cursor-pointer">
               <Trash2 className="w-3.5 h-3.5" />
            </button>
         </div>
       </div>
    </div>
  );
}
