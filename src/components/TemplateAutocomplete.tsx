// ============================================================================
// NEXUS — TemplateAutocomplete
// Dropdown z dostępnymi zmiennymi template'owymi dla PipelineEditor i WorkflowEditor
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Dostępne zmienne template'owe dla każdego kontekstu
 */
const TEMPLATE_VARS = {
  pipeline: [
    { label: '{{output.content}}', description: 'Treść outputu poprzedniego noda' },
    { label: '{{output.id}}', description: 'ID noda który wyprodukował output' },
    { label: '{{output.tokens}}', description: 'Liczba tokenów w outputcie' },
    { label: '{{pipeline.id}}', description: 'ID bieżącego pipeline\'u' },
    { label: '{{pipeline.name}}', description: 'Nazwa pipeline\'u' },
    { label: '{{agent.name}}', description: 'Nazwa agenta który wykonuje noda' },
    { label: '{{date}}', description: 'Bieżąca data (YYYY-MM-DD)' },
    { label: '{{time}}', description: 'Bieżący czas (HH:mm)' },
    { label: '{{now}}', description: 'Pełny timestamp ISO' },
    { label: '{{nl}}', description: 'Znak nowej linii (\n)' },
  ],
  workflow: [
    { label: '{{output.content}}', description: 'Treść outputu agenta' },
    { label: '{{output.rating}}', description: 'Rating (1-10)' },
    { label: '{{output.id}}', description: 'ID outputu' },
    { label: '{{agent.name}}', description: 'Nazwa agenta' },
    { label: '{{agent.id}}', description: 'ID agenta' },
    { label: '{{date}}', description: 'Bieżąca data' },
    { label: '{{time}}', description: 'Bieżący czas' },
    { label: '{{now}}', description: 'Pełny timestamp ISO' },
    { label: '{{trigger.type}}', description: 'Typ triggera' },
    { label: '{{nl}}', description: 'Znak nowej linii (\n)' },
  ],
};

type TemplateContext = keyof typeof TEMPLATE_VARS;

interface TemplateAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  context: TemplateContext;
  placeholder?: string;
  className?: string;
  rows?: number;
}

export function TemplateAutocomplete({
  value,
  onChange,
  context,
  placeholder,
  className,
  rows = 2,
}: TemplateAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredVars, setFilteredVars] = useState(TEMPLATE_VARS[context]);
  const [cursorPos, setCursorPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const vars = TEMPLATE_VARS[context];

  // Filter variables based on text before cursor
  const updateSuggestions = useCallback((text: string, pos: number) => {
    const beforeCursor = text.slice(0, pos);
    const lastOpen = beforeCursor.lastIndexOf('{{');
    const lastClose = beforeCursor.lastIndexOf('}}');

    // Show suggestions only if we have an open `{{` after last `}}`
    if (lastOpen > lastClose) {
      const partial = beforeCursor.slice(lastOpen + 2);
      const filtered = vars.filter(v =>
        v.label.toLowerCase().includes(partial.toLowerCase())
      );
      setFilteredVars(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [vars]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const pos = e.target.selectionStart;
    onChange(newValue);
    setCursorPos(pos);
    updateSuggestions(newValue, pos);
  };

  const handleSelect = (v: typeof vars[0]) => {
    const before = value.slice(0, cursorPos);
    const after = value.slice(cursorPos);
    const lastOpen = before.lastIndexOf('{{');
    const beforeVar = before.slice(0, lastOpen);
    const newValue = beforeVar + v.label + after;
    onChange(newValue);
    setShowSuggestions(false);
    // Focus back the textarea
    setTimeout(() => {
      textareaRef.current?.focus();
      const newPos = beforeVar.length + v.label.length;
      textareaRef.current?.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Keyboard navigation
  const [selectedIdx, setSelectedIdx] = useState(0);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, filteredVars.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filteredVars[selectedIdx]) {
        e.preventDefault();
        handleSelect(filteredVars[selectedIdx]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIdx(0);
  }, [filteredVars.length]);

  return (
    <div className="relative" onPointerDown={e => e.stopPropagation()}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={(e) => {
          const pos = (e.target as HTMLTextAreaElement).selectionStart;
          setCursorPos(pos);
          updateSuggestions(value, pos);
        }}
        onClick={() => {
          const pos = textareaRef.current?.selectionStart ?? 0;
          setCursorPos(pos);
          updateSuggestions(value, pos);
        }}
        placeholder={placeholder}
        className={className || 'w-full bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-[11px] font-mono outline-none resize-none'}
        rows={rows}
      />

      {showSuggestions && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 right-0 mb-1 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl shadow-2xl overflow-hidden z-50"
        >
          <div className="text-[9px] text-[rgb(var(--text-muted))] px-3 py-1 border-b border-[rgb(var(--border))] uppercase tracking-wider">
            Zmienne template'owe
          </div>
          <div className="max-h-40 overflow-y-auto custom-scrollbar">
            {filteredVars.map((v, i) => (
              <button
                key={v.label}
                onClick={() => handleSelect(v)}
                onMouseEnter={() => setSelectedIdx(i)}
                className={`w-full flex items-center gap-3 px-3 py-1.5 text-left transition-colors cursor-pointer ${
                  i === selectedIdx
                    ? 'bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]'
                    : 'text-[rgb(var(--text-main))] hover:bg-[rgb(var(--bg-elevated))]'
                }`}
              >
                <code className="text-[11px] font-mono font-medium shrink-0">
                  {v.label}
                </code>
                <span className="text-[10px] text-[rgb(var(--text-muted))] truncate">
                  {v.description}
                </span>
              </button>
            ))}
          </div>
          <div className="text-[9px] text-[rgb(var(--text-muted))] px-3 py-1 border-t border-[rgb(var(--border))] flex gap-3">
            <span>↑↓ nawiguj</span>
            <span>↵/Tab wstaw</span>
            <span>Esc zamknij</span>
          </div>
        </div>
      )}
    </div>
  );
}
