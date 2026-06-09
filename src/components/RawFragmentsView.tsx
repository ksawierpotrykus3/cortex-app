import React, { useState } from 'react';
import { NexusNode } from '../types';
import { ArrowUpRight, MessageSquareDashed, CheckSquare, Square, Trash2, MoveRight, Download, X } from 'lucide-react';
import { generateAIExport, downloadFile } from '../exportEngine';

export function RawFragmentsView({ 
  nodes, 
  onNodeSelect,
  onNodesDelete,
  onNodesMove,
  availableProjects = []
}: { 
  nodes: NexusNode[], 
  onNodeSelect: (nodeId: string) => void,
  onNodesDelete: (ids: string[]) => void,
  onNodesMove: (ids: string[], projectId: string) => void,
  availableProjects?: string[]
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const allFragments = nodes.flatMap(node => 
    (node.annotations || [])
      .filter(ann => ann.category === 'raw-fragment')
      .map(ann => ({ node, annotation: ann }))
  ).sort((a, b) => new Date(b.annotation.timestamp).getTime() - new Date(a.annotation.timestamp).getTime());

  const toggleSelection = (nodeId: string) => {
    setSelectedIds(prev => 
      prev.includes(nodeId) 
        ? prev.filter(id => id !== nodeId)
        : [...prev, nodeId]
    );
  };

  const handleExport = () => {
    const selectedNodes = nodes.filter(n => selectedIds.includes(n.id));
    const exportText = generateAIExport(selectedNodes, [], "");
    downloadFile(exportText, `nexus_fragments_export_${new Date().toISOString().split('T')[0]}.json`);
    setSelectedIds([]); // Clear selection after export
  };

  return (
    <div className="w-full h-full p-8 md:p-12 overflow-y-auto bg-[rgb(var(--background))] custom-scrollbar relative flex flex-col items-center">
      <div className="max-w-6xl w-full space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[rgb(var(--border))] pb-6 gap-4">
          <div>
            <h1 className="text-[28px] font-medium tracking-tight text-[rgb(var(--text-main))] mb-2">Unprocessed Fragments</h1>
            <p className="text-[15px] text-[rgb(var(--text-muted))] max-w-xl">
              Floating thoughts and unstructured snippets pending categorization.
            </p>
          </div>
          <div className="text-[14px] font-medium text-[rgb(var(--text-main))] bg-[rgb(var(--panel))] px-4 py-2 rounded-full border border-[rgb(var(--border))] shadow-sm whitespace-nowrap">
            {allFragments.length} {allFragments.length === 1 ? 'Fragment' : 'Fragments'} captured
          </div>
        </div>

        {allFragments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-[rgb(var(--text-muted))] border border-dashed border-[rgb(var(--border))] rounded-3xl bg-[rgb(var(--panel))]/30">
            <MessageSquareDashed className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-[16px] font-medium text-[rgb(var(--text-main))]">Workspace is clear</p>
            <p className="text-[14px] mt-1 opacity-70">No unprocessed fragments found in your topology.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-24">
            {allFragments.map(({ node, annotation }) => {
              const isSelected = selectedIds.includes(node.id);
              return (
              <div 
                key={annotation.id} 
                onClick={() => toggleSelection(node.id)}
                className={`group flex flex-col bg-[rgb(var(--panel))] rounded-2xl p-6 shadow-sm border transition-all duration-300 relative overflow-hidden cursor-pointer
                  ${isSelected ? 'border-[rgb(var(--accent))] ring-1 ring-[rgb(var(--accent))] shadow-md' : 'border-[rgb(var(--border))] hover:border-[rgb(var(--text-muted))]/40'}
                `}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400/20 to-transparent opacity-50" />
                
                <div className="absolute top-5 right-5 z-10 transition-colors">
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-[rgb(var(--accent))]" />
                  ) : (
                    <Square className="w-5 h-5 text-[rgb(var(--text-muted))] opacity-0 group-hover:opacity-40 transition-opacity" />
                  )}
                </div>
                
                <div className="flex-1 text-[16px] text-[rgb(var(--text-main))] whitespace-pre-wrap leading-relaxed pb-6 pt-2 font-medium pr-6 selection:bg-[rgb(var(--accent))]/20">
                  {annotation.content}
                </div>
                
                <div className="flex items-center justify-between pt-5 border-t border-[rgb(var(--border))]/60">
                  <span className="text-[13px] text-[rgb(var(--text-muted))] bg-[rgb(var(--background))] px-2.5 py-1 rounded-md border border-[rgb(var(--border))] font-medium">
                    {new Date(annotation.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onNodeSelect(node.id);
                    }}
                    className="flex items-center gap-1.5 text-[14px] font-medium text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] transition-colors"
                  >
                    <span className="truncate max-w-[140px]">{node.title || 'Untitled Node'}</span>
                    <ArrowUpRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </button>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="fixed bottom-10 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] shadow-2xl rounded-2xl px-6 py-4 flex items-center gap-6 z-50 animate-in slide-in-from-bottom-8">
           <div className="flex items-center gap-3 shrink-0">
             <div className="bg-[rgb(var(--accent))] text-[rgb(var(--background))] px-2.5 py-0.5 rounded-md text-[13px] font-bold">
               {selectedIds.length}
             </div>
             <span className="text-[14px] font-medium text-[rgb(var(--text-main))]">Selected</span>
           </div>
           
           <div className="w-px h-8 bg-[rgb(var(--border))] shrink-0" />
           
           <div className="flex items-center gap-3">
              <div className="relative group/move shrink-0">
                  <button className="flex items-center gap-2 text-[14px] font-medium text-[rgb(var(--text-main))] bg-[rgb(var(--background))] group-hover/move:border-[rgb(var(--accent))] px-4 py-2 rounded-xl transition-colors border border-[rgb(var(--border))]">
                     <MoveRight className="w-4 h-4 text-[rgb(var(--text-muted))] group-hover/move:text-[rgb(var(--accent))]" /> Move
                  </button>
                  <div className="absolute bottom-full left-0 mb-2 w-48 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] shadow-xl rounded-xl py-2 opacity-0 invisible group-hover/move:opacity-100 group-hover/move:visible transition-all z-50">
                     <button 
                         className="w-full text-left px-4 py-2 text-[13px] hover:bg-[rgb(var(--border))] text-[rgb(var(--text-main))]"
                         onClick={() => {
                             onNodesMove(selectedIds, "");
                             setSelectedIds([]);
                         }}
                     >
                         None (Uncategorized)
                     </button>
                     {availableProjects.filter(p => p && p !== 'Uncategorized').map(p => (
                         <button 
                             key={p}
                             className="w-full text-left px-4 py-2 text-[13px] hover:bg-[rgb(var(--border))] text-[rgb(var(--text-main))]"
                             onClick={() => {
                                 onNodesMove(selectedIds, p);
                                 setSelectedIds([]);
                             }}
                         >
                             {p}
                         </button>
                     ))}
                  </div>
              </div>

              <button 
                 onClick={handleExport}
                 className="flex items-center gap-2 text-[14px] font-medium text-[rgb(var(--text-main))] hover:border-[rgb(var(--text-muted))] bg-[rgb(var(--background))] px-4 py-2 rounded-xl transition-colors border border-[rgb(var(--border))] shrink-0">
                 <Download className="w-4 h-4 text-[rgb(var(--text-muted))]" /> Export
              </button>

              <button 
                 onClick={() => {
                    onNodesDelete(selectedIds);
                    setSelectedIds([]);
                 }}
                 className="flex items-center gap-2 text-[14px] font-medium text-red-500 hover:text-red-400 hover:bg-red-500/10 bg-[rgb(var(--background))] px-4 py-2 rounded-xl transition-colors border border-red-500/30 shrink-0">
                 <Trash2 className="w-4 h-4" /> Delete
              </button>
              
              <button 
                 onClick={() => setSelectedIds([])}
                 className="ml-2 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] p-2 rounded-lg hover:bg-[rgb(var(--border))] transition-colors shrink-0"
              >
                 <X className="w-4 h-4" />
              </button>
           </div>
        </div>
      )}
    </div>
  );
}
