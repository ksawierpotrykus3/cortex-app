// ============================================================================
// NEXUS — Prompt Editor (Phase 1)
// Edytor prompta z miejscami na zmienne: {{SCHOWEK}}, {{INPUT}}, {{DATA}} itp.
// ============================================================================

import React, { useRef } from 'react';
import { Clipboard, Calendar, Clock, FileText, Image, Variable, HelpCircle } from 'lucide-react';

// === Variables list ========================================================
const VARIABLE_BUTTONS = [
  { label: 'SCHOWEK', icon: Clipboard, value: '{{SCHOWEK}}', tooltip: 'Zawartość schowka' },
  { label: 'DATA', icon: Calendar, value: '{{DATA}}', tooltip: 'Dzisiejsza data' },
  { label: 'CZAS', icon: Clock, value: '{{CZAS}}', tooltip: 'Aktualny czas' },
  { label: 'INPUT:plik', icon: FileText, value: '{{INPUT:ścieżka/do/pliku}}', tooltip: 'Zawartość pliku' },
  { label: 'SCREENSHOT', icon: Image, value: '{{SCREENSHOT}}', tooltip: 'Ostatni zrzut ekranu' },
  { label: 'TEXT:nazwa', icon: Variable, value: '{{TEXT:}}', tooltip: 'Pole tekstowe' },
];

// === Props =================================================================
interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
}

// === Component =============================================================
export function PromptEditor({ value, onChange }: PromptEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showHelp, setShowHelp] = React.useState(false);

  const insertVariable = (varText: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.substring(0, start) + varText + value.substring(end);
    onChange(newValue);

    // Restore cursor position after variable
    setTimeout(() => {
      textarea.focus();
      const cursorPos = start + varText.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-[11px] font-medium text-[rgb(var(--text-secondary))] uppercase tracking-wider">
          Prompt
        </label>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text))] transition-colors cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Help tooltip */}
      {showHelp && (
        <div className="mb-2 p-3 bg-[rgb(var(--bg-elevated))] border border-[rgb(var(--border))] rounded-lg text-[11px] text-[rgb(var(--text-secondary))] space-y-1">
          <p className="font-medium text-[rgb(var(--text))] mb-1">Zmienne w promptach:</p>
          {VARIABLE_BUTTONS.map((v) => (
            <p key={v.label}>
              <code className="text-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10 px-1 rounded text-[10px]">{v.value}</code>
              {' — '}{v.tooltip}
            </p>
          ))}
          <p className="mt-1 text-[10px] opacity-70">
            Kliknij zmienną niżej aby wstawić. Zaznacz tekst w prompcie i kliknij zmienną aby zastąpić.
          </p>
        </div>
      )}

      {/* Variable buttons */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {VARIABLE_BUTTONS.map((v) => (
          <button
            key={v.label}
            onClick={() => insertVariable(v.value)}
            className="px-2 py-1 rounded-lg text-[10px] font-medium bg-[rgb(var(--bg-elevated))] border border-[rgb(var(--border))] text-[rgb(var(--text-secondary))] hover:border-[rgb(var(--accent))]/30 hover:text-[rgb(var(--accent))] transition-colors flex items-center gap-1 cursor-pointer"
            title={v.tooltip}
          >
            <v.icon className="w-3 h-3" />
            {v.label}
          </button>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-40 px-3 py-2.5 text-[13px] leading-relaxed bg-[rgb(var(--bg-elevated))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-secondary))] outline-none focus:border-[rgb(var(--accent))]/50 transition-colors resize-y font-mono custom-scrollbar"
        placeholder="Napisz prompt dla agenta...
Użyj {{SCHOWEK}} aby wstawić zawartość schowka."
        spellCheck={false}
      />

      {/* Character count */}
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-[rgb(var(--text-muted))]">
          {value.length} znaków
        </span>
        <span className="text-[10px] text-[rgb(var(--text-muted))]">
          {(value.match(/\{\{SCHOWEK\}\}/g) || []).length}× {'{{SCHOWEK}}'}
        </span>
      </div>
    </div>
  );
}
