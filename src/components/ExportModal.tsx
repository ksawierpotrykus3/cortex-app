import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ModalState, NexusNode, NexusLink, Task, WritingDraft, ExportScope, DEFAULT_EXPORT_SCOPE, ViewMode } from "../types";
import { generateAIExport, downloadFile, generateExportFilename, getExportPreset, TaskExport, DraftExport } from "../exportEngine";
import { ExportScopeSelector } from "./ExportScopeSelector";
import { useFocusTrap } from "../hooks/useFocusTrap";

export function ExportModal({
  state,
  onClose,
  nodes,
  links,
  axioms,
  scopeFromView,
  selectedNodeIds,
  tasks,
  drafts,
}: {
  state: ModalState;
  onClose: () => void;
  nodes: NexusNode[];
  links: NexusLink[];
  axioms: string;
  scopeFromView?: ViewMode;
  selectedNodeIds?: string[];
  tasks?: Task[];
  drafts?: WritingDraft[];
}) {
  // Pobierz preset dla aktualnego widoku
  const [exportScope, setExportScope] = useState<ExportScope>({ ...DEFAULT_EXPORT_SCOPE });
  const [filename, setFilename] = useState("");
  const isFilenameEdited = useRef(false);

  // Reset gdy modal się otwiera; nie nadpisuj ręcznie edytowanej nazwy przy zmianie scopeFromView
  useEffect(() => {
    if (state === "export") {
      const preset = getExportPreset(scopeFromView);
      setExportScope({ ...preset.scope });
      if (!isFilenameEdited.current) {
        setFilename(generateExportFilename(preset.label));
      }
    } else {
      // Reset flagi gdy modal się zamyka
      isFilenameEdited.current = false;
    }
  }, [state, scopeFromView]);

  // Determinisityczne hasData — które kategorie mają dane
  const hasData = {
    nodes: nodes.length > 0,
    links: links.length > 0,
    tasks: (tasks && tasks.length > 0) || false,
    drafts: (drafts && drafts.length > 0) || false,
    axioms: axioms.trim().length > 0,
    images: nodes.some((n) => n.imageAttachments && n.imageAttachments.length > 0) || false,
  };

  const hasAnySelected = (Object.keys(exportScope) as (keyof ExportScope)[])
    .filter((k) => k !== "onlySelected")
    .some((k) => exportScope[k] === true);

  const focusTrapRef = useFocusTrap(state === "export");

  if (state !== "export") return null;

  const handleSave = () => {
    if (!hasAnySelected) return;

    let selectedNodes = nodes;
    if (exportScope.onlySelected && selectedNodeIds && selectedNodeIds.length > 0) {
      selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
    }

    const exportTasks: TaskExport[] | undefined = tasks?.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
    }));

    const exportDrafts: DraftExport[] | undefined = drafts?.map((d) => ({
      id: d.id,
      title: `Draft ${d.id.slice(0, 6)}`,
      content: d.content,
      status: "draft",
      folderId: d.folderId,
    }));

    const exportData = generateAIExport(
      selectedNodes, links, axioms,
      exportScope, exportTasks, exportDrafts
    );

    const finalFilename = filename.trim() || generateExportFilename("nexus");
    downloadFile(exportData, finalFilename);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="Eksportuj" className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-xl shadow-2xl w-[520px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border))]">
          <h2 className="text-lg font-bold text-[rgb(var(--text-main))] tracking-wide">
            Export Builder
          </h2>
          <button
            onClick={onClose}
            aria-label="Zamknij"
            className="text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 flex-1">
          {/* Nazwa pliku */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[rgb(var(--text-secondary))]">
              Nazwa pliku:
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => {
                isFilenameEdited.current = true;
                setFilename(e.target.value);
              }}
              className="w-full px-3 py-2 text-[13px] bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg text-[rgb(var(--text-main))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:border-[rgb(var(--accent))] transition-colors"
              placeholder="nazwa_pliku.json"
            />
            <p className="text-[11px] text-[rgb(var(--text-muted))]">
              Plik zostanie zapisany jako JSON z rozszerzeniem .json
            </p>
          </div>

          <ExportScopeSelector
            scope={exportScope}
            onChange={setExportScope}
            hasSelection={!!(selectedNodeIds && selectedNodeIds.length > 0)}
            hasData={hasData}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[rgb(var(--border))] flex justify-end gap-3 bg-[rgb(var(--panel))]/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasAnySelected}
            className={`px-5 py-2 text-sm font-medium text-white rounded-lg shadow-md transition-colors ${
              hasAnySelected
                ? "bg-[rgb(var(--accent))] hover:bg-indigo-500 cursor-pointer"
                : "bg-[rgb(var(--text-muted))] cursor-not-allowed opacity-50"
            }`}
          >
            Eksportuj
          </button>
        </div>
      </div>
    </div>
  );
}
