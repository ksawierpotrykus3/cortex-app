// ============================================================================
// NEXUS — Agent Presets (F6.5 / #24)
// 12 gotowych szablonów agentów do szybkiego tworzenia
// ============================================================================

import { Agent, AgentStatus, TriggerType, AIProvider, ContextConfig, DEFAULT_CONTEXT_CONFIG } from '../../../shared/types/schema';

export interface AgentPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  create: () => Agent;
}

const now = () => new Date().toISOString();

/** Pomocnik: tworzy domyślny ContextConfig z włączonymi source'ami */
function contextConfigWithSources(sourceIds: string[]): ContextConfig {
  return {
    ...DEFAULT_CONTEXT_CONFIG,
    sources: DEFAULT_CONTEXT_CONFIG.sources.map(s => ({
      ...s,
      enabled: sourceIds.includes(s.id),
    })),
  };
}

export const AGENT_PRESETS: AgentPreset[] = [
  // === Istniejące presety (4) ==============================================
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

  // === Nowe presety (#24) — 8 szablonów =====================================

  {
    id: 'translator',
    name: 'Tłumacz',
    description: 'Tłumaczy tekst między językami z zachowaniem kontekstu',
    icon: 'Languages',
    create: () => ({
      id: crypto.randomUUID?.() || `agent_${Date.now()}`,
      name: 'Tłumacz',
      description: 'Tłumaczy tekst między dowolnymi językami z uwzględnieniem kontekstu i niuansów',
      status: AgentStatus.ACTIVE,
      promptTemplate: `Przetłumacz poniższy tekst na {{TEXT:docelowy język}}.

Zasady:
- Zachowaj oryginalny ton i styl
- Uwzględnij kontekst kulturowy
- W razie niejednoznaczności dodaj przypis

Tekst:
{{SCHOWEK}}

Tłumaczenie:`,
      trigger: {
        type: TriggerType.MANUAL,
        enabled: true,
        useClipboard: true,
        useScreenshot: false,
        hotkey: 'Ctrl+Shift+T',
      },
      model: {
        provider: AIProvider.GEMINI,
        providerLabel: 'Google Gemini',
        modelName: 'gemini-2.0-flash',
        temperature: 0.3,
        maxTokens: 4096,
        topP: 0.85,
      },
      maxRetries: 2,
      cooldownSeconds: 15,
      budgetTokens: 50000,
      budgetDepth: 50,
      outputDestinations: [],
      accentColor: '#f472b6',
      createdAt: now(),
      updatedAt: now(),
      lastRunAt: undefined,
      runCount: 0,
      errorCount: 0,
      rating: 0,
      tags: ['tłumaczenie', 'języki', 'lokalizacja'],
    }),
  },

  {
    id: 'researcher',
    name: 'Research',
    description: 'Dogłębne badanie tematu z wieloma źródłami kontekstu',
    icon: 'BookOpen',
    create: () => ({
      id: crypto.randomUUID?.() || `agent_${Date.now()}`,
      name: 'Research',
      description: 'Przeprowadza dogłębne badanie z wykorzystaniem notatek, wiki i historii',
      status: AgentStatus.ACTIVE,
      promptTemplate: `Przeprowadź research na temat:

{{SCHOWEK}}

Wykorzystaj dostępny kontekst: notatki, bazę wiedzy i historię outputów.

Format odpowiedzi:
## Podsumowanie
[krótkie streszczenie tematu]

## Kluczowe znaleziska
- [fakt 1] — [źródło]
- [fakt 2] — [źródło]
...

## Luki w wiedzy
- [czego brakuje]
...

## Rekomendacje dalszych kroków
- ...`,
      trigger: {
        type: TriggerType.MANUAL,
        enabled: true,
        useClipboard: true,
        useScreenshot: false,
        hotkey: 'Ctrl+Shift+R',
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
      cooldownSeconds: 25,
      budgetTokens: 200000,
      budgetDepth: 100,
      outputDestinations: [],
      accentColor: '#2dd4bf',
      createdAt: now(),
      updatedAt: now(),
      lastRunAt: undefined,
      runCount: 0,
      errorCount: 0,
      rating: 0,
      tags: ['research', 'analiza', 'wiedza'],
      contextConfig: contextConfigWithSources(['notes', 'history']),
    }),
  },

  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    description: 'Analizuje kod pod kątem błędów, bezpieczeństwa i jakości',
    icon: 'Code2',
    create: () => ({
      id: crypto.randomUUID?.() || `agent_${Date.now()}`,
      name: 'Code Reviewer',
      description: 'Przegląda kod źródłowy — bugi, security, styl, wydajność',
      status: AgentStatus.ACTIVE,
      promptTemplate: `Przeprowadź code review poniższego kodu:

\`\`\`
{{SCHOWEK}}
\`\`\`

Zasady:
- Szukaj: bugów, luk bezpieczeństwa, anty-wzorców, problemów wydajnościowych
- Każdy problem oznacz wagą: [CRITICAL] / [MAJOR] / [MINOR]
- Zaproponuj konkretne poprawki

Format:
## Przegląd
[ogólna ocena jakości kodu]

## Znalezione problemy
1. [WAGA] [linia] — opis → proponowana poprawka
2. ...

## Pozytywy
- ...`,
      trigger: {
        type: TriggerType.MANUAL,
        enabled: true,
        useClipboard: true,
        useScreenshot: false,
        hotkey: 'Ctrl+Shift+Q',
      },
      model: {
        provider: AIProvider.GEMINI,
        providerLabel: 'Google Gemini',
        modelName: 'gemini-2.0-flash',
        temperature: 0.2,
        maxTokens: 8192,
        topP: 0.85,
      },
      maxRetries: 2,
      cooldownSeconds: 20,
      budgetTokens: 100000,
      budgetDepth: 100,
      outputDestinations: [],
      accentColor: '#f87171',
      createdAt: now(),
      updatedAt: now(),
      lastRunAt: undefined,
      runCount: 0,
      errorCount: 0,
      rating: 0,
      tags: ['code review', 'jakość', 'bezpieczeństwo'],
    }),
  },

  {
    id: 'code-generator',
    name: 'Code Generator',
    description: 'Generuje kod z opisu wymagań i specyfikacji',
    icon: 'Terminal',
    create: () => ({
      id: crypto.randomUUID?.() || `agent_${Date.now()}`,
      name: 'Code Generator',
      description: 'Generuje kod źródłowy na podstawie opisu, z komentarzami i typami',
      status: AgentStatus.ACTIVE,
      promptTemplate: `Wygeneruj kod na podstawie poniższego opisu:

{{SCHOWEK}}

Wymagania:
- Użyj {{TEXT:język programowania}}
- Dodaj komentarze i typy
- Uwzględnij obsługę błędów
- Kod ma być bezpieczny i wydajny

Format:
## Kod
\`\`\`[język]
[kod]
\`\`\`

## Instrukcja użycia
[krótki opis jak uruchomić]

## Uwagi
[zależności, wymagania systemowe]`,
      trigger: {
        type: TriggerType.MANUAL,
        enabled: true,
        useClipboard: true,
        useScreenshot: false,
        hotkey: 'Ctrl+Shift+G',
      },
      model: {
        provider: AIProvider.GEMINI,
        providerLabel: 'Google Gemini',
        modelName: 'gemini-2.0-flash',
        temperature: 0.3,
        maxTokens: 8192,
        topP: 0.9,
      },
      maxRetries: 2,
      cooldownSeconds: 20,
      budgetTokens: 100000,
      budgetDepth: 100,
      outputDestinations: [],
      accentColor: '#fb923c',
      createdAt: now(),
      updatedAt: now(),
      lastRunAt: undefined,
      runCount: 0,
      errorCount: 0,
      rating: 0,
      tags: ['generowanie kodu', 'programowanie', 'dev'],
    }),
  },

  {
    id: 'debugger',
    name: 'Debugger',
    description: 'Analizuje błędy i stack trace, sugeruje naprawy',
    icon: 'Bug',
    create: () => ({
      id: crypto.randomUUID?.() || `agent_${Date.now()}`,
      name: 'Debugger',
      description: 'Analizuje logi błędów, stack trace i sugeruje konkretne naprawy',
      status: AgentStatus.ACTIVE,
      promptTemplate: `Przeanalizuj poniższy błąd i zaproponuj naprawę:

{{SCHOWEK}}

Zasady:
- Zidentyfikuj źródło problemu
- Zaproponuj konkretną naprawę z kodem
- Wymień potencjalne skutki uboczne

Format:
## Diagnoza
[opis problemu]

## Przyczyna
[co powoduje błąd]

## Rozwiązanie
\`\`\`[język]
[kod z poprawką]
\`\`\`

## Zapobieganie
[jak uniknąć w przyszłości]`,
      trigger: {
        type: TriggerType.MANUAL,
        enabled: true,
        useClipboard: true,
        useScreenshot: false,
        hotkey: 'Ctrl+Shift+D',
      },
      model: {
        provider: AIProvider.GEMINI,
        providerLabel: 'Google Gemini',
        modelName: 'gemini-2.0-flash',
        temperature: 0.2,
        maxTokens: 4096,
        topP: 0.85,
      },
      maxRetries: 3,
      cooldownSeconds: 20,
      budgetTokens: 100000,
      budgetDepth: 100,
      outputDestinations: [],
      accentColor: '#ef4444',
      createdAt: now(),
      updatedAt: now(),
      lastRunAt: undefined,
      runCount: 0,
      errorCount: 0,
      rating: 0,
      tags: ['debugowanie', 'błędy', 'naprawa'],
    }),
  },

  {
    id: 'editor',
    name: 'Redaktor',
    description: 'Poprawia i ulepsza tekst bez zmiany znaczenia',
    icon: 'Pencil',
    create: () => ({
      id: crypto.randomUUID?.() || `agent_${Date.now()}`,
      name: 'Redaktor',
      description: 'Ulepsza styl i czytelność tekstu bez zmiany treści i znaczenia',
      status: AgentStatus.ACTIVE,
      promptTemplate: `Popraw poniższy tekst, zachowując jego znaczenie:

{{SCHOWEK}}

Zasady:
- Popraw styl bez zmiany znaczenia
- Ulepsz czytelność (krótsze zdania, lepsza struktura)
- Dostosuj ton do {{TEXT:styl (formalny/potoczny/profesjonalny)}}
- Zachowaj wszystkie informacje

Format:
## Poprawiona wersja
[poprawiony tekst]

## Zmiany
- [co zmieniono i dlaczego]
...`,
      trigger: {
        type: TriggerType.MANUAL,
        enabled: true,
        useClipboard: true,
        useScreenshot: false,
        hotkey: 'Ctrl+Shift+E',
      },
      model: {
        provider: AIProvider.GEMINI,
        providerLabel: 'Google Gemini',
        modelName: 'gemini-2.0-flash',
        temperature: 0.3,
        maxTokens: 4096,
        topP: 0.85,
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
      tags: ['edycja', 'styl', 'czytelność'],
    }),
  },

  {
    id: 'formatter',
    name: 'Formatter',
    description: 'Formatuje tekst — markdown, struktura, lista, tabele',
    icon: 'AlignLeft',
    create: () => ({
      id: crypto.randomUUID?.() || `agent_${Date.now()}`,
      name: 'Formatter',
      description: 'Formatuje surowy tekst w czystą strukturę — markdown, akapity, listy',
      status: AgentStatus.ACTIVE,
      promptTemplate: `Sformatuj poniższy tekst w czystą, czytelną strukturę:

{{SCHOWEK}}

Zasady:
- Użyj formatowania Markdown
- Podziel na logiczne sekcje
- Użyj list, nagłówków, tabel gdzie odpowiednie
- Zachowaj wszystkie informacje

Format:
[przeformatowany tekst w Markdown]

Sekcje i nagłówki dobierz odpowiednio do treści.`,
      trigger: {
        type: TriggerType.MANUAL,
        enabled: true,
        useClipboard: true,
        useScreenshot: false,
        hotkey: 'Ctrl+Shift+F',
      },
      model: {
        provider: AIProvider.GEMINI,
        providerLabel: 'Google Gemini',
        modelName: 'gemini-2.0-flash',
        temperature: 0.2,
        maxTokens: 4096,
        topP: 0.85,
      },
      maxRetries: 2,
      cooldownSeconds: 10,
      budgetTokens: 50000,
      budgetDepth: 50,
      outputDestinations: [],
      accentColor: '#2dd4bf',
      createdAt: now(),
      updatedAt: now(),
      lastRunAt: undefined,
      runCount: 0,
      errorCount: 0,
      rating: 0,
      tags: ['formatowanie', 'markdown', 'struktura'],
    }),
  },

  {
    id: 'teacher',
    name: 'Nauczyciel',
    description: 'Wyjaśnia złożone koncepcje w prosty, przystępny sposób',
    icon: 'GraduationCap',
    create: () => ({
      id: crypto.randomUUID?.() || `agent_${Date.now()}`,
      name: 'Nauczyciel',
      description: 'Wyjaśnia dowolny temat w prosty sposób, z przykładami i analogiami',
      status: AgentStatus.ACTIVE,
      promptTemplate: `Wyjaśnij poniższy temat w prosty i przystępny sposób:

{{SCHOWEK}}

Zasady:
- Wyjaśnij jak komuś, kto nie zna tematu
- Użyj analogii i przykładów z życia
- Podziel na: podstawy → szczegóły → podsumowanie
- Dodaj sekcję "Częste pytania"

Format:
## W skrócie
[1-2 zdania esencji tematu]

## Podstawy (dla początkujących)
[proste wyjaśnienie z analogiami]

## Szczegóły
[więcej konkretów]

## Przykłady
[konkretne przykłady użycia]

## Częste pytania
- Q: ... → A: ...`,
      trigger: {
        type: TriggerType.MANUAL,
        enabled: true,
        useClipboard: true,
        useScreenshot: false,
        hotkey: 'Ctrl+Shift+H',
      },
      model: {
        provider: AIProvider.GEMINI,
        providerLabel: 'Google Gemini',
        modelName: 'gemini-2.0-flash',
        temperature: 0.5,
        maxTokens: 8192,
        topP: 0.9,
      },
      maxRetries: 2,
      cooldownSeconds: 20,
      budgetTokens: 100000,
      budgetDepth: 100,
      outputDestinations: [],
      accentColor: '#60a5fa',
      createdAt: now(),
      updatedAt: now(),
      lastRunAt: undefined,
      runCount: 0,
      errorCount: 0,
      rating: 0,
      tags: ['edukacja', 'wyjaśnianie', 'wiedza'],
      contextConfig: contextConfigWithSources(['notes', 'history', 'changelog']),
    }),
  },
];
