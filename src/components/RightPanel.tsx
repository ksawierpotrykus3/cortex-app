import React, { useState, useEffect, useMemo } from "react";
import { X, Plus, Activity, Image as ImageIcon, Link2, Unlink, Trash2, Move, Loader2, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { RightPanelState, NexusNode, NexusAnnotation, NexusLink } from "../types";
import { uid } from "../utils/ids";

export function RightPanel({ 
  state, 
  onClose,
  selectedNode,
  onNodeDelete,
  onNodeUpdate,
  axioms,
  setAxioms,
  allNodes,
  allLinks,
  onLinkDelete,
  onMoveToProject
}: {
  state: RightPanelState;
  onClose: () => void;
  selectedNode?: NexusNode;
  onNodeDelete?: (id: string) => void;
  onNodeUpdate?: (id: string, updates: Partial<NexusNode>) => void;
  axioms?: {id: string, text: string}[];
  setAxioms?: (axioms: {id: string, text: string}[]) => void;
  allNodes?: NexusNode[];
  allLinks?: NexusLink[];
  onLinkDelete?: (linkId: { source: string; target: string }) => void;
  onMoveToProject?: (nodeId: string, projectId: string) => void;
}) {
  if (state === "none") return null;

  return (
    <div className="w-[400px] border-l border-[rgb(var(--border))] flex flex-col h-full bg-[rgb(var(--background))] shrink-0 z-40 shadow-xl absolute right-0 top-0 bottom-0">
      <div className="p-4 flex items-center justify-between border-b border-[rgb(var(--border))] bg-[rgb(var(--panel))]/50">
        <h3 className="text-[15px] font-medium text-[rgb(var(--text-main))]">
          {state === "axioms" ? "Nexus Axioms" : "Properties"}
        </h3>
        <button onClick={onClose} className="text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--border))] p-1 rounded transition-colors cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 relative flex flex-col min-h-0 bg-[rgb(var(--background))]">
        {state === "axioms" && axioms && setAxioms && <AxiomsPanelContent axioms={axioms} setAxioms={setAxioms} />}
        {state === "properties" && (
            <PropertiesPanelContent 
                selectedNode={selectedNode} 
                onNodeDelete={onNodeDelete} 
                onNodeUpdate={onNodeUpdate} 
                allNodes={allNodes}
                allLinks={allLinks}
                onLinkDelete={onLinkDelete}
                onMoveToProject={onMoveToProject}
            />
        )}
      </div>
    </div>
  );
}

function AxiomsPanelContent({ 
  axioms = [], 
  setAxioms 
}: { 
  axioms: {id: string, text: string}[], 
  setAxioms: (axioms: {id: string, text: string}[]) => void 
}) {

  const handleAddAxiom = () => {
    setAxioms([...axioms, { id: uid(), text: "" }]);
  };

  const handleUpdateAxiom = (id: string, text: string) => {
    setAxioms(axioms.map(a => a.id === id ? { ...a, text } : a));
  };

  const handleDeleteAxiom = (id: string) => {
    setAxioms(axioms.filter(a => a.id !== id));
  };

  return (
    <div className="flex flex-1 flex-col p-5 bg-[rgb(var(--background))] overflow-hidden">
       <div className="text-[14px] text-[rgb(var(--text-muted))] mb-4 leading-relaxed shrink-0">
           Define core axioms and rules for the system logic. These principles guide operations block evaluation.
       </div>
       
       <div className="shrink-0 mb-4 bg-[rgb(var(--background))]">
           <button onClick={handleAddAxiom} className="w-full py-2.5 rounded-xl text-[rgb(var(--background))] bg-[rgb(var(--text-main))] hover:bg-[rgb(var(--text-muted))] transition-colors shadow-sm text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer tracking-wide">
             <Plus className="w-4 h-4" />
             Create New Axiom
           </button>
       </div>

       <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2 pb-4">
         {axioms.map((axiom, idx) => (
           <div key={axiom.id} className="flex flex-col gap-2 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-2xl p-4 relative group hover:border-[rgb(var(--text-muted))]/30 transition-all shadow-sm shrink-0">
             <div className="flex items-center justify-between text-[13px] font-medium text-[rgb(var(--text-main))] mb-1">
               <span className="bg-[rgb(var(--border))]/50 px-2 py-0.5 rounded text-[11px] tracking-wide uppercase text-[rgb(var(--text-muted))]">Rule #{idx + 1}</span>
               <button 
                 onClick={() => handleDeleteAxiom(axiom.id)}
                 className="text-[rgb(var(--text-muted))] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-1 rounded-md hover:bg-[rgb(var(--background))]"
               >
                 <X className="w-3.5 h-3.5" />
               </button>
             </div>
             <textarea
                value={axiom.text}
                onChange={(e) => handleUpdateAxiom(axiom.id, e.target.value)}
                placeholder="Logic rule..."
                className="w-full bg-transparent text-[14px] leading-relaxed text-[rgb(var(--text-main))] focus:outline-none custom-scrollbar resize-none min-h-[60px]"
             />
           </div>
         ))}
       </div>
    </div>
  );
}

function PropertiesPanelContent({ 
    selectedNode, 
    onNodeDelete,
    onNodeUpdate,
    allNodes,
    allLinks,
    onLinkDelete,
    onMoveToProject
}: { 
    selectedNode?: NexusNode;
    onNodeDelete?: (id: string) => void;
    onNodeUpdate?: (id: string, updates: Partial<NexusNode>) => void;
    allNodes?: NexusNode[];
    allLinks?: NexusLink[];
    onLinkDelete?: (linkId: { source: string; target: string }) => void;
    onMoveToProject?: (nodeId: string, projectId: string) => void;
}) {
  const connectedLinks = useMemo(() => {
    if (!selectedNode || !allLinks) return [];
    return allLinks.filter(link => link.source === selectedNode.id || link.target === selectedNode.id);
  }, [selectedNode, allLinks]);

  const availableProjects = useMemo(() => {
    if (!allNodes) return [];
    const projects = new Set(allNodes.map(n => n.projectId || "Uncategorized"));
    return Array.from(projects);
  }, [allNodes]);

  if (!selectedNode) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col p-5 bg-[rgb(var(--background))] overflow-y-auto custom-scrollbar">
      <div className="text-[12px] font-semibold text-[rgb(var(--text-muted))] mb-5 truncate bg-[rgb(var(--panel))] p-2.5 rounded-lg border border-[rgb(var(--border))] flex items-center gap-2 shadow-sm">
        <Activity className="w-4 h-4 text-[rgb(var(--accent))]" /> 
        {selectedNode.id}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-[14px] font-medium text-[rgb(var(--text-main))]">
           Details
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-[13px] text-[rgb(var(--text-muted))] mb-1.5 block flex items-center gap-2">
              <Move className="w-3.5 h-3.5" /> Project
            </label>
            <select 
              className="w-full text-[14px] text-[rgb(var(--text-main))] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-[rgb(var(--accent))] transition-shadow cursor-pointer"
              value={selectedNode.projectId || "Uncategorized"}
              onChange={(e) => onMoveToProject?.(selectedNode.id, e.target.value === "Uncategorized" ? "" : e.target.value)}
            >
              {availableProjects.map(project => (
                <option key={project} value={project}>{project}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[13px] text-[rgb(var(--text-muted))] mb-1.5 block">Title</label>
            <input 
              className="w-full text-[14px] text-[rgb(var(--text-main))] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-[rgb(var(--accent))] transition-shadow"
              value={selectedNode.title || ""}
              onChange={(e) => onNodeUpdate?.(selectedNode.id, { title: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-[rgb(var(--border))] pt-6 flex flex-col shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[14px] font-medium text-[rgb(var(--text-main))]">
             Content
          </div>
        </div>
        <textarea 
            className="w-full flex-1 text-[14px] leading-relaxed text-[rgb(var(--text-main))] border border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-4 rounded-xl whitespace-pre-wrap focus:outline-none focus:ring-1 focus:ring-[rgb(var(--accent))] custom-scrollbar transition-shadow resize-y min-h-[140px]"
            value={selectedNode.content || ""}
            onChange={(e) => onNodeUpdate?.(selectedNode.id, { content: e.target.value })}
            placeholder="Write your notes here..."
        />
      </div>

      {selectedNode.imageAttachments && selectedNode.imageAttachments.length > 0 && (
        <div className="mt-8 border-t border-[rgb(var(--border))] pt-6 flex flex-col shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-[14px] font-medium text-[rgb(var(--text-main))]">
              <ImageIcon className="w-4 h-4" /> Obrazy ({selectedNode.imageAttachments.length})
            </div>
            <button
              onClick={() => {
                onNodeUpdate?.(selectedNode.id, { imageAttachments: [] });
              }}
              className="text-[rgb(var(--text-muted))] hover:text-red-400 text-[12px] cursor-pointer"
            >
              Clear all
            </button>
          </div>
          <div className="space-y-2">
            {selectedNode.imageAttachments.map(att => (
              <div key={att.id} className="flex items-center gap-3 p-2 bg-[rgb(var(--panel))] rounded-lg border border-[rgb(var(--border))]">
                <img src={att.dataUrl} className="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80" onClick={() => window.open(att.dataUrl, '_blank')} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-[rgb(var(--text-main))] truncate" title={att.mimeType}>
                    {att.mimeType.split('/')[1]?.toUpperCase() || 'IMG'}
                  </div>
                  <div className="text-[11px] text-[rgb(var(--text-muted))]">
                    {att.isProcessing ? <><Loader2 className="w-3 h-3 inline animate-spin mr-1" />Analizuję...</> : att.geminiResponse ? <><CheckCircle className="w-3 h-3 inline mr-1" />Przetworzono</> : att.geminiError ? <><AlertTriangle className="w-3 h-3 inline mr-1" />Błąd</> : <><Clock className="w-3 h-3 inline mr-1" />Oczekuje</>}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const updated = (selectedNode.imageAttachments || []).filter(a => a.id !== att.id);
                    onNodeUpdate?.(selectedNode.id, { imageAttachments: updated });
                  }}
                  className="text-[rgb(var(--text-muted))] hover:text-red-400 p-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 border-t border-[rgb(var(--border))] pt-6 flex flex-col shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[14px] font-medium text-[rgb(var(--text-main))]">
             <Link2 className="w-4 h-4" /> Connected Nodes
          </div>
        </div>
        <div className="space-y-2">
          {connectedLinks.length === 0 ? (
            <div className="text-[13px] text-[rgb(var(--text-muted))] italic">No connections</div>
          ) : (
            connectedLinks.map((link, idx) => {
              const otherNodeId = link.source === selectedNode.id ? link.target : link.source;
              const otherNode = allNodes?.find(n => n.id === otherNodeId);
              return (
                <div key={idx} className="flex items-center justify-between p-3 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg">
                  <span className="text-[13px] text-[rgb(var(--text-main))] truncate">
                    {otherNode?.title || otherNodeId}
                  </span>
                  <button 
                    onClick={() => onLinkDelete?.(link)}
                    className="text-[rgb(var(--text-muted))] hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
                    title="Remove link"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-8 border-t border-[rgb(var(--border))] pt-6 flex flex-col shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-[14px] font-medium text-[rgb(var(--text-main))]">
             Annotations
          </div>
          <button 
             onClick={() => {
                const newAnn: NexusAnnotation = {
                   id: uid(),
                   content: "",
                   category: "comment",
                   author: "user",
                   timestamp: new Date().toISOString()
                };
                onNodeUpdate?.(selectedNode.id, { annotations: [...(selectedNode.annotations || []), newAnn] });
             }}
             className="text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] cursor-pointer p-1 rounded hover:bg-[rgb(var(--border))]"
          >
             <Plus className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex flex-col gap-3">
           {(selectedNode.annotations || []).map(ann => (
              <div key={ann.id} className="flex flex-col gap-2 p-4 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl">
                 <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                       <select 
                          className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] text-[12px] text-[rgb(var(--text-main))] px-2 py-1 rounded-md outline-none cursor-pointer"
                          value={ann.category}
                          onChange={(e) => {
                             const updated = (selectedNode.annotations || []).map(a => a.id === ann.id ? { ...a, category: e.target.value as 'comment' | 'raw-fragment' | 'issue' } : a);
                             onNodeUpdate?.(selectedNode.id, { annotations: updated });
                          }}
                       >
                          <option value="comment">Comment</option>
                          <option value="raw-fragment">Raw Fragment</option>
                          <option value="issue">Issue</option>
                       </select>
                       <span className="text-[12px] text-[rgb(var(--text-muted))]">{ann.author}</span>
                    </div>
                    <button 
                       onClick={() => {
                          const updated = (selectedNode.annotations || []).filter(a => a.id !== ann.id);
                          onNodeUpdate?.(selectedNode.id, { annotations: updated });
                       }}
                       className="text-[rgb(var(--text-muted))] hover:text-red-400 p-1 rounded-md transition-colors cursor-pointer"
                    >
                       <X className="w-4 h-4" />
                    </button>
                 </div>
                 <textarea 
                    className="w-full text-[14px] bg-transparent text-[rgb(var(--text-main))] focus:outline-none resize-none leading-relaxed"
                    value={ann.content}
                    onChange={(e) => {
                       const updated = (selectedNode.annotations || []).map(a => a.id === ann.id ? { ...a, content: e.target.value } : a);
                       onNodeUpdate?.(selectedNode.id, { annotations: updated });
                    }}
                    placeholder="Type an annotation..."
                    rows={Math.max(2, ann.content.split('\n').length)}
                 />
                 <div className="text-[11px] text-[rgb(var(--text-muted))]/60 text-right mt-1">
                    {new Date(ann.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                 </div>
              </div>
           ))}
        </div>
      </div>

      <div className="mt-8 pt-4 w-full shrink-0 mb-6">
        <button 
           onClick={() => onNodeDelete?.(selectedNode.id)} 
           className="w-full py-2.5 bg-[rgb(var(--background))] hover:bg-red-500/10 border border-[rgb(var(--border))] hover:border-red-500/30 text-red-500 text-[13px] font-medium transition-colors cursor-pointer rounded-lg shadow-sm flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" /> Delete Node
        </button>
      </div>
    </div>
  );
}
