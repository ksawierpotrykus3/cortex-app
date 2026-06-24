// ============================================================================
// NEXUS — useContextTracker
// Jeden hook do sledzenia wszystkiego co uzytkownik widzi i robi.
// Uzywany przez Feedback, FloatingAgent, ContextBar — wszedzie ta sama logika.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { ViewMode } from '../types';

export interface TrackerState {
  /** Glowny widok (nexus, git, agents, feedback, itp) */
  view: ViewMode;
  /** Podzakladka wewnatrz widoku (np. 'general' w agents, 'status' w git) */
  subView: string;
  /** Tytul notatki/node'a jesli wybrany */
  nodeTitle: string | null;
  /** Zaznaczony tekst */
  selectedText: string;
  /** Zawartosc schowka */
  clipboardContent: string;
  /** Ostatnia akcja (dla czytelnosci) */
  lastAction: string;
  /** Czytelny opis pelnej sciezki */
  label: string;
}

type SubViewMap = Record<string, string>;

/** Znane podzakladki dla kazdego widoku */
const SUB_VIEWS: Record<string, SubViewMap> = {
  agents: {
    general: 'Ogolne',
    context: 'Kontekst',
    triggers: 'Triggers',
    permissions: 'Uprawnienia',
  },
  git: {
    status: 'Status',
    log: 'Historia',
    branches: 'Galezie',
  },
  feedback: {
    all: 'Wszystkie',
    idea: 'Pomysly',
    problem: 'Problemy',
  },
  'lab-todo': {
    all: 'Wszystkie',
    active: 'Aktywne',
    done: 'Zrobione',
  },
};

const VIEW_LABELS: Record<string, string> = {
  nexus: 'Topologia (mapa mysli)',
  'lab-todo': 'Laboratorium: Zadania',
  'lab-writing': 'Laboratorium: Pisanie',
  sandbox: 'Baza Wiedzy',
  'raw-fragments': 'Surowe Fragmenty',
  logs: 'Logi Agentow',
  draft: 'RLHF Draft',
  agents: 'Agenci',
  changes: 'Zmiany',
  wiki: 'Wiki',
  git: 'Git',
  pipeline: 'Pipeline',
  workflows: 'Workflowy',
  feedback: 'Feedback',
  settings: 'Ustawienia',
};

interface UseTrackerOptions {
  activeView: ViewMode;
  selectedNodeId: string | null;
  selectedAgentId?: string | null;
  selectedTaskId: string | null;
  selectedManuscriptId: string | null;
  projectId: string | null;
  lastAction?: string;
  /** Podzakladka (przekazywana przez kazdy komponent recznie) */
  subView?: string;
  nodes?: { id: string; title: string }[];
  tasks?: { id: string; title: string }[];
  manuscripts?: { id: string; title: string }[];
}

export function useContextTracker(options: UseTrackerOptions): TrackerState {
  const {
    activeView,
    selectedNodeId,
    selectedTaskId,
    selectedManuscriptId,
    projectId,
    lastAction,
    subView: externalSubView,
    nodes,
    tasks,
    manuscripts,
  } = options;

  const [selectedText, setSelectedText] = useState('');
  const [clipboardContent, setClipboardContent] = useState('');

  // === Zaznaczony tekst ==================================================
  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() || '';
      setSelectedText(text);
    };

    const handleSelectionEnd = () => {
      // Opoznienie zeby dac czas na klikniecie feedbacku z kontekstem
      setTimeout(handleSelection, 100);
    };

    document.addEventListener('mouseup', handleSelectionEnd);
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') handleSelection();
    };
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('mouseup', handleSelectionEnd);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // === Schowek ==========================================================
  useEffect(() => {
    const handleCopy = () => {
      // Odczyt schowka jest async i wymaga permissions
      navigator.clipboard.readText().then(text => {
        if (text.trim()) setClipboardContent(text.trim());
      }).catch(() => {
        // Permission denied — ignoruj
      });
    };
    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, []);

  // === Podzakladka =======================================================
  let subView: string;
  const subViewsMap = SUB_VIEWS[activeView];
  if (externalSubView && subViewsMap && subViewsMap[externalSubView]) {
    subView = subViewsMap[externalSubView];
  } else {
    subView = 'Glowny';
  }

  // === Wybrany element ===================================================
  let itemInfo: string | null = null;
  if (selectedNodeId && nodes) {
    const n = nodes.find(x => x.id === selectedNodeId);
    if (n) itemInfo = n.title;
  } else if (selectedTaskId && tasks) {
    const t = tasks.find(x => x.id === selectedTaskId);
    if (t) itemInfo = t.title;
  } else if (selectedManuscriptId && manuscripts) {
    const m = manuscripts.find(x => x.id === selectedManuscriptId);
    if (m) itemInfo = m.title;
  }

  // === Ostatnia akcja ====================================================
  let action: string;
  if (lastAction) {
    action = lastAction;
  } else if (itemInfo) {
    action = `Przegladanie: ${itemInfo}`;
  } else {
    action = `Widok: ${VIEW_LABELS[activeView] || activeView}`;
  }

  // === Czytelna etykieta =================================================
  const viewLabel = VIEW_LABELS[activeView] || activeView;
  let label = viewLabel;
  if (subView && subView !== 'Glowny') label += ` > ${subView}`;
  if (itemInfo) label += ` > ${itemInfo}`;
  if (selectedText) label += ' | Zaznaczono tekst';

  return {
    view: activeView,
    subView,
    nodeTitle: itemInfo,
    selectedText,
    clipboardContent,
    lastAction: action,
    label,
  };
}
