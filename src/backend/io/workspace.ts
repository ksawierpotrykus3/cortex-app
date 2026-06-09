// ================================================================
// NEXUS V2 — Virtual Workspace Initialization & Fallback Probe
// Moduł: Workspace Bootstrap (Phase 1.1)
// ================================================================
// Tworzy strukturę katalogów workspace, wykonuje sondę uprawnień
// (EACCES/EPERM/EROFS detection) z fallbackiem do %APPDATA%,
// implementuje blokadę workspace.lock (PID-based) z检测iem
// procesu-widma przez process.kill(pid, 0).
// ================================================================

import { app, dialog } from 'electron';
import { promises as fs, constants as fs_constants } from 'fs';
import path from 'path';

// Krytyczne węzły struktury workspace
const WORKSPACE_NODES: readonly string[] = [
  'Agents',
  'Workflows',
  'Context_Pool',
  'Buffers',
  'RLHF_Logs',
  'Watched_IO',
  'Changelog',
] as const;

// Podfoldery wewnątrz Watched_IO
const WATCHED_IO_CHILDREN: readonly string[] = ['In', 'Out'] as const;

// Nazwa pliku blokady
const LOCK_FILE = 'workspace.lock';

// Nazwa pliku sondy
const PROBE_FILE = 'probe.tmp';

// ------------------------------------------------------------------
// Interfejs wyniku inicjalizacji
// ------------------------------------------------------------------
export interface WorkspaceInitResult {
  /** Docelowa ścieżka workspace (po ewentualnym fallbacku) */
  workspacePath: string;
  /** Czy użyto fallbacku do %APPDATA% */
  usedFallback: boolean;
  /** Lista utworzonych katalogów */
  createdDirs: string[];
  /** PID zapisany w pliku blokady */
  pid: number;
}

// ------------------------------------------------------------------
// Internal: tworzenie pojedynczego katalogu (rekurencyjnie)
// ------------------------------------------------------------------
async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

// ------------------------------------------------------------------
// Internal: zapis pliku workspace.lock z PID
// ------------------------------------------------------------------
async function writeLockFile(lockPath: string): Promise<void> {
  await fs.writeFile(lockPath, String(process.pid), {
    encoding: 'utf8',
    flag: 'w',
  });
}

// ------------------------------------------------------------------
// Internal: odczyt PID z pliku blokady
// ------------------------------------------------------------------
async function readLockFile(lockPath: string): Promise<number | null> {
  try {
    const content = await fs.readFile(lockPath, { encoding: 'utf8' });
    const pid = parseInt(content.trim(), 10);
    return Number.isFinite(pid) && !Number.isNaN(pid) ? pid : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------
// Internal: sprawdzenie czy proces żyje (Windows-safe)
// ------------------------------------------------------------------
function isProcessAlive(pid: number): boolean {
  try {
    // Sygnał 0 nie wysyła nic — tylko sprawdza czy proces istnieje
    // W Node.js process.kill z sygnałem 0 na Windows rzuca ESRCH jeśli
    // proces nie istnieje lub EACCES jeśli istnieje ale brak uprawnień
    // (co oznacza że proces żyje)
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === 'ESRCH') {
      return false; // Proces nie istnieje
    }
    // EACCES, EPERM — proces istnieje ale brak uprawnień do wysłania sygnału
    return true;
  }
}

// ------------------------------------------------------------------
// Helper: TypeScript type guard dla NodeJS.ErrnoException
// ------------------------------------------------------------------
function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

// ------------------------------------------------------------------
// Główna funkcja inicjalizująca workspace
// ------------------------------------------------------------------
export async function initializeWorkspace(): Promise<WorkspaceInitResult> {
  // ------------------------------------------------------------------
  // Krok 1: Ustal ścieżkę bazową — domyślnie Documents/Nexus_Workspace
  // ------------------------------------------------------------------
  const primaryPath = path.join(app.getPath('documents'), 'Nexus_Workspace');

  // ------------------------------------------------------------------
  // Krok 2: Sonda uprawnień (Probe) — próbujemy zapisać probe.tmp
  // ------------------------------------------------------------------
  const { workspacePath, usedFallback } = await probePermissions(primaryPath);

  // ------------------------------------------------------------------
  // Krok 3: Mechanizm blokady workspace.lock (PID guard)
  // ------------------------------------------------------------------
  const lockFilePath = path.join(workspacePath, LOCK_FILE);
  await enforceLock(lockFilePath);

  // ------------------------------------------------------------------
  // Krok 4: Stwórz strukturę katalogów
  // ------------------------------------------------------------------
  const createdDirs = await createWorkspaceTree(workspacePath);

  // ------------------------------------------------------------------
  // Krok 5: Zapisz plik blokady z aktualnym PID
  // ------------------------------------------------------------------
  await writeLockFile(lockFilePath);

  return {
    workspacePath,
    usedFallback,
    createdDirs,
    pid: process.pid,
  };
}

// ------------------------------------------------------------------
// Sonda uprawnień — próbuje utworzyć plik probe.tmp w ścieżce
// docelowej. Łapie EACCES, EPERM, EROFS i w razie błędu
// wykonuje fallback do %APPDATA% (app.getPath('userData')).
// ------------------------------------------------------------------
async function probePermissions(
  targetPath: string
): Promise<{ workspacePath: string; usedFallback: boolean }> {
  // Najpierw upewnij się, że katalog nadrzędny istnieje
  await ensureDir(targetPath);

  const probePath = path.join(targetPath, PROBE_FILE);

  try {
    // Próba zapisu pliku sondy
    await fs.writeFile(probePath, 'NEXUS_V2_PROBE', {
      encoding: 'utf8',
      flag: 'wx', // Tylko jeśli nie istnieje
    });

    // Sukces — usuń plik sondy, ścieżka primary jest OK
    await fs.unlink(probePath).catch(() => {
      /* ignoruj błędy przy czyszczeniu sondy */
    });

    return { workspacePath: targetPath, usedFallback: false };
  } catch (err: unknown) {
    if (isNodeError(err)) {
      const code = err.code ?? '';

      // EACCES — brak uprawnień do katalogu
      // EPERM  — operacja zabroniona (np. Controlled Folder Access)
      // EROFS  — system plików tylko do odczytu (OneDrive w błędnym stanie)
      if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') {
        // Fallback: zrzuć bazę na %APPDATA%
        const fallbackPath = path.join(app.getPath('userData'), 'Nexus_Workspace');
        await ensureDir(fallbackPath);

        return { workspacePath: fallbackPath, usedFallback: true };
      }

      // Jeśli plik już istnieje (EEXIST) — to też OK, sonda zadziałała,
      // ale usuń plik i kontynuuj z primaryPath
      if (code === 'EEXIST') {
        await fs.unlink(probePath).catch(() => {});
        // Spróbuj jeszcze raz z flagą 'w' (nadpisz)
        try {
          await fs.writeFile(probePath, 'NEXUS_V2_PROBE', { encoding: 'utf8', flag: 'w' });
          await fs.unlink(probePath).catch(() => {});
          return { workspacePath: targetPath, usedFallback: false };
        } catch {
          // Jeśli i to nie działa — fallback
          const fallbackPath = path.join(app.getPath('userData'), 'Nexus_Workspace');
          await ensureDir(fallbackPath);
          return { workspacePath: fallbackPath, usedFallback: true };
        }
      }
    }

    // Nieznany błąd — rzuć dalej, nie maskuj awarii
    throw err;
  }
}

