// ============================================================================
// NEXUS — Agent Presets (F6.5)
// 4 gotowe szablony agentów do szybkiego tworzenia
// ============================================================================

import { Agent, AgentStatus, TriggerType, AIProvider } from '../../../shared/types/schema';

export interface AgentPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  create: () => Agent;
}

const now = () => new Date().toISOString();

export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: 'summarizer',
    name: 'Streszczacz',
    description: 'Zwięźle streszcza tekst, wyciągając kluczowe wnioski',
    icon: 'FileText',
    create: () => ({
      id: crypto.randomUUID?.() || `agent_${Date.now()}`,
      name: 'Streszczacz',
      description: 'Automatycznie streszcza dowolny tekst do 3-5 zdań',
      status: AgentStatus.ACTIVE,
      promptTemplate: `Streszcz poniższy tekst w języku polskim. Wyciągnij najważniejsze wnioski.

Tekst:
{{SCHOWEK}}

Streszczenie (maks. 5 zdań):`,
      trigger: {
        type: TriggerType.MANUAL,
        enabled: true,
        useClipboard: true,
        useScreenshot: false,
        hotkey: 'Ctrl+Shift+S',
      },
      model: {
        provider: AIProvider.GEMINI,
        providerLabel: 'Google Gemini',
        modelName: 'gemini-2.0-flash',
        temperature: 0.3,
        maxTokens: 2048,
        topP: 0.9,
      },
      maxRetries: 2,
      cooldownSeconds: 15,
      budgetTokens: 50000,
      budgetDepth: 50,
      outputDestinations: [],
      accentColor: '#34d399',
      createdAt: now(),
      updatedAt: now(),
      lastRunAt: undefined,
      runCount: 0,
      errorCount: 0,
      rating: 0,
      tags: ['streszczanie', 'kontekst'],
    }),
  },
  {
    id: 'proofreader',
    name: 'Korektor',
    description: 'Sprawdza gramatykę, styl i interpunkcję tekstu',
    icon: 'PenTool',
    create: () => ({
      id: crypto.randomUUID?.() || `agent_${Date.now()}`,
      name: 'Korektor',
      description: 'Wykrywa błędy gramatyczne, stylistyczne i interpunkcyjne',
      status: AgentStatus.ACTIVE,
      promptTemplate: `Sprawdź poniższy tekst pod kątem błędów.

Zasady:
- Popraw błędy gramatyczne i interpunkcyjne
- Zaznacz stylistyczne nieścisłości
- Zaproponuj lepsze sformułowania

Tekst:
{{SCHOWEK}}

Odpowiedź w formacie:
## Poprawki
- [typ błędu]: [oryginał] → [poprawka]

## Uwagi stylistyczne
...`,
      trigger: {
        type: TriggerType.MANUAL,
        enabled: true,
        useClipboard: true,
        useScreenshot: false,
        hotkey: 'Ctrl+Shift+K',
      },
      model: {
        provider: AIProvider.GEMINI,
        providerLabel: 'Google Gemini',
        modelName: 'gemini-2.0-flash',
        temperature: 0.2,
        maxTokens: 4096,
        topP: 0.8,
      },
      maxRetries: 2,
      cooldownSeconds: 15,
      budgetTokens: 50000,
      budgetDepth: 50,
      outputDestinations: [],
      accentColor: '#60a5fa',
      createdAt: now(),
      updatedAt: now(),
      lastRunAt: undefined,
      runCount: 0,
      errorCount: 0,
      rating: 0,
      tags: ['korekta', 'gramatyka', 'styl'],
    }),
  },
  {
    id: 'brainstormer',
    name: 'Brainstormer',
    description: 'Generuje kreatywne pomysły i rozwiązania problemów',
    icon: 'Lightbulb',
    create: () => ({
      id: crypto.randomUUID?.() || `agent_${Date.now()}`,
      name: 'Brainstormer',
      description: 'Generuje 5-10 kreatywnych pomysłów na zadany temat',
      status: AgentStatus.ACTIVE,
      promptTemplate: `Przeprowadź burzę mózgów na temat:

{{SCHOWEK}}

Zasady:
- Wygeneruj 5-10 różnorodnych pomysłów
- Każdy pomysł opisz w 1-2 zdaniach
- Oznacz najbardziej obiecujące pomysły [STAR]
- Zaproponuj 1-2 niestandardowe podejścia

Format:
## Pomysły
1. [tytuł] — [opis]
2. ...

## Rekomendacja
...`,
      trigger: {
        type: TriggerType.MANUAL,
        enabled: true,
        useClipboard: true,
        useScreenshot: false,
        hotkey: 'Ctrl+Shift+B',
      },
      model: {
        provider: AIProvider.GEMINI,
        providerLabel: 'Google Gemini',
        modelName: 'gemini-2.0-flash',
        temperature: 0.9,
        maxTokens: 4096,
        topP: 0.95,
      },
      maxRetries: 2,
      cooldownSeconds: 15,
      budgetTokens: 50000,
      budgetDepth: 50,
      outputDestinations: [],
      accentColor: '#fbbf24',
      createdAt: now(),
      updatedAt: now(),
      lastRunAt: undefined,
      runCount: 0,
      errorCount: 0,
      rating: 0,
      tags: ['kreatywność', 'pomysły', 'brainstorming'],
    }),
  },
  {
    id: 'analyst',
    name: 'Analityk',
    description: 'Dogłębna analiza treści z identyfikacją wzorców',
    icon: 'Search',
    create: () => ({
      id: crypto.randomUUID?.() || `agent_${Date.now()}`,
      name: 'Analityk',
      description: 'Przeprowadza dogłębną analizę tekstu — słabe strony, mocne strony, wzorce',
      status: AgentStatus.ACTIVE,
      promptTemplate: `Przeanalizuj poniższy tekst:

{{SCHOWEK}}

Odpowiedź w formacie:
## Kluczowe tematy
- ...

## Mocne strony
- ...

## Słabe strony / ryzyka
- ...

## Wzorce i powiązania
- ...

## Rekomendacje
- ...`,
      trigger: {
        type: TriggerType.MANUAL,
        enabled: true,
        useClipboard: true,
        useScreenshot: false,
        hotkey: 'Ctrl+Shift+A',
      },
      model: {
        provider: AIProvider.GEMINI,
        providerLabel: 'Google Gemini',
        modelName: 'gemini-2.0-flash',
        temperature: 0.4,
        maxTokens: 8192,
        topP: 0.85,
      },
      maxRetries: 3,
      cooldownSeconds: 20,
      budgetTokens: 100000,
      budgetDepth: 100,
      outputDestinations: [],
      accentColor: '#a78bfa',
      createdAt: now(),
      updatedAt: now(),
      lastRunAt: undefined,
      runCount: 0,
      errorCount: 0,
      rating: 0,
      tags: ['analiza', 'audyt', 'wnioski'],
    }),
  },
];
