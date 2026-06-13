import React from "react";
import { ExportScope } from "../types";

export type { ExportScope };
export { DEFAULT_EXPORT_SCOPE } from "../types";

export function ExportScopeSelector({
  scope,
  onChange,
  hasSelection,
  hasData = {},
}: {
  scope: ExportScope;
  onChange: (scope: ExportScope) => void;
  hasSelection: boolean;
  hasData?: {
    nodes?: boolean;
    tasks?: boolean;
    drafts?: boolean;
    links?: boolean;
    axioms?: boolean;
    images?: boolean;
  };
}) {
  const set = (key: keyof ExportScope, value: boolean) => {
    onChange({ ...scope, [key]: value });
  };

  const allSelected = (Object.keys(scope) as (keyof ExportScope)[])
    .filter((k) => k !== "onlySelected")
    .every((k) => scope[k] === true);

  const toggleAll = () => {
    const newVal = !allSelected;
    const updated: ExportScope = { ...scope };
    (Object.keys(updated) as (keyof ExportScope)[]).forEach((k) => {
      if (k !== "onlySelected") updated[k] = newVal;
    });
    onChange(updated);
  };

  const hasAnySelected = (Object.keys(scope) as (keyof ExportScope)[])
    .filter((k) => k !== "onlySelected")
    .some((k) => scope[k] === true);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-300">
          Zakres eksportu:
        </label>
        <button
          onClick={toggleAll}
          className="text-[11px] font-medium text-[rgb(var(--accent))] hover:underline cursor-pointer"
        >
          {allSelected ? "Odznacz wszystko" : "Zaznacz wszystko"}
        </button>
      </div>

      <div className="space-y-1.5">
        <CheckItem
          label="Notatki (nodes)"
          description="Węzły mapy myśli"
          checked={scope.nodes}
          onChange={(v) => set("nodes", v)}
          disabled={hasData.nodes === false}
          disabledReason="Brak notatek do eksportu"
        />
        <CheckItem
          label="Połączenia (links)"
          description="Krawędzie między węzłami"
          checked={scope.links}
          onChange={(v) => set("links", v)}
          disabled={hasData.links === false}
          disabledReason="Brak połączeń do eksportu"
        />
        <CheckItem
          label="Zadania (tasks)"
          description="Lista zadań z Lab-Todo"
          checked={scope.tasks}
          onChange={(v) => set("tasks", v)}
          disabled={hasData.tasks === false}
          disabledReason="Brak zadań do eksportu"
        />
        <CheckItem
          label="Manuskrypty (drafts)"
          description="Szkice z Lab-Writing"
          checked={scope.drafts}
          onChange={(v) => set("drafts", v)}
          disabled={hasData.drafts === false}
          disabledReason="Brak manuskryptów do eksportu"
        />
        <CheckItem
          label="Aksjomaty"
          description="Zasady i aksjomaty"
          checked={scope.axioms}
          onChange={(v) => set("axioms", v)}
          disabled={hasData.axioms === false}
          disabledReason="Brak aksjomatów do eksportu"
        />
        <CheckItem
          label="Obrazy (attachments)"
          description="Załączniki obrazów"
          checked={scope.images}
          onChange={(v) => set("images", v)}
          disabled={hasData.images === false}
          disabledReason="Brak obrazów do eksportu"
        />
      </div>

      {hasSelection && (
        <CheckItem
          label="Tylko zaznaczone na mapie"
          description="Eksportuj tylko wybrane węzły"
          checked={scope.onlySelected}
          onChange={(v) => set("onlySelected", v)}
        />
      )}

      {!hasAnySelected && (
        <p className="text-[12px] text-red-400 mt-2">
          Wybierz co najmniej jedną kategorię do eksportu.
        </p>
      )}
    </div>
  );
}

function CheckItem({
  label,
  description,
  checked,
  onChange,
  disabled,
  disabledReason,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {

  return (
    <div className="relative group">
      <label
        className={`flex items-center gap-2.5 py-1 px-2 rounded-md transition-colors ${
          disabled
            ? "opacity-40 cursor-not-allowed"
            : "cursor-pointer hover:bg-[rgb(var(--background))]"
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
            checked && !disabled
              ? "bg-[rgb(var(--accent))] border-[rgb(var(--accent))]"
              : disabled
                ? "border-gray-600"
                : "border-gray-500 group-hover:border-gray-400"
          }`}
          aria-hidden="true"
        >
          {checked && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path
                d="M2 5l2 2 4-4"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        <div className="flex flex-col">
          <span
            className={`text-[13px] transition-colors select-none ${
              disabled ? "text-gray-500" : "text-gray-300 group-hover:text-white"
            }`}
          >
            {label}
          </span>
          {description && (
            <span className="text-[11px] text-gray-500 select-none">
              {description}
            </span>
          )}
        </div>
      </label>
      {disabled && disabledReason && (
        <div className="absolute left-0 -bottom-6 z-10 hidden group-hover:block">
          <div className="bg-gray-800 text-gray-300 text-[11px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
            {disabledReason}
          </div>
        </div>
      )}
    </div>
  );
}