// ------------------------------------------------------------------
// Mechanizm blokady workspace.lock
// ------------------------------------------------------------------
async function enforceLock(lockFilePath: string): Promise<void> {
  const existingPid = await readLockFile(lockFilePath);

  if (existingPid !== null) {
    if (isProcessAlive(existingPid)) {
      // Proces-widmo wciąż żyje — wysadź start
      await dialog.showMessageBox({
        type: 'error',
        title: 'NEXUS V2 — Blokada Workspace',
        message: `Wykryto aktywną instancję Nexus System (PID: ${existingPid}).\n\n`
          + 'Uruchomienie drugiej instancji jest niemożliwe — workspace jest zablokowany.\n'
          + 'Jeśli jesteś pewien, że poprzednia instancja nie działa, usuń ręcznie plik:\n'
          + `${lockFilePath}`,
        buttons: ['Zamknij'],
      });
      app.quit();
      // Rzuć błąd aby przerwać dalsze wykonywanie (app.quit jest asynchroniczne)
      throw new Error(`Workspace zablokowany przez proces PID ${existingPid}`);
    }

    // Proces nie istnieje (ESRCH) — nadpisz blokadę (robione w main)
    // Plik zostanie nadpisany po utworzeniu struktury, więc tutaj tylko
    // czyścimy stare martwe PID
    await fs.unlink(lockFilePath).catch(() => {});
  }
}

// ------------------------------------------------------------------
// Tworzenie struktury katalogów workspace
// ------------------------------------------------------------------
async function createWorkspaceTree(basePath: string): Promise<string[]> {
  const createdDirs: string[] = [];

  for (const node of WORKSPACE_NODES) {
    let dirPath: string;

    if (node === 'Watched_IO') {
      // Watched_IO ma podfoldery In/Out
      dirPath = path.join(basePath, node);
      await ensureDir(dirPath);
      createdDirs.push(dirPath);

      for (const child of WATCHED_IO_CHILDREN) {
        const childPath = path.join(dirPath, child);
        await ensureDir(childPath);
        createdDirs.push(childPath);
      }
    } else {
      dirPath = path.join(basePath, node);
      await ensureDir(dirPath);
      createdDirs.push(dirPath);
    }
  }

  return createdDirs;
}

// ------------------------------------------------------------------
// Eksport dla testów — funkcje pomocnicze
// ------------------------------------------------------------------
export const __test__ = {
  PROBE_FILE,
  LOCK_FILE,
  WORKSPACE_NODES,
  isProcessAlive,
  probePermissions,
  enforceLock,
  createWorkspaceTree,
  writeLockFile,
  readLockFile,
};
