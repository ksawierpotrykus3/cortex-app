// ============================================================================
// NEXUS — Command Palette Commands (#12)
// Rejestracja wszystkich globalnych komend dla Command Palette
// ============================================================================

import { useCommandStore } from '../renderer/store/commandStore';
import type { ViewMode } from '../types';

type NavigateFn = (mode: ViewMode) => void;

// ============================================================================
// Nawigacja
// ============================================================================
const NAV_CMDS = (navigate: NavigateFn) => [
  {
    id: 'nav:nexus',
    label: 'Nexus Canvas',
    category: 'Nawigacja',
    shortcut: 'Ctrl+1',
    keywords: ['canvas', 'notatki', 'mapa', 'nexus'],
    handler: () => navigate('nexus'),
  },
  {
    id: 'nav:lab-todo',
    label: 'Lab — Taski',
    category: 'Nawigacja',
    shortcut: 'Ctrl+2',
    keywords: ['zadania', 'todo', 'taski'],
    handler: () => navigate('lab-todo'),
  },
  {
    id: 'nav:lab-writing',
    label: 'Lab — Pisanie',
    category: 'Nawigacja',
    shortcut: 'Ctrl+3',
    keywords: ['draft', 'writing', 'manuskrypt', 'notatki'],
    handler: () => navigate('lab-writing'),
  },
  {
    id: 'nav:agents',
    label: 'Agenci AI',
    category: 'Nawigacja',
    shortcut: 'Ctrl+4',
    keywords: ['ai', 'agent', 'sztuczna inteligencja'],
    handler: () => navigate('agents'),
  },
  {
    id: 'nav:wiki',
    label: 'Wiki',
    category: 'Nawigacja',
    shortcut: 'Ctrl+5',
    keywords: ['baza wiedzy', 'articles', 'artykuły'],
    handler: () => navigate('wiki'),
  },
  {
    id: 'nav:pipeline',
    label: 'Pipeline DAG',
    category: 'Nawigacja',
    shortcut: 'Ctrl+6',
    keywords: ['pipeline', 'dag', 'flow', 'przepływ'],
    handler: () => navigate('pipeline'),
  },
  {
    id: 'nav:workflows',
    label: 'Workflows',
    category: 'Nawigacja',
    shortcut: 'Ctrl+7',
    keywords: ['automatyzacja', 'workflow', 'akcje'],
    handler: () => navigate('workflows'),
  },
  {
    id: 'nav:changes',
    label: 'Zmiany (Changelog)',
    category: 'Nawigacja',
    shortcut: 'Ctrl+8',
    keywords: ['historia', 'changelog', 'log'],
    handler: () => navigate('changes'),
  },
  {
    id: 'nav:git',
    label: 'Git',
    category: 'Nawigacja',
    shortcut: 'Ctrl+9',
    keywords: ['git', 'commit', 'push', 'pull', 'repository', 'repo'],
    handler: () => navigate('git'),
  },
];

// ============================================================================
// Akcje globalne
// ============================================================================
const ACTION_CMDS = (callbacks: GlobalActions) => [
  {
    id: 'cmd:palette',
    label: 'Otwórz Command Palette',
    category: 'Akcje',
    shortcut: 'Ctrl+K',
    keywords: ['palette', 'command', 'komendy', 'szukaj'],
    handler: () => { /* No-op — already open */ },
  },
  {
    id: 'action:new-node',
    label: 'Nowa notatka (NexusNode)',
    category: 'Akcje',
    shortcut: 'Ctrl+N',
    keywords: ['dodaj', 'create', 'nowa', 'notatka'],
    handler: () => { callbacks.setViewMode('nexus'); callbacks.onNewNode?.(); },
  },
  {
    id: 'action:new-task',
    label: 'Nowe zadanie (Task)',
    category: 'Akcje',
    keywords: ['dodaj', 'create', 'task', 'zadanie'],
    handler: () => { callbacks.setViewMode('lab-todo'); callbacks.onNewTask?.(); },
  },
  {
    id: 'action:new-draft',
    label: 'Nowy manuskrypt',
    category: 'Akcje',
    keywords: ['dodaj', 'create', 'draft', 'writing', 'manuskrypt'],
    handler: () => { callbacks.setViewMode('lab-writing'); callbacks.onNewDraft?.(); },
  },
  {
    id: 'action:save',
    label: 'Zapisz workspace',
    category: 'Akcje',
    shortcut: 'Ctrl+S',
    keywords: ['save', 'zapisz', 'storage'],
    handler: () => callbacks.onSave?.(),
  },
  {
    id: 'action:export',
    label: 'Eksportuj (Markdown/JSON)',
    category: 'Akcje',
    shortcut: 'Ctrl+E',
    keywords: ['export', 'eksport', 'markdown', 'json'],
    handler: () => callbacks.onExport?.(),
  },
  {
    id: 'action:feedback',
    label: 'Wyślij feedback / zgłoś błąd',
    category: 'Akcje',
    keywords: ['feedback', 'bug', 'błąd', 'issue', 'sugestia'],
    handler: () => callbacks.onFeedback?.(),
  },
  {
    id: 'danger:clear-outputs',
    label: 'Wyczyść wszystkie outputy agentów',
    category: 'Akcje',
    dangerous: true,
    keywords: ['clear', 'wyczyść', 'output', 'agent', 'usuń'],
    handler: () => callbacks.onClearOutputs?.(),
  },
  {
    id: 'danger:kill-switch',
    label: '[KILL] Kill Switch — zatrzymaj wszystko',
    category: 'Akcje',
    dangerous: true,
    keywords: ['kill', 'stop', 'emergency', 'zatrzymaj', 'awaryjny'],
    handler: () => callbacks.onKillSwitch?.(),
  },
  {
    id: 'action:custom-commands',
    label: 'Zarządzaj custom commands',
    category: 'Akcje',
    keywords: ['custom', 'commands', 'komendy', 'własne', 'dodaj', 'edytuj'],
    handler: () => callbacks.onManageCommands?.(),
  },
];

// ============================================================================
// Callbacks interface — App.tsx implementuje te funkcje
// ============================================================================
export interface GlobalActions {
  setViewMode: (mode: ViewMode) => void;
  onNewNode?: () => void;
  onNewTask?: () => void;
  onNewDraft?: () => void;
  onSave?: () => void;
  onExport?: () => void;
  onFeedback?: () => void;
  onClearOutputs?: () => void;
  onKillSwitch?: () => void;
  onManageCommands?: () => void;
}

// ============================================================================
// Register all commands
// ============================================================================
export function registerAllCommands(
  navigate: NavigateFn,
  callbacks: GlobalActions,
): void {
  const store = useCommandStore.getState();
  store.registerCommands([
    ...NAV_CMDS(navigate),
    ...ACTION_CMDS(callbacks),
  ]);
}
