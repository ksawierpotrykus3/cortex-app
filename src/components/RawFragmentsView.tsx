import React from 'react';
import { NexusNode } from '../types';
import { ArrowUpRight, MessageSquareDashed } from 'lucide-react';

export function RawFragmentsView({ nodes, onNodeSelect }: { nodes: NexusNode[], onNodeSelect: (nodeId: string) => void }) {
  const allFragments = nodes.flatMap(node => 
    (node.annotations || [])
      .filter(ann => ann.category === 'raw-fragment')
      .map(ann => ({ node, annotation: ann }))
  ).sort((a, b) => new Date(b.annotation.timestamp).getTime() - new Date(a.annotation.timestamp).getTime());

  return (
    <div className="w-full h-full p-8 md:p-12 overflow-y-auto bg-[rgb(var(--background))] custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-12">
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {allFragments.map(({ node, annotation }) => (
              <div 
                key={annotation.id} 
                className="group flex flex-col bg-[rgb(var(--panel))] rounded-2xl p-6 shadow-sm border border-[rgb(var(--border))] hover:border-[rgb(var(--text-muted))]/40 hover:shadow-md transition-all duration-300 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400/20 to-transparent opacity-50" />
                
                <div className="flex-1 text-[16px] text-[rgb(var(--text-main))] whitespace-pre-wrap leading-relaxed pb-6 pt-2 font-medium">
                  {annotation.content}
                </div>
                
                <div className="flex items-center justify-between pt-5 border-t border-[rgb(var(--border))]/60">
                  <span className="text-[13px] text-[rgb(var(--text-muted))] bg-[rgb(var(--background))] px-2.5 py-1 rounded-md border border-[rgb(var(--border))] font-medium">
                    {new Date(annotation.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  
                  <button 
                    onClick={() => onNodeSelect(node.id)}
                    className="flex items-center gap-1.5 text-[14px] font-medium text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] transition-colors"
                  >
                    <span className="truncate max-w-[140px]">{node.title || 'Untitled Node'}</span>
                    <ArrowUpRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
