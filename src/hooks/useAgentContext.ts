// ============================================================================
// NEXUS — useAgentContext: uniwersalny hook do zbierania kontekstu
// Zbiera WSZYSTKO: widok, zaznaczone elementy, selection tekstu, clipboard,
// ostatnią akcję. Używany przez feedback, floating agentów i wszędzie.
// ============================================================================

import { useState, useEffect, useRef } from 'react';
import { ViewMode } from '../types';

export interface AgentContext {
  /** Na jaki widok patrzy użytkownik */
  viewMode: ViewMode;
  viewLabel: string;
  
  /** Zaznaczone elementy w Nexusie (notatka, agent, task, manuskrypt) */
  selectedNodeId: string | null;
  selectedAgentId: string | null;
  selectedTaskId: string | null;
  selectedManuscriptId: string | null;
  projectId: string | null;
  
  /** Ostatnia akcja użytkownika */
  lastAction: string;
  
  /** Zaznaczony tekst w UI (jak w pdfie — myszą zaznaczony) */
  selectedText: string;
  
  /** Zawartość schowka (przechwycona przy Ctrl+C) */
  clipboardContent: string;
  
  /** Czytelny opis kontekstu */
  contextLabel: string;
}

const viewLabels: Record<string, string> = {
  nexus: 'Mapa myśli',
  'lab-todo': 'Zadania',
  'lab-writing': 'Pisanie',
  sandbox: 'Baza Wiedzy',
  'raw-fragments': 'Raw Fragments',
  logs: 'Logi agentów',
  draft: 'RLHF Draft',
  agents: 'Panel agentów',
  changes: 'Zmiany',
  wiki: 'Wiki',
  git: 'Git',
  pipeline: 'Pipeline',
  workflows: 'Workflows',
  feedback: 'Feedback',
};

function buildContextLabel(ctx: AgentContext): string {
  const parts: string[] = [];
  parts.push(ctx.viewLabel);
  
  if (ctx.selectedNodeId) parts.push(`Notatka: ${ctx.selectedNodeId}`);
  if (ctx.selectedAgentId) parts.push(`Agent: ${ctx.selectedAgentId}`);
  if (ctx.selectedTaskId) parts.push(`Zadanie: ${ctx.selectedTaskId}`);
  if (ctx.selectedManuscriptId) parts.push(`Manuskrypt: ${ctx.selectedManuscriptId}`);
  if (ctx.projectId) parts.push(`Projekt: ${ctx.projectId}`);
  if (ctx.lastAction && !ctx.lastAction.startsWith('Widok:')) parts.push(ctx.lastAction);
  if (ctx.selectedText) parts.push(`Zaznaczono: ${ctx.selectedText.slice(0, 80)}${ctx.selectedText.length > 80 ? '...' : ''}`);
  
  return parts.join(' · ');
}

interface UseAgentContextOptions {
  viewMode: ViewMode;
  selectedNodeId: string | null;
  selectedAgentId: string | null;
  selectedTaskId: string | null;
  selectedManuscriptId: string | null;
  projectId: string | null;
  lastAction: string;
}

export function useAgentContext(options: UseAgentContextOptions): AgentContext {
  const {
    viewMode,
    selectedNodeId,
    selectedAgentId,
    selectedTaskId,
    selectedManuscriptId,
    projectId,
    lastAction,
  } = options;

  const [selectedText, setSelectedText] = useState('');
  const [clipboardContent, setClipboardContent] = useState('');
  const lastSelectionRef = useRef('');
  const lastClipRef = useRef('');

  // Nasłuchiwanie na selection (zaznaczanie myszą)
  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      const text = sel?.toString()?.trim() || '';
      if (text && text !== lastSelectionRef.current) {
        lastSelectionRef.current = text;
        setSelectedText(text);
      }
    };
    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, []);

  // Nasłuchiwanie na copy (Ctrl+C) — przechwytuje co było zaznaczone
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      const text = window.getSelection()?.toString()?.trim() || '';
      // Nie czytamy e.clipboardData bo to by wymagało permisji
      // Zamiast tego zapamiętujemy selection w momencie kopiowania
      if (text && text !== lastClipRef.current) {
        lastClipRef.current = text;
        setClipboardContent(text);
        // Nie zmieniamy selectedText — ono się zmieniło przy selectionchange
      }
    };
    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, []);

  const context: AgentContext = {
    viewMode,
    viewLabel: viewLabels[viewMode] || viewMode,
    selectedNodeId,
    selectedAgentId,
    selectedTaskId,
    selectedManuscriptId,
    projectId,
    lastAction,
    selectedText,
    clipboardContent,
    contextLabel: '',
  };
  
  context.contextLabel = buildContextLabel(context);

  return context;
}
