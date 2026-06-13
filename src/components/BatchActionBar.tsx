// ============================================================================
// NEXUS — BatchActionBar
// Floating toolbar nad płótnem gdy zaznaczono wiele nodów
// ============================================================================

import React, { useState } from 'react';
import { Trash2, Download, FolderInput, X, Copy } from 'lucide-react';
import { NexusNode } from '../types';

interface BatchActionBarProps {
  selectedIds: string[];
  nodes: NexusNode[];
  onDelete: (ids: string[]) => void;
  onExport: (nodes: NexusNode[]) => void;
  onAssignProject: (ids: string[], projectId: string) => void;
  onClear: () => void;
  onDuplicate?: (ids: string[]) => void;
  projects: { id: string; name: string }[];
}

export function BatchActionBar({
  selectedIds,
  nodes,
  onDelete,
  onExport,
  onAssignProject,
  onClear,
  onDuplicate,
  projects,
}: BatchActionBarProps) {
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  if (selectedIds.length === 0) return null;

  const selectedNodes = nodes.filter(n => selectedIds.includes(n.id));

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center gap-2 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl shadow-2xl px-3 py-2">
        {/* Selection count */}
        <span className="text-[12px] font-medium text-[rgb(var(--text-main))] px-2 min-w-[3rem]">
          {selectedIds.length} wybranych
        </span>

        <div className="w-px h-5 bg-[rgb(var(--border))]" />

        {/* Delete */}
        <button
          onClick={() => {
            if (confirm(`Usunąć ${selectedIds.length} notatek?`)) {
              onDelete(selectedIds);
            }
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
          title="Usuń zaznaczone"
        >
          <Trash2 size={14} />
          <span>Usuń</span>
        </button>

        {/* Export */}
        <button
          onClick={() => onExport(selectedNodes)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[rgb(var(--text-main))] hover:bg-[rgb(var(--border))] rounded-lg transition-colors cursor-pointer"
          title="Eksportuj zaznaczone"
        >
          <Download size={14} />
          <span>Eksport</span>
        </button>

        {/* Assign project */}
        <div className="relative">
          <button
            onClick={() => setShowProjectPicker(!showProjectPicker)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[rgb(var(--text-main))] hover:bg-[rgb(var(--border))] rounded-lg transition-colors cursor-pointer"
            title="Przypisz do projektu"
          >
            <FolderInput size={14} />
            <span>Projekt</span>
          </button>

          {showProjectPicker && (
            <div className="absolute bottom-full left-0 mb-2 w-48 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl shadow-2xl py-1 max-h-48 overflow-y-auto custom-scrollbar">
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => { onAssignProject(selectedIds, p.id); setShowProjectPicker(false); }}
                  className="w-full px-3 py-1.5 text-[12px] text-left text-[rgb(var(--text-main))] hover:bg-[rgb(var(--border))] transition-colors cursor-pointer"
                >
                  {p.name}
                </button>
              ))}
              <button
                onClick={() => { onAssignProject(selectedIds, ''); setShowProjectPicker(false); }}
                className="w-full px-3 py-1.5 text-[12px] text-left text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--border))] transition-colors cursor-pointer border-t border-[rgb(var(--border))]"
              >
                ✕ Usuń z projektu
              </button>
            </div>
          )}
        </div>

        {/* Duplicate */}
        {onDuplicate && (
          <button
            onClick={() => onDuplicate(selectedIds)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[rgb(var(--text-main))] hover:bg-[rgb(var(--border))] rounded-lg transition-colors cursor-pointer"
            title="Duplikuj"
          >
            <Copy size={14} />
            <span>Duplikuj</span>
          </button>
        )}

        <div className="w-px h-5 bg-[rgb(var(--border))]" />

        {/* Clear selection */}
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--border))] rounded-lg transition-colors cursor-pointer"
          title="Odznacz wszystkie"
        >
          <X size={14} />
          <span>Odznacz</span>
        </button>
      </div>
    </div>
  );
}
