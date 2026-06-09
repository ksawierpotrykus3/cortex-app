import React, { useState, useEffect } from "react";
import { X, Save, HardDrive, Unplug } from "lucide-react";
import { ModalState } from "../types";
import { del } from "idb-keyval";

export function SettingsModal({
  state,
  onClose,
  geminiKey,
  setGeminiKey,
}: {
  state: ModalState;
  onClose: () => void;
  geminiKey?: string;
  setGeminiKey?: (key: string) => void;
}) {
  if (state !== "settings") return null;

  const handleSave = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-xl shadow-2xl w-[500px] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border))]">
          <h2 className="text-lg font-bold text-white tracking-wide">
            Settings & Extensions
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              Gemini API Key (For Vision/OCR)
            </label>
            <input 
               type="password"
               value={geminiKey || ""}
               onChange={(e) => setGeminiKey?.(e.target.value)}
               placeholder="AI Studio API Key"
               className="w-full bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-gray-500 transition-colors"
            />
            <p className="text-[11px] text-[rgb(var(--text-muted))] mt-1">
              Required for image processing and external AI agent behavior. Stored locally.
            </p>
          </div>

          <div className="pt-6 border-t border-[rgb(var(--border))]">
             <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-1">
                    <HardDrive className="w-4 h-4 text-emerald-500" />
                    Local File System
                  </h3>
                  <p className="text-[11px] text-[rgb(var(--text-muted))]">
                    Disconnect if your folder handle expired or you want to choose a new location.
                  </p>
                </div>
                <button 
                  onClick={async () => {
                     await del('nexus_dir_handle');
                     window.location.reload();
                  }}
                  className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/30 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-2 transition-all"
                >
                   <Unplug className="w-3.5 h-3.5" />
                   Reset File Connection
                </button>
             </div>
          </div>
        </div>

        <div className="p-4 border-t border-[rgb(var(--border))] flex justify-end gap-3 bg-[rgb(var(--panel))]/30">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[rgb(var(--text-muted))] hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
             onClick={handleSave}
             className="px-4 py-2 rounded-lg text-sm font-medium bg-[rgb(var(--accent))] text-black hover:bg-[rgb(var(--accent))]/90 transition-colors cursor-pointer flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
