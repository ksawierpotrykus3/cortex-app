// ============================================================================
// NEXUS — AtMentionAutocomplete
// Wstrzykiwanie @ w chatach: gdy użytkownik wpisze @, pokazuje listę
// Wiki, Agentów, Notatek, Tasków do wstrzyknięcia jako kontekst.
// Wybrany element jest wstawiany jako {{WIKI:tytul}} / {{AGENT:nazwa}} itd.
// ============================================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import { BookOpen, Bot, FileText, CheckSquare } from "lucide-react";

// ============================================================================
// Typy
// ============================================================================
export interface MentionableItem {
  id: string;
  type: 'wiki' | 'agent' | 'note' | 'task';
  label: string;
  subtitle?: string;
  content?: string; // pełny tekst do wstrzyknięcia
}

interface AtMentionAutocompleteProps {
  /** Lista wszystkich elementów do podpowiadania */
  items: MentionableItem[];
  /** Aktualna wartość inputu */
  value: string;
  /** Callback gdy użytkownik wybierze element */
  onSelect: (item: MentionableItem) => string; // zwraca nową wartość inputu
  /** Czy autocomplete jest aktywne */
  enabled?: boolean;
}

// ============================================================================
// Komponent
// ============================================================================
export function AtMentionAutocomplete({
  items,
  value,
  onSelect,
  enabled = true,
}: AtMentionAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Detect @ mention
  useEffect(() => {
    if (!enabled) { setIsOpen(false); return; }

    // Find the @ token at cursor position
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([\w\s\-ąćęłńóśźż]*)$/);

    if (atMatch) {
      const query = atMatch[1].toLowerCase();
      setFilter(query);
      setSelectedIndex(0);
      setIsOpen(items.some(i =>
        i.label.toLowerCase().includes(query) ||
        i.type.toLowerCase().includes(query)
      ));
    } else {
      setIsOpen(false);
    }
  }, [value, cursorPos, items, enabled]);

  // Filter items
  const filtered = items.filter(i => {
    const q = filter;
    if (!q) return true;
    return i.label.toLowerCase().includes(q) ||
      i.type.toLowerCase().includes(q) ||
      (i.subtitle && i.subtitle.toLowerCase().includes(q));
  }).slice(0, 10);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filtered[selectedIndex]) {
          e.preventDefault();
          handleSelect(filtered[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, filtered, selectedIndex]);

  const handleSelect = useCallback((item: MentionableItem) => {
    // Replace @query with the reference
    const textBeforeCursor = value.slice(0, cursorPos);
    const textAfterCursor = value.slice(cursorPos);
    const atIdx = textBeforeCursor.lastIndexOf('@');
    if (atIdx < 0) return;

    const before = textBeforeCursor.slice(0, atIdx);
    const ref = `@${item.type}:${item.label} `;
    const newValue = before + ref + textAfterCursor;
    setIsOpen(false);

    // Call parent to update
    const result = onSelect(item);
    return result || newValue;
  }, [value, cursorPos, onSelect]);

  const iconForType = (type: string) => {
    switch (type) {
      case 'wiki': return <BookOpen size={11} className="text-blue-400" />;
      case 'agent': return <Bot size={11} className="text-purple-400" />;
      case 'note': return <FileText size={11} className="text-green-400" />;
      case 'task': return <CheckSquare size={11} className="text-amber-400" />;
      default: return null;
    }
  };

  if (!isOpen || filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-[rgb(var(--panel))] border border-[rgb(var(--accent))]/30 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
      <div className="px-2.5 py-1 text-[9px] font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wide border-b border-[rgb(var(--border))]">
        Wstrzyknij kontekst (@)
      </div>
      {filtered.map((item, i) => (
        <button
          key={`${item.type}:${item.id}`}
          onClick={() => handleSelect(item)}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left cursor-pointer transition-colors ${
            i === selectedIndex
              ? 'bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]'
              : 'text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--border))]/10'
          }`}
        >
          {iconForType(item.type)}
          <div className="flex-1 min-w-0">
            <div className="truncate font-medium">{item.label}</div>
            {item.subtitle && (
              <div className="text-[9px] text-[rgb(var(--text-muted))] truncate">{item.subtitle}</div>
            )}
          </div>
          <span className="text-[8px] text-[rgb(var(--text-muted))] bg-[rgb(var(--border))]/20 px-1 rounded shrink-0">
            {item.type}
          </span>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Helper: extract @@ references from text and resolve content
// ============================================================================
export function resolveAtReferences(
  text: string,
  items: MentionableItem[],
): { resolvedText: string; references: MentionableItem[] } {
  const references: MentionableItem[] = [];
  let resolved = text;

  // Match @type:label pattern
  const regex = /@(\w+):([\w\s\-ąćęłńóśźż]+)/g;
  resolved = resolved.replace(regex, (match, type, label) => {
    const item = items.find(i =>
      i.type === type &&
      i.label.toLowerCase() === label.trim().toLowerCase()
    );
    if (item) {
      references.push(item);
      return item.content || `[${item.type}: ${item.label}]`;
    }
    return match;
  });

  return { resolvedText: resolved, references };
}