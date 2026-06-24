// ============================================================================
// NEXUS — FolderPicker
// Prosty komponent do wybierania folderow z dysku (lista sciezek)
// ============================================================================

import React, { useState } from 'react';

// === Props =================================================================
interface FolderPickerProps {
  value: string[];
  onChange: (folders: string[]) => void;
}

// === Component =============================================================
export function FolderPicker({ value, onChange }: FolderPickerProps) {
  const [inputValue, setInputValue] = useState('');

  const addFolder = () => {
    const path = inputValue.trim();
    if (!path) return;
    if (!value.includes(path)) {
      onChange([...value, path]);
    }
    setInputValue('');
  };

  const removeFolder = (path: string) => {
    onChange(value.filter((f) => f !== path));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addFolder(); }}
          placeholder="Wpisz ścieżkę folderu..."
          className="flex-1 px-3 py-1.5 text-[12px] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-main))] placeholder:text-[rgb(var(--text-muted))] outline-none focus:border-[rgb(var(--accent))]/50 transition-colors"
        />
        <button
          onClick={addFolder}
          className="px-3 py-1.5 text-[12px] font-medium bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))] rounded-lg hover:bg-[rgb(var(--accent))]/25 transition-colors cursor-pointer"
        >
          Dodaj
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((folder) => (
            <span
              key={folder}
              className="px-2 py-0.5 text-[10px] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] text-[rgb(var(--text-muted))] rounded-full flex items-center gap-1 max-w-full"
            >
              <span className="truncate max-w-[180px]">{folder}</span>
              <button
                onClick={() => removeFolder(folder)}
                className="hover:text-[rgb(var(--danger))] cursor-pointer leading-none text-[14px] flex-shrink-0"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
