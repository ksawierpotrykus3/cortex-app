import React, { useState, useEffect, useRef } from "react";
import { X, Save, HardDrive, Unplug, GitBranch } from "lucide-react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { ModalState } from "../types";
import { del } from "idb-keyval";
import { GitSettingsPanel } from "./GitSettingsPanel";

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
  const focusTrapRef = useFocusTrap(state === "settings");

  if (state !== "settings") return null;

  const [activeTab, setActiveTab] = useState<'general' | 'git'>('general');
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer na wypadek odmontowania
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSaveClick = () => {
    setSaved(true);
    timerRef.current = setTimeout(() => {
      onClose();
    }, 800);
  };

  const tabs = [
    { id: 'general' as const, label: 'General', icon: HardDrive },
    { id: 'git' as const, label: 'Git', icon: GitBranch },
  ];

  return (
    <div ref={focusTrapRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label="Ustawienia" className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-xl shadow-2xl w-[500px] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border))]">
          <h2 className="text-lg font-bold text-[rgb(var(--text-main))] tracking-wide">
            Settings & Extensions
          </h2>
          <button
            onClick={onClose}
            aria-label="Zamknij"
            className="text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[rgb(var(--border))] px-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'border-[rgb(var(--accent))] text-[rgb(var(--accent))]'
                  : 'border-transparent text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-secondary))]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {activeTab === 'general' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[rgb(var(--text-secondary))]">
                  Gemini API Key (For Vision/OCR)
                </label>
                <input 
                  type="password"
                  value={geminiKey || ""}
                  onChange={(e) => setGeminiKey?.(e.target.value)}
                  placeholder="AI Studio API Key"
                  className="w-full bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg px-4 py-2 text-sm text-[rgb(var(--text-main))] focus:outline-none focus:border-[rgb(var(--text-secondary))] transition-colors"
                />
                <p className="text-[11px] text-[rgb(var(--text-muted))] mt-1">
                  Required for image processing and external AI agent behavior. Stored locally.
                </p>
              </div>

              <div className="pt-6 border-t border-[rgb(var(--border))]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-[rgb(var(--text-secondary))] flex items-center gap-2 mb-1">
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
            </>
          )}

          {activeTab === 'git' && (
            <GitSettingsPanel />
          )}
        </div>

        <div className="p-4 border-t border-[rgb(var(--border))] flex justify-end gap-3 bg-[rgb(var(--panel))]/30">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
             onClick={handleSaveClick}
             className="px-4 py-2 rounded-lg text-sm font-medium bg-[rgb(var(--accent))] text-black hover:bg-[rgb(var(--accent))]/90 transition-colors cursor-pointer flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
