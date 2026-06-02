import React, { useState } from "react";
import { Plus, Settings, MoreHorizontal, Trash2, Edit3, ArrowUp, ArrowDown } from "lucide-react";
import { WritingDraft } from "../types";

export function LabWriting({
  setLabView,
  drafts,
  setDrafts
}: {
  setLabView: (v: "todo" | "writing") => void;
  drafts: WritingDraft[];
  setDrafts: React.Dispatch<React.SetStateAction<WritingDraft[]>>;
}) {
  const [newNote, setNewNote] = useState("");
  
  const existingProjectIds = Array.from(new Set(drafts.map(d => d.manuscriptId || 'Main writing project')));
  if (!existingProjectIds.includes('Main writing project')) existingProjectIds.unshift('Main writing project');

  const [localManuscripts, setLocalManuscripts] = useState<string[]>(existingProjectIds);
  const [activeManuscript, setActiveManuscript] = useState<string>('Main writing project');

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const now = new Date();
    const dateStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    const wordsCount = newNote.trim().split(/\s+/).length;

    setDrafts([{
      id: `#${drafts.length + 1}`,
      content: newNote,
      words: wordsCount,
      updatedAt: dateStr,
      manuscriptId: activeManuscript
    }, ...drafts]);
    setNewNote("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.metaKey) {
        handleAddNote();
    }
  };

  const handleDeleteDraft = (id: string) => {
    setDrafts(drafts.filter(d => d.id !== id));
  };
  
  const activeDrafts = drafts.filter(d => (d.manuscriptId || 'Main writing project') === activeManuscript);
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

  return (
    <div className="flex-1 h-[calc(100vh-3.5rem)] bg-[rgb(var(--background))] flex">
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

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
          {localManuscripts.map(title => {
            const mDrafts = drafts.filter(d => (d.manuscriptId || 'Main writing project') === title);
            const mWords = mDrafts.reduce((sum, curr) => sum + curr.words, 0);
            return (
              <div 
                key={title}
                onClick={() => setActiveManuscript(title)}
                className={`group rounded-xl p-3 cursor-pointer transition-colors ${activeManuscript === title ? "bg-[rgb(var(--panel))] border border-[rgb(var(--border))] shadow-sm" : "hover:bg-[rgb(var(--panel))]/50 border border-transparent"}`}
              >
                <div className="font-medium text-[14px] text-[rgb(var(--text-main))] mb-1 truncate">
                  {title}
                </div>
                <div className="text-[12px] text-[rgb(var(--text-muted))]">
                  {mDrafts.length} entries &bull; {mWords} words
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-[rgb(var(--border))]/50">
          <button onClick={handleAddManuscript} className="w-full py-2.5 rounded-xl text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--panel))] text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors">
            <Plus className="w-4 h-4" /> New Manuscript
          </button>
        </div>
      </div>

      {/* Main Flow */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center py-12 px-8 custom-scrollbar">
        <div className="w-full max-w-[680px]">
          
          <div className="mb-12">
            <input 
              value={activeManuscript}
              onChange={(e) => {
                const updated = e.target.value;
                setLocalManuscripts(localManuscripts.map(m => m === activeManuscript ? updated : m));
                setDrafts(drafts.map(d => (d.manuscriptId || 'Main writing project') === activeManuscript ? { ...d, manuscriptId: updated } : d));
                setActiveManuscript(updated);
              }}
              className="text-[32px] font-serif text-[rgb(var(--text-main))] mb-2 tracking-tight bg-transparent border-none outline-none w-full"
            />
            <div className="text-[14px] text-[rgb(var(--text-muted))]">
              Continuous flow &bull; {totalWords} words total
            </div>
          </div>

          <div className="relative mb-16 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-2xl p-4 shadow-sm focus-within:border-[rgb(var(--text-muted))] focus-within:shadow-md transition-all duration-300">
             <textarea
               placeholder="Start typing your thoughts... (⌘ + Enter to save)"
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

          <div className="flex flex-col gap-8">
            {activeDrafts.map((draft, idx) => (
              <NoteEntry 
                key={draft.id} 
                content={draft.content} 
                date={draft.updatedAt}
                words={draft.words}
                isFirst={idx === 0}
                onDelete={() => handleDeleteDraft(draft.id)}
              />
            ))}
            
            {activeDrafts.length === 0 && (
                <div className="py-24 text-center text-[rgb(var(--text-muted))] text-[15px]">
                    No entries yet. Start writing above.
                </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}

const NoteEntry: React.FC<{
  content: string;
  date?: string;
  words?: number;
  isFirst: boolean;
  onDelete: () => void;
}> = ({
  content,
  date,
  words,
  isFirst,
  onDelete
}) => {
  return (
    <div className="group flex gap-6 relative">
       <div className="w-16 shrink-0 flex flex-col items-end pt-1">
          <div className="text-[12px] font-medium text-[rgb(var(--text-muted))]">
             {date}
          </div>
          <div className="text-[11px] text-[rgb(var(--text-muted))]/60 mt-1">
             {words} w
          </div>
       </div>
       
       <div className="absolute left-[72px] top-6 bottom-[-32px] w-px bg-[rgb(var(--border))]/50 group-last:hidden" />
       
       <div className="flex-1 bg-[rgb(var(--background))] hover:bg-[rgb(var(--panel))]/30 border border-transparent hover:border-[rgb(var(--border))] rounded-2xl p-5 -m-5 transition-colors relative">
         <div className="text-[16px] text-[rgb(var(--text-main))] leading-[1.7] whitespace-pre-wrap">
           {content}
         </div>
         
         <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <button className="p-1.5 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] rounded-md hover:bg-[rgb(var(--border))] transition-colors cursor-pointer">
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

