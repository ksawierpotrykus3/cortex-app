// ================================================================
// NEXUS V2 — TDD Verification: Workspace Probe & Lock
// Phase 1.1 — Test 1: EACCES Fallback
// Phase 1.1 — Test 2: PID Lock (dead process zombie override)
// ================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

// ------------------------------------------------------------------
// Mock elektronowego modułu 'app'
// vi.hoisted zapewnia że zmienna istnieje przed hoistowaniem vi.mock
// ------------------------------------------------------------------
const { mockGetPath } = vi.hoisted(() => {
  return {
    mockGetPath: vi.fn(),
  };
});

vi.mock('electron', () => ({
  app: {
    getPath: mockGetPath,
    quit: vi.fn(),
  },
  dialog: {
    showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
  },
}));

// ------------------------------------------------------------------
// Import po mocku — moduł workspace załaduje zamokowany 'electron'
// ------------------------------------------------------------------
import { initializeWorkspace, __test__ } from './workspace';

const {
  PROBE_FILE,
  LOCK_FILE,
  isProcessAlive,
  probePermissions,
  enforceLock,
  createWorkspaceTree,
  writeLockFile,
  readLockFile,
} = __test__;

// ------------------------------------------------------------------
// Pomocniczy tymczasowy katalog testowy
// ------------------------------------------------------------------
let testDir: string;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-test-'));
  vi.clearAllMocks();

  // Domyślne wartości dla app.getPath — wskazują na testDir
  mockGetPath.mockImplementation((key: string) => {
    if (key === 'documents') return testDir;
    if (key === 'userData') return path.join(testDir, 'AppData_Roaming');
    return testDir;
  });
});

afterEach(() => {
  // Czyść katalog testowy
  fs.rmSync(testDir, { recursive: true, force: true });
});

// ================================================================
// TEST 1: EACCES Probe Fallback
// ================================================================
describe('Phase 1.1 — Test 1: EACCES Fallback Probe', () => {
  it('powinien przełączyć na userData gdy writeFile rzuca EACCES', async () => {
    // Arrange: stwórz katalog docelowy i zapisz ścieżkę
    const primaryPath = path.join(testDir, 'Nexus_Workspace');
    fs.mkdirSync(primaryPath, { recursive: true });

    // Sfalsyfikuj próbę zapisu pliku sondy w primaryPath — rzuć EACCES
    const originalWriteFile = fs.promises.writeFile;
    vi.spyOn(fs.promises, 'writeFile').mockImplementationOnce(
      async (filePath: any, data: any, options?: any) => {
        const fileStr = typeof filePath === 'string' ? filePath : filePath.toString();
        if (fileStr.includes(PROBE_FILE)) {
          throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
        }
        return originalWriteFile(filePath as string, data, options);
      }
    );

    // Act
    const result = await probePermissions(primaryPath);

    // Assert: system bez załamania użył fallbacku
    expect(result.usedFallback).toBe(true);
    expect(result.workspacePath).toBe(path.join(testDir, 'AppData_Roaming', 'Nexus_Workspace'));
  });

  it('powinien przełączyć na userData gdy writeFile rzuca EPERM', async () => {
    const primaryPath = path.join(testDir, 'Nexus_Workspace');
    fs.mkdirSync(primaryPath, { recursive: true });

    vi.spyOn(fs.promises, 'writeFile').mockImplementationOnce(
      async (filePath: any) => {
        if (String(filePath).includes(PROBE_FILE)) {
          throw Object.assign(new Error('EPERM'), { code: 'EPERM' });
        }
        return;
      }
    );

    const result = await probePermissions(primaryPath);
    expect(result.usedFallback).toBe(true);
    expect(result.workspacePath).toContain('AppData_Roaming');
  });

  it('powinien przełączyć na userData gdy writeFile rzuca EROFS', async () => {
    const primaryPath = path.join(testDir, 'Nexus_Workspace');
    fs.mkdirSync(primaryPath, { recursive: true });

    vi.spyOn(fs.promises, 'writeFile').mockImplementationOnce(
      async (filePath: any) => {
        if (String(filePath).includes(PROBE_FILE)) {
          throw Object.assign(new Error('EROFS'), { code: 'EROFS' });
        }
        return;
      }
    );

    const result = await probePermissions(primaryPath);
    expect(result.usedFallback).toBe(true);
  });

  it('powinien pozostać na primaryPath gdy sonda się powiedzie', async () => {
    const primaryPath = path.join(testDir, 'Nexus_Workspace');
    fs.mkdirSync(primaryPath, { recursive: true });

    const result = await probePermissions(primaryPath);
    expect(result.usedFallback).toBe(false);
    expect(result.workspacePath).toBe(primaryPath);
  });
});

