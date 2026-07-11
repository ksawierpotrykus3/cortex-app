/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [USER REQUEST 2026-07-11] Usunięto na zawsze widoki:
 * 'nexus', 'lab-todo', 'lab-writing', 'raw-fragments', 'logs', 'system'
 * NIE PRZYWRACAĆ dopóki użytkownik nie każe.
 * Zostają: 'projekty', 'useme', 'changes', 'wiki', 'git'
 */

import React, { useState, useEffect, useCallback } from "react";
import { TopNavigation } from "./components/TopNavigation";
import { WikiPanel } from "./components/WikiPanel";
import { GitPanel } from "./components/GitPanel";
import { SettingsModal } from "./components/SettingsModal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { UsemeContainer } from "./components/useme/UsemeContainer";
import { ExperimentalCanvas } from "./components/ExperimentalCanvas";
import { ViewMode, RightPanelState, ModalState, WikiArticle } from "./types";
import { DiffModal } from "./components/DiffModal";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";

export function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeView, setActiveView] = useState<ViewMode>("projekty");
  const [modal, setModal] = useState<ModalState>("none");
  const [geminiKey, setGeminiKey] = useState<string>("");
  const [wikiArticles, setWikiArticles] = useState<WikiArticle[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Init filesystem & load workspace
  useEffect(() => {
    let cancelled = false;
    import('./fs').then(async ({ initFS, loadWorkspace }) => {
      try {
        await initFS();
        if (cancelled) return;

        const state = await loadWorkspace();
        if (cancelled) return;

        setGeminiKey(state.geminiKey || "");
        setWikiArticles(state.wiki || []);
        setIsLoaded(true);
      } catch (err) {
        if (!cancelled) {
          console.warn('[App] Failed to load workspace:', err);
          setIsLoaded(true); // continue anyway
        }
      }
    }).catch((err) => {
      if (!cancelled) {
        console.warn('[App] Failed to load workspace module:', err);
        setIsLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Auto-save on changes
  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => {
      import('./store').then(({ saveWorkspace }) => {
        saveWorkspace({
          geminiKey,
          wiki: wikiArticles,
        });
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [geminiKey, wikiArticles, isLoaded]);

  // ? key for keyboard shortcuts overlay
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <ErrorBoundary>
    <div className="flex flex-col h-screen text-[rgb(var(--text-main))] overflow-hidden bg-[rgb(var(--background))]">
      <TopNavigation
        activeView={activeView}
        setActiveView={setActiveView}
        rightPanel={"none"}
        setRightPanel={() => {}}
        setModal={setModal}
        isSidebarOpen={false}
        setIsSidebarOpen={() => {}}
        onOpenTagDialog={undefined}
      />
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 overflow-hidden relative">
          {activeView === "useme" && <UsemeContainer />}
          {activeView === "projekty" && <ExperimentalCanvas />}
          {activeView === "changes" && (
            <div className="flex items-center justify-center h-full text-[rgb(var(--text-muted))] text-sm">
              Changes panel — do zaimplementowania
            </div>
          )}
          {activeView === "wiki" && (
            <WikiPanel
              articles={wikiArticles}
              onSave={(article) => {
                setWikiArticles((prev) => {
                  const idx = prev.findIndex((a) => a.id === article.id);
                  if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = article;
                    return next;
                  }
                  return [...prev, article];
                });
              }}
              onDelete={(id) => {
                setWikiArticles((prev) => prev.filter((a) => a.id !== id));
              }}
            />
          )}
          {activeView === "git" && <GitPanel />}
        </div>
      </div>

      <SettingsModal
        state={modal}
        onClose={() => setModal("none")}
        geminiKey={geminiKey}
        setGeminiKey={setGeminiKey}
      />

      <DiffModal
        open={false}
        onClose={() => {}}
        title=""
        currentContent=""
        snapshots={[]}
        onRevert={() => {}}
      />

      <KeyboardShortcuts
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
    </ErrorBoundary>
  );
}