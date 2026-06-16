// ============================================================================
// NEXUS — TagSuggestDialog
// Modal do szybkiego tagowania notatek — sugeruje tagi na podstawie treści
// ============================================================================

import React, { useState, useMemo } from 'react';
import { X, Tags, Sparkles, Check, Search } from 'lucide-react';
import { suggestTags, getTagsByCategory, TagSuggestion } from '../utils/tagEngine';
import { NexusNode } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface TagSuggestDialogProps {
  nodes: NexusNode[];
  onApplyTags: (nodeIds: string[], tags: string[]) => void;
  open: boolean;
  onClose: () => void;
}

export function TagSuggestDialog({ nodes, onApplyTags, open, onClose }: TagSuggestDialogProps) {
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState('');

  // Generate suggestions for selected nodes
  const suggestions = useMemo(() => {
    const targetNodes = selectedNodeIds.size === 0
      ? nodes.slice(0, 10) // limit when no selection
      : nodes.filter(n => selectedNodeIds.has(n.id));
    
    const tagMap = new Map<string, TagSuggestion>();
    for (const node of targetNodes) {
      const s = suggestTags(node.title, node.content);
      for (const t of s) {
        const existing = tagMap.get(t.tag);
        if (!existing || existing.score < t.score) {
          tagMap.set(t.tag, t);
        }
      }
    }
    return Array.from(tagMap.values()).sort((a, b) => b.score - a.score);
  }, [nodes, selectedNodeIds]);

  // All available tags grouped by category
  const tagsByCat = useMemo(() => getTagsByCategory(), []);
  const filteredCats = useMemo(() => {
    const res: Record<string, string[]> = {};
    for (const [cat, tags] of Object.entries(tagsByCat)) {
      const filtered = tagFilter ? tags.filter(t => t.includes(tagFilter.toLowerCase())) : tags;
      if (filtered.length > 0) res[cat] = filtered;
    }
    return res;
  }, [tagsByCat, tagFilter]);

  const toggleNode = (id: string) => {
    setSelectedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  };

  const handleApply = () => {
    const ids = selectedNodeIds.size === 0
      ? nodes.map(n => n.id)
      : Array.from(selectedNodeIds);
    onApplyTags(ids, Array.from(selectedTags));
    onClose();
  };

  const handleSelectAllNodes = () => {
    if (selectedNodeIds.size === nodes.length) {
      setSelectedNodeIds(new Set());
    } else {
      setSelectedNodeIds(new Set(nodes.map(n => n.id)));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-2xl bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-xl shadow-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgb(var(--border))]">
          <div className="flex items-center gap-2">
            <Tags className="w-4 h-4 text-[rgb(var(--accent))]" />
            <h2 className="text-[14px] font-semibold text-[rgb(var(--text-main))]">
              Tagowanie notatek
            </h2>
          </div>
          <button onClick={onClose} aria-label="Zamknij" className="p-1.5 rounded-lg text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--bg-elevated))] transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: node list */}
          <div className="w-1/2 border-r border-[rgb(var(--border))] flex flex-col">
            <div className="px-3 py-2 border-b border-[rgb(var(--border))] flex items-center gap-2">
              <button
                onClick={handleSelectAllNodes}
                className="text-[11px] text-[rgb(var(--accent))] hover:underline cursor-pointer"
              >
                {selectedNodeIds.size === nodes.length ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
              </button>
              <span className="text-[10px] text-[rgb(var(--text-muted))] ml-auto">
                {selectedNodeIds.size || nodes.length} / {nodes.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
              {nodes.map(node => (
                <button
                  key={node.id}
                  onClick={() => toggleNode(node.id)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors cursor-pointer ${
                    selectedNodeIds.has(node.id) || (selectedNodeIds.size === 0)
                      ? 'bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]'
                      : 'text-[rgb(var(--text-main))] hover:bg-[rgb(var(--bg-elevated))]'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                    selectedNodeIds.has(node.id) || (selectedNodeIds.size === 0)
                      ? 'bg-[rgb(var(--accent))] border-[rgb(var(--accent))]'
                      : 'border-[rgb(var(--border))]'
                  }`}>
                    {(selectedNodeIds.has(node.id) || (selectedNodeIds.size === 0)) && (
                      <Check className="w-2.5 h-2.5 text-black" />
                    )}
                  </span>
                  <span className="truncate flex-1">{node.title || '(bez tytułu)'}</span>
                  {node.tags && node.tags.length > 0 && (
                    <span className="text-[9px] text-[rgb(var(--text-muted))] shrink-0">
                      {node.tags.length} tagów
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right: tag selection */}
          <div className="w-1/2 flex flex-col">
            {/* Search */}
            <div className="px-3 py-2 border-b border-[rgb(var(--border))]">
              <div className="flex items-center gap-2 bg-[rgb(var(--bg-canvas))] rounded-lg px-2 py-1">
                <Search className="w-3.5 h-3.5 text-[rgb(var(--text-muted))]" />
                <input
                  value={tagFilter}
                  onChange={e => setTagFilter(e.target.value)}
                  placeholder="Filtruj tagi..."
                  className="flex-1 bg-transparent border-none outline-none text-[12px] text-[rgb(var(--text-main))] placeholder:text-[rgb(var(--text-muted))]"
                />
              </div>
            </div>

            {/* AI suggestions */}
            {suggestions.length > 0 && (
              <div className="px-3 py-2 border-b border-[rgb(var(--border))]">
                <div className="flex items-center gap-1 text-[10px] text-[rgb(var(--text-muted))] mb-1.5">
                  <Sparkles className="w-3 h-3" />
                  <span>Sugerowane</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map(s => (
                    <button
                      key={s.tag}
                      onClick={() => toggleTag(s.tag)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                        selectedTags.has(s.tag)
                          ? 'bg-[rgb(var(--accent))] text-black'
                          : 'bg-[rgb(var(--bg-elevated))] text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-main))]'
                      }`}
                    >
                      {s.tag} <span className="opacity-50">({s.score})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* All tags by category */}
            <div className="flex-1 overflow-y-auto custom-scrollbar py-2 px-3">
              {Object.entries(filteredCats).map(([cat, tags]) => (
                <div key={cat} className="mb-3">
                  <div className="text-[10px] font-medium text-[rgb(var(--text-muted))] uppercase tracking-wide mb-1">
                    {cat}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
                          selectedTags.has(tag)
                            ? 'bg-[rgb(var(--accent))] text-black font-medium'
                            : 'bg-[rgb(var(--bg-canvas))] text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-elevated))]'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[rgb(var(--border))]">
          <span className="text-[10px] text-[rgb(var(--text-muted))]">
            {selectedTags.size} tagów · {selectedNodeIds.size || nodes.length} notatek
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-[11px] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] transition-colors cursor-pointer"
            >
              Anuluj
            </button>
            <button
              onClick={handleApply}
              disabled={selectedTags.size === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-medium bg-[rgb(var(--accent))] text-black hover:opacity-90 transition-opacity disabled:opacity-30 cursor-pointer"
            >
              <Tags className="w-3.5 h-3.5" />
              Aplikuj tagi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