// ================================================================
// TEST 2: PID Lock — zombie process override
// ================================================================
describe('Phase 1.1 — Test 2: PID Lock (dead process)', () => {
  it('isProcessAlive zwraca false dla PID -1 (nieistniejący)', () => {
    // PID -1 jest zawsze nieosiągalny
    expect(isProcessAlive(-1)).toBe(false);
  });

  it('isProcessAlive zwraca false dla nieistniejącego PID (99999999)', () => {
    // Bardzo wysoki PID, który prawdopodobnie nie istnieje
    expect(isProcessAlive(99999999)).toBe(false);
  });

  it('isProcessAlive zwraca true dla obecnego procesu', () => {
    // PID obecnego procesu testowego zawsze żyje
    expect(isProcessAlive(process.pid)).toBe(true);
  });

  it('powinien nadpisać blokadę gdy PID należy do martwego procesu (PID=-1)', async () => {
    // Arrange: stwórz katalog workspace i plik blokady z PID=-1 (martwy)
    const wsPath = path.join(testDir, 'Nexus_Workspace');
    fs.mkdirSync(wsPath, { recursive: true });
    const lockPath = path.join(wsPath, LOCK_FILE);
    fs.writeFileSync(lockPath, '-1', 'utf8');

    // Act: enforceLock powinien usunąć stary plik (PID 0 = martwy)
    await enforceLock(lockPath);

    // Assert: plik został usunięty
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('powinien wykonać app.quit gdy PID należy do żywego procesu', async () => {
    // Arrange: stwórz plik blokady z PID obecnego procesu
    const wsPath = path.join(testDir, 'Nexus_Workspace');
    fs.mkdirSync(wsPath, { recursive: true });
    const lockPath = path.join(wsPath, LOCK_FILE);
    fs.writeFileSync(lockPath, String(process.pid), 'utf8');

    // Mock app.quit
    const { app } = await import('electron');

    // Act & Assert: powinno rzucić błędem
    await expect(enforceLock(lockPath)).rejects.toThrow(/Workspace zablokowany/);
  });

  it('initializeWorkspace nadpisuje workspace.lock aktualnym PID', async () => {
    // Arrange: przygotuj strukturę z martwym PID=-1
    const wsPath = path.join(testDir, 'Nexus_Workspace');
    fs.mkdirSync(wsPath, { recursive: true });
    const lockPath = path.join(wsPath, LOCK_FILE);
    fs.writeFileSync(lockPath, '-1', 'utf8');

    // Ustaw app.getPath dla 'documents' na testDir
    mockGetPath.mockImplementation((key: string) => {
      if (key === 'documents') return testDir;
      if (key === 'userData') return path.join(testDir, 'AppData_Roaming');
      return testDir;
    });

    // Act
    const result = await initializeWorkspace();

    // Assert: plik blokady zawiera aktualny PID
    const lockContent = fs.readFileSync(path.join(result.workspacePath, LOCK_FILE), 'utf8');
    expect(lockContent.trim()).toBe(String(process.pid));
    expect(result.pid).toBe(process.pid);
    expect(result.usedFallback).toBe(false);
  });
});

// ================================================================
// TEST 3: Struktura katalogów
// ================================================================
describe('Phase 1.1 — Test 3: Directory tree creation', () => {
  it('powinien utworzyć wszystkie krytyczne węzły', async () => {
    const basePath = path.join(testDir, 'Nexus_Workspace');

    const dirs = await createWorkspaceTree(basePath);

    // Sprawdź czy wszystkie główne katalogi zostały utworzone
    const expectedDirs = [
      'Agents',
      'Workflows',
      'Context_Pool',
      'Buffers',
      'RLHF_Logs',
      'Watched_IO',
      'Watched_IO/In',
      'Watched_IO/Out',
      'Changelog',
    ];

    for (const dir of expectedDirs) {
      const fullPath = path.join(basePath, dir);
      expect(fs.statSync(fullPath).isDirectory()).toBe(true);
      expect(dirs).toContain(fullPath);
    }
  });
});

// ================================================================
// TEST 4: Kompletny init workspace
// ================================================================
describe('Phase 1.1 — Test 4: Full initialization', () => {
  it('initializeWorkspace tworzy pełną strukturę i zwraca poprawne dane', async () => {
    mockGetPath.mockImplementation((key: string) => {
      if (key === 'documents') return testDir;
      if (key === 'userData') return path.join(testDir, 'AppData_Roaming');
      return testDir;
    });

    const result = await initializeWorkspace();

    expect(result.workspacePath).toBe(path.join(testDir, 'Nexus_Workspace'));
    expect(result.usedFallback).toBe(false);
    expect(result.pid).toBe(process.pid);
    expect(result.createdDirs.length).toBe(9); // 7 głównych + 2 podfoldery Watched_IO

    // Wszystkie katalogi istnieją
    for (const dirPath of result.createdDirs) {
      expect(fs.existsSync(dirPath)).toBe(true);
    }
  });

  it('initializeWorkspace używa fallbacku gdy primaryPath jest blokowany', async () => {
    // Ustaw documents na chroniony katalog (EACCES)
    const blockedDir = path.join(testDir, 'Documents_Blocked');
    fs.mkdirSync(blockedDir, { recursive: true });

    mockGetPath.mockImplementation((key: string) => {
      if (key === 'documents') return blockedDir;
      if (key === 'userData') return path.join(testDir, 'AppData_Roaming');
      return testDir;
    });

    // Zablokuj probe przez EACCES
    vi.spyOn(fs.promises, 'writeFile').mockImplementationOnce(
      async (filePath: any) => {
        if (String(filePath).includes(PROBE_FILE)) {
          throw Object.assign(new Error('EACCES: blocked by Windows Defender'), {
            code: 'EACCES',
          });
        }
        return;
      }
    );

    const result = await initializeWorkspace();

    expect(result.usedFallback).toBe(true);
    expect(result.workspacePath).toBe(
      path.join(testDir, 'AppData_Roaming', 'Nexus_Workspace')
    );
    expect(result.createdDirs.length).toBe(9);
  });
});
