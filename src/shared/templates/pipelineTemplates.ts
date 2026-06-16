// ============================================================================
// NEXUS — Pipeline Templates (#27 Playwright)
// System szablonów pipeline — dane, nie hardkodowane
// ============================================================================
// Dodanie nowego szablonu = dodanie obiektu do PIPELINE_TEMPLATES
// UI automatycznie je wyświetli — zero zmian w komponentach.
// ============================================================================

import { Pipeline, WorkflowNode } from '../types/schema';
import { uid } from '../../utils/ids';

// === Template Interface =====================================================
export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'browser' | 'llm' | 'data' | 'utility';
  /** Tworzy częściową konfigurację pipeline'u — nazwę, opis, nod'y, połączenia */
  create: () => {
    name: string;
    description: string;
    nodes: WorkflowNode[];
    connections: { sourceNodeId: string; targetNodeId: string }[];
  };
}

// === Helper =================================================================
function now(): string {
  return new Date().toISOString();
}

/** Zamienia JSON string na MacroStep[] — bezpieczne parsowanie */
function parseSteps(json: string): any[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// === Szablony ===============================================================

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [

  // ---------------------------------------------------------------------------
  // 1. Browser Automation — uniwersalny szablon dla Playwright
  // ---------------------------------------------------------------------------
  {
    id: 'browser-automation',
    name: 'Browser Automation',
    description: 'Automatyzacja przeglądarki przez Playwright. Otwiera stronę, wykonuje kroki, pobiera dane/pliki.',
    icon: 'Globe',
    category: 'browser',
    create: () => {
      const nodeId = `node_${uid()}`;
      const steps = [
        { action: 'GOTO', url: '{{URL}}' },
        { action: 'WAIT_FOR', selector: 'body', timeoutMs: 10000 },
        { action: 'CLICK', selector: '{{SELECTOR}}' },
        { action: 'WAIT_FOR', selector: '.result', timeoutMs: 30000 },
        { action: 'EXTRACT', selector: '.result' },
      ];

      return {
        name: 'Browser Automation',
        description: 'Wchodzi na stronę, wykonuje kroki Playwright, zwraca wynik. Zmienne: {{URL}}, {{SELECTOR}}, {{PROMPT}}',
        nodes: [
          {
            id: nodeId,
            type: 'browser-automate',
            name: 'Playwright',
            config: {
              steps,
              inputs: { URL: 'https://example.com', SELECTOR: 'body', PROMPT: '' },
            },
            position: { x: 50, y: 50 },
          },
        ],
        connections: [],
      };
    },
  },

  // ---------------------------------------------------------------------------
  // 2. Download & Save — pobiera plik i zapisuje w bazie
  // ---------------------------------------------------------------------------
  {
    id: 'browser-download',
    name: 'Download & Save',
    description: 'Pobiera plik ze strony (PDF, obrazek, zip) i zapisuje w bazie danych Nexusa.',
    icon: 'Download',
    category: 'browser',
    create: () => {
      const nodeId = `node_${uid()}`;
      const steps = [
        { action: 'GOTO', url: '{{URL}}' },
        { action: 'WAIT_FOR', selector: '{{DOWNLOAD_SELECTOR}}', timeoutMs: 15000 },
        { action: 'DOWNLOAD', selector: '{{DOWNLOAD_SELECTOR}}', saveTo: 'outputs/' },
      ];

      return {
        name: 'Download & Save',
        description: 'Pobiera plik przez Playwright i zapisuje w storage/files/ w bazie danych.',
        nodes: [
          {
            id: nodeId,
            type: 'browser-automate',
            name: 'Download',
            config: {
              steps,
              inputs: { URL: 'https://example.com/file', DOWNLOAD_SELECTOR: '.download-btn' },
            },
            position: { x: 50, y: 50 },
          },
        ],
        connections: [],
      };
    },
  },

  // ---------------------------------------------------------------------------
  // 3. Screenshot Page — zrzut ekranu strony
  // ---------------------------------------------------------------------------
  {
    id: 'browser-screenshot',
    name: 'Screenshot Page',
    description: 'Wykonuje zrzut ekranu strony (full-page lub viewport) i zwraca go jako base64.',
    icon: 'Camera',
    category: 'browser',
    create: () => {
      const nodeId = `node_${uid()}`;
      const steps = [
        { action: 'GOTO', url: '{{URL}}' },
        { action: 'WAIT_FOR', selector: 'body', timeoutMs: 10000 },
        { action: 'SCREENSHOT', fullPage: true },
      ];

      return {
        name: 'Screenshot Page',
        description: 'Zrzut ekranu strony. Zmienna: {{URL}}',
        nodes: [
          {
            id: nodeId,
            type: 'browser-automate',
            name: 'Screenshot',
            config: {
              steps,
              inputs: { URL: 'https://example.com' },
            },
            position: { x: 50, y: 50 },
          },
        ],
        connections: [],
      };
    },
  },

  // ---------------------------------------------------------------------------
  // 4. Extract & Analyze — pobiera treść i analizuje przez AI
  // ---------------------------------------------------------------------------
  {
    id: 'extract-analyze',
    name: 'Extract & Analyze',
    description: 'Pobiera czysty DOM ze strony i przekazuje do agenta AI do analizy.',
    icon: 'Search',
    category: 'browser',
    create: () => {
      const browserId = `node_${uid()}`;
      const agentId = `node_${uid()}`;
      const steps = [
        { action: 'GOTO', url: '{{URL}}' },
        { action: 'WAIT_FOR', selector: 'body', timeoutMs: 10000 },
        { action: 'EVALUATE', script: 'document.body.innerText.slice(0, 50000)' },
      ];

      return {
        name: 'Extract & Analyze',
        description: 'Pobiera tekst strony i przekazuje do agenta AI do analizy. Podmień agentId na swojego agenta.',
        nodes: [
          {
            id: browserId,
            type: 'browser-automate',
            name: 'Extract Text',
            config: {
              steps,
              inputs: { URL: 'https://example.com' },
            },
            position: { x: 50, y: 50 },
          },
          {
            id: agentId,
            type: 'llm-agent',
            name: 'Analyze',
            agentId: '',
            systemPrompt: 'Przeanalizuj poniższy tekst i wyciągnij kluczowe wnioski:\n\n{{prev.output}}',
            config: {},
            position: { x: 350, y: 50 },
          },
        ],
        connections: [
          { sourceNodeId: browserId, targetNodeId: agentId },
        ],
      };
    },
  },

  // ---------------------------------------------------------------------------
  // 5. Form Fill — wypełnia formularz
  // ---------------------------------------------------------------------------
  {
    id: 'form-fill',
    name: 'Form Fill',
    description: 'Wypełnia formularz na stronie danymi z pipelineu.',
    icon: 'Edit3',
    category: 'browser',
    create: () => {
      const nodeId = `node_${uid()}`;
      const steps = [
        { action: 'GOTO', url: '{{URL}}' },
        { action: 'WAIT_FOR', selector: '{{FORM_SELECTOR}}', timeoutMs: 10000 },
        { action: 'TYPE', selector: '{{INPUT_NAME}}', text: '{{VALUE}}' },
        { action: 'CLICK', selector: '{{SUBMIT_SELECTOR}}' },
        { action: 'WAIT_FOR', selector: '.success', timeoutMs: 15000 },
      ];

      return {
        name: 'Form Fill',
        description: 'Wypełnia formularz na stronie. Zmienne: {{URL}}, {{FORM_SELECTOR}}, {{INPUT_NAME}}, {{VALUE}}, {{SUBMIT_SELECTOR}}',
        nodes: [
          {
            id: nodeId,
            type: 'browser-automate',
            name: 'Form Fill',
            config: {
              steps,
              inputs: {
                URL: 'https://example.com/form',
                FORM_SELECTOR: '#form',
                INPUT_NAME: '#name',
                VALUE: 'Hello World',
                SUBMIT_SELECTOR: '#submit',
              },
            },
            position: { x: 50, y: 50 },
          },
        ],
        connections: [],
      };
    },
  },

  // ---------------------------------------------------------------------------
  // 6. LLM Chain — łańcuch agentów AI
  // ---------------------------------------------------------------------------
  {
    id: 'llm-chain',
    name: 'LLM Chain',
    description: 'Łańcuch dwóch agentów AI — output pierwszego jest inputem drugiego.',
    icon: 'GitBranch',
    category: 'llm',
    create: () => {
      const agent1Id = `node_${uid()}`;
      const agent2Id = `node_${uid()}`;

      return {
        name: 'LLM Chain',
        description: 'Dwóch agentów połączonych w łańcuch. Podmień agentId na swoich agentów.',
        nodes: [
          {
            id: agent1Id,
            type: 'llm-agent',
            name: 'Agent 1',
            agentId: '',
            systemPrompt: '',
            config: {},
            position: { x: 50, y: 50 },
          },
          {
            id: agent2Id,
            type: 'llm-agent',
            name: 'Agent 2',
            agentId: '',
            systemPrompt: '',
            config: {},
            position: { x: 350, y: 50 },
          },
        ],
        connections: [
          { sourceNodeId: agent1Id, targetNodeId: agent2Id },
        ],
      };
    },
  },

  // ---------------------------------------------------------------------------
  // 7. Data Pipeline — akumulacja + router
  // ---------------------------------------------------------------------------
  {
    id: 'data-pipeline',
    name: 'Data Pipeline',
    description: 'Zbiera dane z wielu źródeł i routuje do agenta.',
    icon: 'FileText',
    category: 'data',
    create: () => {
      const accId = `node_${uid()}`;
      const routerId = `node_${uid()}`;
      const agentId = `node_${uid()}`;

      return {
        name: 'Data Pipeline',
        description: 'Zbiera dane z poprzednich kroków i przekazuje do analizy.',
        nodes: [
          {
            id: accId,
            type: 'accumulator',
            name: 'Collect',
            config: { separator: '\n---\n' },
            position: { x: 50, y: 50 },
          },
          {
            id: routerId,
            type: 'router',
            name: 'Route',
            config: {},
            position: { x: 250, y: 50 },
          },
          {
            id: agentId,
            type: 'llm-agent',
            name: 'Analyze',
            agentId: '',
            systemPrompt: '',
            config: {},
            position: { x: 450, y: 50 },
          },
        ],
        connections: [
          { sourceNodeId: accId, targetNodeId: routerId },
          { sourceNodeId: routerId, targetNodeId: agentId },
        ],
      };
    },
  },
];

// === Pomocnik: znajduje zmienne w krokach ===================================
/** Wykrywa wszystkie {{ZMIENNE}} w krokach Playwright */
export function detectVariables(steps: any[]): string[] {
  if (!Array.isArray(steps)) return [];

  const vars = new Set<string>();
  const json = JSON.stringify(steps);
  const regex = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = regex.exec(json)) !== null) {
    // Ignoruj standardowe zmienne Nexusa
    const v = match[1];
    if (!['SCHOWEK', 'CONTEXT', 'prev', 'prev.output'].includes(v)) {
      vars.add(v);
    }
  }
  return Array.from(vars).sort();
}
