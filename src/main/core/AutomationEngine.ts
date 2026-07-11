// ============================================================================
// NEXUS — Automation Engine (Automatyzacja Ofertowania)
// Rozszerzenia BrowserEngine: izolacja profili Playwright, pamięć kursorowa,
// fuzzy matching, multi-persona, skróty zbierające
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 1. Izolacja Profili Playwright (userDataDir)
// ============================================================================

/** Przechowuje ścieżki do profili przeglądarek per persona */
let profileRegistry: Map<string, string> = new Map();

/**
 * Zwraca lub tworzy folder profilu przeglądarki dla danej persony.
 * Każda persona (np. "oferent-A", "oferent-B") ma własny profil
 * z oddzielnymi cookies, session, localStorage — dzięki czemu
 * omija CAPTCHA bo "wygląda jak prawdziwy użytkownik".
 */
export function getOrCreateBrowserProfile(personaId: string, basePath: string): string {
  if (profileRegistry.has(personaId)) {
    return profileRegistry.get(personaId)!;
  }

  const profileDir = path.join(basePath, 'browser-profiles', personaId);
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }
  profileRegistry.set(personaId, profileDir);
  return profileDir;
}

/** Usuwa profil (np. po resecie sesji) */
export function deleteBrowserProfile(personaId: string): void {
  const dir = profileRegistry.get(personaId);
  if (dir && fs.existsSync(dir)) {
    if (!dir.includes('browser-profiles')) {
      throw new Error('Path validation failed: not a browser profile directory');
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
  profileRegistry.delete(personaId);
}

/** Lista zarejestrowanych profili */
export function listBrowserProfiles(): string[] {
  return Array.from(profileRegistry.keys());
}

// ============================================================================
// 2. Pamięć Kursorowa (Cursor Memory)
// ============================================================================

interface CursorState {
  /** ID ostatnio przetworzonego elementu (np. ID zlecenia) */
  lastProcessedId: string | null;
  /** Timestamp ostatniego przetworzenia */
  lastProcessedAt: string | null;
  /** Lista wszystkich przetworzonych ID (max 1000) */
  processedIds: Set<string>;
  /** Offset / indeks ostatniego elementu */
  lastIndex: number;
  /** Pełny kontekst ostatniego przebiegu */
  lastContext?: Record<string, any>;
}

const cursorStore = new Map<string, CursorState>();

const getCursorStorePath = () => path.resolve(process.cwd(), 'data', 'cursor_store.json');

function loadCursorStore(): void {
  try {
    const file = getCursorStorePath();
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      for (const [k, v] of Object.entries(data)) {
        const val = v as any;
        cursorStore.set(k, {
          ...val,
          processedIds: new Set(val.processedIds || []),
        });
      }
    }
  } catch { /* ignore load errors */ }
}

let writeQueue: Promise<void> = Promise.resolve();

function saveCursorStore(): void {
  writeQueue = writeQueue.then(() => {
    try {
      const file = getCursorStorePath();
      const dir = path.dirname(file);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const obj: Record<string, any> = {};
      for (const [k, v] of cursorStore.entries()) {
        obj[k] = {
          ...v,
          processedIds: Array.from(v.processedIds),
        };
      }
      fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf-8');
    } catch { /* ignore save errors */ }
  }).catch(() => {});
}

// Load initially
loadCursorStore();

/** Odczytuje pozycję kursora dla danego pipeline/stage */
export function getCursor(key: string): CursorState {
  if (!cursorStore.has(key)) {
    cursorStore.set(key, {
      lastProcessedId: null,
      lastProcessedAt: null,
      processedIds: new Set(),
      lastIndex: 0,
    });
  }
  return cursorStore.get(key)!;
}

/** Aktualizuje kursor po przetworzeniu elementu */
export function advanceCursor(key: string, processedId: string, context?: Record<string, any>): void {
  const cursor = getCursor(key);
  cursor.lastProcessedId = processedId;
  cursor.lastProcessedAt = new Date().toISOString();
  cursor.processedIds.add(processedId);
  cursor.lastIndex++;
  if (context) cursor.lastContext = context;

  // Ogranicz rozmiar setu
  if (cursor.processedIds.size > 1000) {
    const arr = Array.from(cursor.processedIds);
    cursor.processedIds = new Set(arr.slice(arr.length - 500));
  }
  saveCursorStore();
}

/** Sprawdza czy element był już przetworzony */
export function isAlreadyProcessed(key: string, id: string): boolean {
  return getCursor(key).processedIds.has(id);
}

/** Resetuje kursor */
export function resetCursor(key: string): void {
  cursorStore.delete(key);
  saveCursorStore();
}

/** Pobiera listę nowych elementów do przetworzenia (filtruje już przetworzone) */
export function filterNewItems<T extends { id: string }>(key: string, items: T[]): T[] {
  const cursor = getCursor(key);
  return items.filter(item => !cursor.processedIds.has(item.id));
}

// ============================================================================
// 3. Fuzzy Matching (dla nazw plików z zrostkami "(1)", "(2)" itp.)
// ============================================================================

/**
 * Sprawdza czy nazwa pliku pasuje do oczekiwanej nazwy
 * ignorując doklejone przez OS zrostki: "(1)", "(2)", " (1)", " - Copy" itp.
 *
 * Przykład:
 *   fuzzyMatchFilename("raport.pdf", "raport (1).pdf") → true
 *   fuzzyMatchFilename("dokument.docx", "dokument - Copy (3).docx") → true
 */
export function fuzzyMatchFilename(expected: string, actual: string): boolean {
  // Normalize: lowercase, trim
  const a = actual.toLowerCase().trim();
  const e = expected.toLowerCase().trim();

  // Exact match
  if (a === e) return true;

  // Extract base name and extension
  const parseFile = (name: string) => {
    const dotIdx = name.lastIndexOf('.');
    const ext = dotIdx >= 0 ? name.slice(dotIdx) : '';
    const base = dotIdx >= 0 ? name.slice(0, dotIdx) : name;
    return { base, ext };
  };

  const pfA = parseFile(a);
  const pfE = parseFile(e);

  // Different extensions → not a match
  if (pfA.ext !== pfE.ext) return false;

  // Remove common OS zrostki
  const cleanBase = (base: string): string => {
    let prev = '';
    let cleaned = base;
    while (prev !== cleaned) {
      prev = cleaned;
      cleaned = cleaned
        .replace(/\s*\(\d+\)\s*$/, '')              // " (1)", "(99)"
        .replace(/\s*-\s*Copy(\s*\(\d+\))?$/i, '')  // " - Copy", " - Copy (2)"
        .replace(/\s*\(\d+\)$/, '')                  // "(1)" bez spacji
        .replace(/\s*_copy\d*$/i, '')                // "_copy", "_copy2"
        .trim();
    }
    return cleaned;
  };

  const cleanedActual = cleanBase(pfA.base);
  const cleanedExpected = cleanBase(pfE.base);

  return cleanedActual === cleanedExpected;
}

/** Znajduje wśród listy plików te które pasują do oczekiwanej nazwy (fuzzy) */
export function findFuzzyFiles(
  expectedNames: string[],
  actualFiles: Array<{ name: string; path: string }>,
): Array<{ name: string; path: string; matchedExpected: string }> {
  const results: Array<{ name: string; path: string; matchedExpected: string }> = [];

  for (const expected of expectedNames) {
    for (const file of actualFiles) {
      if (fuzzyMatchFilename(expected, file.name)) {
        results.push({ ...file, matchedExpected: expected });
        break; // Tylko pierwszy match per nazwa
      }
    }
  }

  return results;
}

// ============================================================================
// 4. Multi-Persona Pipeline Config
// ============================================================================

export interface PersonaConfig {
  id: string;
  name: string;
  role: 'scraper' | 'analyzer' | 'bidder' | 'verifier';
  /** Styl komunikacji dla LLM */
  communicationStyle: string;
  /** Profil przeglądarki */
  browserProfile: string;
  /** Model AI do użycia */
  modelName: string;
  /** Prompt systemowy specific dla tej persony */
  systemPrompt: string;
  /** Szablon outputu (JSON schema) */
  outputTemplate?: Record<string, string>;
}

/** Konfiguracja pipeline'u ofertowania */
export interface BiddingPipelineConfig {
  id: string;
  name: string;
  /** URL tablicy zleceń */
  sourceUrl: string;
  /** Lista person do pipeline'u */
  personas: PersonaConfig[];
  /** Selektor CSS dla listy elementów na stronie */
  itemListSelector: string;
  /** Selektor CSS dla ID pojedynczego elementu */
  itemIdSelector: string;
  /** Selektor CSS dla linku do szczegółów */
  itemLinkSelector: string;
  /** Klucz do pamięci kursorowej */
  cursorKey: string;
  /** Folder do zapisu profili */
  profilesBasePath: string;
  /** Minimalna liczba znaków w opisie (ignoruj puste/skrócone) */
  minDescriptionLength: number;
  /** Czy wymagać dashboardu autoryzacji sesji? */
  requireAuthDashboard: boolean;
  /** Selektor dla dashboardu (jeśli requireAuthDashboard) */
  authDashboardSelector?: string;
}

// ============================================================================
// 5. Skróty Zbierające (Collector Shortcuts)
// ============================================================================

export interface CollectorShortcut {
  id: string;
  /** Klawisz (np. "Numpad3", "Ctrl+Shift+D") */
  key: string;
  /** Folder źródłowy do monitorowania */
  sourceFolder: string;
  /** Pattern plików do zebrania (glob) */
  filePattern: string;
  /** Folder docelowy */
  targetFolder: string;
  /** Czy używać fuzzy matching nazw? */
  useFuzzyMatching: boolean;
  /** Oczekiwane nazwy plików (dla fuzzy) */
  expectedFileNames: string[];
}

/** Rejestruje skrót do zbierania plików */
export function createCollectorShortcut(config: Omit<CollectorShortcut, 'id'>): CollectorShortcut {
  return { ...config, id: `collector_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
}

/** Wykonuje akcję zbierania: kopiuje pliki z sourceFolder do targetFolder z fuzzy matchingiem */
export function collectFiles(shortcut: CollectorShortcut): string[] {
  if (!fs.existsSync(shortcut.sourceFolder)) {
    console.warn(`[Collector] Source folder not found: ${shortcut.sourceFolder}`);
    return [];
  }

  if (!fs.existsSync(shortcut.targetFolder)) {
    fs.mkdirSync(shortcut.targetFolder, { recursive: true });
  }

  const allFiles = fs.readdirSync(shortcut.sourceFolder).map(name => ({
    name,
    path: path.join(shortcut.sourceFolder, name),
  }));

  let matchingFiles: Array<{ name: string; path: string }>;

  if (shortcut.useFuzzyMatching && shortcut.expectedFileNames.length > 0) {
    matchingFiles = findFuzzyFiles(shortcut.expectedFileNames, allFiles);
  } else {
    // Simple glob match
    const pattern = shortcut.filePattern.replace(/\*/g, '.*');
    const regex = new RegExp(`^${pattern}$`, 'i');
    matchingFiles = allFiles.filter(f => regex.test(f.name));
  }

  const copied: string[] = [];
  for (const file of matchingFiles) {
    const dest = path.join(shortcut.targetFolder, file.name);
    fs.copyFileSync(file.path, dest);
    copied.push(dest);
  }

  return copied;
}

// ============================================================================
// 6. Session Auth Checker (Human in the loop)
// ============================================================================

/**
 * Sprawdza czy dashboard autoryzacji sesji jest widoczny.
 * Jeśli nie — oznacza że CAPTCHA/przekierowanie przerwało sesję
 * i trzeba powiadomić użytkownika (human-in-the-loop).
 */
export function createAuthCheckStep(dashboardSelector: string) {
  return {
    action: 'WAIT_FOR' as const,
    selector: dashboardSelector,
    timeoutMs: 5000,
    description: 'Sprawdzanie dashboardu autoryzacji sesji',
  };
}

/**
 * Wrapped macro execution: wykonuje macro, ale jeśli dashboard
 * autoryzacji zniknie — przerywa i zwraca notyfikację.
 */
export interface AuthGuardConfig {
  dashboardSelector: string;
  onAuthLost: (error: string) => void;
}

export function wrapWithAuthGuard(
  steps: any[],
  config: AuthGuardConfig,
): any[] {
  // fix(audyt): dashboardSelector nie był przekazywany do page.evaluate — auth guard nigdy nie wykrywał dashboardu
  const authCheck: any = {
    action: 'EVALUATE',
    script: `(function() { const selector = ${JSON.stringify(config.dashboardSelector)}; const dashboard = document.querySelector(selector); if (!dashboard) { throw new Error('SESSION_AUTH_LOST:' + JSON.stringify({ reason: 'Dashboard autoryzacji nie został wykryty', dashboardSelector: selector, currentUrl: window.location.href, pageTitle: document.title })); } return JSON.stringify({ authorized: true, currentUrl: window.location.href }); })()`,
    description: 'Weryfikacja autoryzacji sesji',
  };

  // Insert auth check at the beginning and after every GOTO
  const guarded: any[] = [authCheck];
  for (const step of steps) {
    guarded.push(step);
    if (step.action === 'GOTO') {
      guarded.push({ ...authCheck, timeoutMs: 8000 });
    }
  }
  return guarded;
}