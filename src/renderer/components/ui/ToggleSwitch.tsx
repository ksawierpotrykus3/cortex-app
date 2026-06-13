// ============================================================================
// NEXUS — Toggle Switch (UI atom)
// Minimalistyczny przełącznik dwustanowy — bez labelki, tylko komponent wizualny
// ============================================================================

import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
  disabled?: boolean;
}

export function ToggleSwitch({ checked, onChange, ariaLabel, disabled = false }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onChange}
      className={`
        relative inline-flex h-4 w-7 shrink-0 items-center rounded-full
        transition-all duration-150 ease-out
        ${disabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'}
        ${checked
          ? 'bg-[rgb(var(--accent))]'
          : 'bg-[rgb(var(--text-tertiary))]'
        }
      `}
    >
      <span
        className={`
          inline-block h-2.5 w-2.5 rounded-full bg-white
          transition-transform duration-150 ease-out
          ${checked ? 'translate-x-[16px]' : 'translate-x-[3px]'}
        `}
      />
    </button>
  );
}
