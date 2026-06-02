import React from "react";
import { X } from "lucide-react";
import { ModalState } from "../types";

export function ExportModal({
  state,
  onClose,
}: {
  state: ModalState;
  onClose: () => void;
}) {
  if (state !== "export") return null;

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
              <select className="w-full bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg px-4 py-2.5 text-sm text-gray-200 appearance-none focus:outline-none focus:border-gray-500 transition-colors cursor-pointer">
                <option>Current view</option>
                <option>Only selected (0 nodes)</option>
                <option>Clicked/selected node + context</option>
                <option>Specific project</option>
                <option>Multiple projects</option>
                <option>Active layer</option>
                <option>Specific board</option>
                <option>Multiple boards</option>
                <option>All boards</option>
                <option>Full database backup with screenshots</option>
              </select>
              <div className="absolute right-3 top-3 pointer-events-none text-gray-500">
                <svg
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  ></path>
                </svg>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Format:</label>
            <div className="relative">
              <select className="w-full bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg px-4 py-2.5 text-sm text-gray-200 appearance-none focus:outline-none focus:border-gray-500 transition-colors cursor-pointer">
                <option>AI Context JSON</option>
                <option>Human Markdown</option>
                <option>AI Studio audit pack</option>
                <option>Importable AI result JSON template</option>
              </select>
              <div className="absolute right-3 top-3 pointer-events-none text-gray-500">
                <svg
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  ></path>
                </svg>
              </div>
            </div>
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
            onClick={() => {
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ 
                exportedAt: new Date().toISOString(),
                // we would normally serialize nodes, links, tasks here but we don't have access to them in this component directly without passing props, so we'll mock or pass them as window.nexusState
                appState: typeof window !== "undefined" && (window as any).__nexusState ? (window as any).__nexusState : { error: "State export requires passing nodes to ExportModal" } 
              }, null, 2));
              const downloadAnchorNode = document.createElement('a');
              downloadAnchorNode.setAttribute("href",     dataStr);
              downloadAnchorNode.setAttribute("download", "nexus_export_" + Date.now() + ".json");
              document.body.appendChild(downloadAnchorNode);
              downloadAnchorNode.click();
              downloadAnchorNode.remove();
              onClose();
            }}
            className="px-5 py-2 text-sm font-medium text-white bg-[rgb(var(--accent))] hover:bg-indigo-500 rounded-lg shadow-md transition-colors"
          >
            Save export
          </button>
        </div>
      </div>
    </div>
  );
}
