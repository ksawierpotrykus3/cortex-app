import React, { useState } from "react";
import { X } from "lucide-react";
import { ModalState, NexusNode, NexusLink } from "../types";
import { generateAIExport, downloadFile } from "../exportEngine";

export function ExportModal({
  state,
  onClose,
  nodes,
  links,
  axioms
}: {
  state: ModalState;
  onClose: () => void;
  nodes: NexusNode[];
  links: NexusLink[];
  axioms: string;
}) {
  const [scope, setScope] = useState<string>("All nodes");

  if (state !== "export") return null;

  const handleSave = () => {
    let selectedNodes = nodes;
    
    if (scope === "Uncategorized") {
      selectedNodes = nodes.filter(n => !n.projectId || n.projectId === 'Uncategorized');
    }

    const exportData = generateAIExport(selectedNodes, links, axioms);
    downloadFile(exportData, `nexus_context_${new Date().toISOString().split('T')[0]}.json`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-xl shadow-2xl w-[500px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border))]">
          <h2 className="text-lg font-bold text-white tracking-wide">
            Export Builder
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 flex-1">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              Export scope:
            </label>
            <div className="relative">
              <select 
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="w-full bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg px-4 py-2.5 text-sm text-gray-200 appearance-none focus:outline-none focus:border-gray-500 transition-colors cursor-pointer"
              >
                <option value="All nodes">Full Global Context (All Nodes & Topology)</option>
                <option value="Uncategorized">Only Uncategorized / Fragments</option>
              </select>
              <div className="absolute right-3 top-3 pointer-events-none text-gray-500">
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Note: A highly-optimized, token-efficient system context will be generated for AI ingestion.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[rgb(var(--border))] flex justify-end gap-3 bg-[rgb(var(--panel))]/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-sm font-medium text-white bg-[rgb(var(--accent))] hover:bg-indigo-500 rounded-lg shadow-md transition-colors"
          >
            Save export
          </button>
        </div>
      </div>
    </div>
  );
}
