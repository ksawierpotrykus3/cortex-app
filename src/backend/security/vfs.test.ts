// ================================================================
// NEXUS V2 — TDD Verification: Nexus VFS + ACL (Phase 3.1)
// ================================================================
// Test 1: Directory Traversal przez nexus:// URI (../../)
// Test 2: Default Deny ACL — brak tokenu = blokada
// Test 3: Poprawny dostęp z tokenem
// Test 4: Read-only mount point
// Test 5: mount() poza workspace → błąd
// Test 6: Nieprawidłowy format URI
// ================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import {
  NexusVFS,
  ForbiddenVfsAccessException,
  VfsMalformedPathException,
} from './vfs';

describe('Phase 3.1 — Nexus Virtual File System (VFS) + ACL', () => {
  let vfs: NexusVFS;
  let tmpDir: string;
  let agentsDir: string;
  let workflowsDir: string;

  beforeEach(() => {
    // Stwórz tymczasową strukturę workspace
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-vfs-'));
    agentsDir = path.join(tmpDir, 'Agents');
    workflowsDir = path.join(tmpDir, 'Workflows');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.mkdirSync(workflowsDir, { recursive: true });

    // Utwórz przykładowe pliki
    fs.writeFileSync(path.join(agentsDir, 'agent_01.log'), 'Agent 01 data', 'utf8');
    fs.writeFileSync(path.join(workflowsDir, 'log_01'), 'Workflow log entry', 'utf8');

    // Inicjalizuj VFS
    vfs = new NexusVFS(tmpDir);

    // Zamontuj węzły
    vfs.mount('agents', agentsDir);
    vfs.mount('workflow_logs', workflowsDir, true); // read-only
  });

  // ============================================================
  // Test 1: Directory Traversal — próba ucieczki przez ../../
  //
  // SYMULOWANY ATAK:
  //   Agent RAG wysyła zapytanie z URI:
  //     nexus://agents/../../Windows/System32/config/SAM
  //
  // OCZEKIWANIE:
  //   path.resolve(path.join(agentsDir, '../../Windows/System32/config/SAM'))
  //   zwróci C:\Windows\System32\config\SAM
  //   → path.relative(agentsDir, resolvedPath) zaczyna się od ".."
  //   → ForbiddenVfsAccessException
  // ============================================================
  describe('Test 1: Directory Traversal Przez nexus:// (../../)', () => {
    it('powinien twardo odciąć ścieżkę z ../.. przed jakimkolwiek odczytem', () => {
      const maliciousUri = 'nexus://agents/../../Windows/System32/config/SAM';

      // resolve powinien rzucić ForbiddenVfsAccessException
      // zanim ktokolwiek spróbuje czytać dysk
      expect(() => vfs.resolve(maliciousUri)).toThrow(ForbiddenVfsAccessException);

      // Dodatkowa asercja: sprawdź treść błędu
      try {
        vfs.resolve(maliciousUri);
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenVfsAccessException);
        expect((err as ForbiddenVfsAccessException).nexusPath).toBe(maliciousUri);
        expect((err as ForbiddenVfsAccessException).message).toContain('Directory Traversal');
      }
    });

    it('powinien zablokować również bardziej zaawansowane próby traversal', () => {
      // Różne warianty ataku
      const attacks = [
        'nexus://agents/..\\..\\Windows\\System32\\config\\SAM',
        'nexus://agents/../../../etc/passwd',
        'nexus://agents/../../../../Windows/win.ini',
        'nexus://agents/foo/../../../../bar',
        'nexus://agents/.../.../Windows/System32',
      ];

      for (const uri of attacks) {
        expect(() => vfs.resolve(uri)).toThrow(ForbiddenVfsAccessException);
      }
    });
  });

  // ============================================================
  // Test 2: Default Deny ACL — brak tokenu = blokada
  // ============================================================
  describe('Test 2: Default Deny ACL', () => {
    it('powinien zablokować dostęp bez tokenu ACL', async () => {
      // Brak rejestracji tokenu → Default Deny
      const result = vfs.checkAcl('unknown_agent', 'nexus://workflow_logs/log_01', 'read');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Default Deny');
    });

    it('powinien zablokować dostęp z tokenem bez praw', async () => {
      // Token istnieje ale nie ma praw do tej ścieżki
      vfs.registerToken('agent_01', 'nexus://agents', ['read']);

      const result = vfs.checkAcl('agent_01', 'nexus://workflow_logs/log_01', 'read');

      expect(result.allowed).toBe(false);
    });

    it('powinien zablokować dostęp z tokenem ale bez wymaganego prawa', async () => {
      // Token ma read ale nie write
      vfs.registerToken('agent_01', 'nexus://agents', ['read']);

      const result = vfs.checkAcl('agent_01', 'nexus://agents/agent_01.log', 'write');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('brak prawa');
    });
  });

  // ============================================================
  // Test 3: Poprawny dostęp z tokenem
  // ============================================================
  describe('Test 3: Poprawny dostęp z autoryzacją', () => {
    it('powinien przepuścić dostęp z ważnym tokenem i prawem', () => {
      vfs.registerToken('agent_01', 'nexus://agents', ['read', 'write']);

      const result = vfs.checkAcl('agent_01', 'nexus://agents/agent_01.log', 'read');

      expect(result.allowed).toBe(true);
    });

    it('powinien odczytać plik przez VFS z autoryzacją', async () => {
      vfs.registerToken('agent_01', 'nexus://agents', ['read']);

      const data = await vfs.readFile('agent_01', 'nexus://agents/agent_01.log');

      expect(data.toString('utf8')).toBe('Agent 01 data');
    });

    it('powinien zapisać plik przez VFS z autoryzacją', async () => {
      vfs.registerToken('agent_write', 'nexus://agents', ['write']);

      await vfs.writeFile('agent_write', 'nexus://agents/new_file.txt', 'Hello VFS');

      const content = fs.readFileSync(path.join(agentsDir, 'new_file.txt'), 'utf8');
      expect(content).toBe('Hello VFS');
    });

    it('powinien rzucić błąd przy zapisie bez prawa write', async () => {
      vfs.registerToken('agent_readonly', 'nexus://agents', ['read']);

      await expect(
        vfs.writeFile('agent_readonly', 'nexus://agents/new_file.txt', 'data')
      ).rejects.toThrow(ForbiddenVfsAccessException);
    });
  });

  // ============================================================
  // Test 4: Read-only mount point
  // ============================================================
  describe('Test 4: Read-only mount point', () => {
    it('powinien zablokować zapis na read-only mouncie', async () => {
      vfs.registerToken('agent_rw', 'nexus://workflow_logs', ['read', 'write']);

      // writeFile powinno rzucić błąd mimo prawa write — mount jest read-only
      await expect(
        vfs.writeFile('agent_rw', 'nexus://workflow_logs/log_01', 'new data')
      ).rejects.toThrow(ForbiddenVfsAccessException);
    });

    it('powinien zezwolić na odczyt z read-only mounta', async () => {
      vfs.registerToken('agent_ro', 'nexus://workflow_logs', ['read']);

      const data = await vfs.readFile('agent_ro', 'nexus://workflow_logs/log_01');

      expect(data.toString('utf8')).toBe('Workflow log entry');
    });
  });

  // ============================================================
  // Test 5: mount() poza workspace → błąd
  // ============================================================
  describe('Test 5: mount() poza workspace', () => {
    it('powinien zablokować montowanie ścieżki poza workspaceBase', () => {
      const outsidePath = path.join(os.tmpdir(), 'outside-nexus');
      fs.mkdirSync(outsidePath, { recursive: true });

      expect(() => {
        vfs.mount('outside', outsidePath);
      }).toThrow(ForbiddenVfsAccessException);
    });

    it('powinien zezwolić na montowanie ścieżki wewnątrz workspace', () => {
      const insidePath = path.join(tmpDir, 'Allowed_Node');
      fs.mkdirSync(insidePath, { recursive: true });

      expect(() => {
        vfs.mount('allowed', insidePath);
      }).not.toThrow();
    });
  });

  // ============================================================
  // Test 6: Nieprawidłowy format URI
  // ============================================================
  describe('Test 6: Nieprawidłowy format URI', () => {
    it('powinien rzucić błąd dla URI bez nexus://', () => {
      expect(() => vfs.resolve('workflow_logs/log_01')).toThrow(VfsMalformedPathException);
      expect(() => vfs.resolve('https://evil.com/path')).toThrow(VfsMalformedPathException);
      expect(() => vfs.resolve('')).toThrow(VfsMalformedPathException);
    });

    it('powinien rzucić błąd dla URI z nieprawidłowym node', () => {
      expect(() => vfs.resolve('nexus://../agents')).toThrow(VfsMalformedPathException);
      expect(() => vfs.resolve('nexus://agents@hack')).toThrow(VfsMalformedPathException);
      expect(() => vfs.resolve('nexus://')).toThrow(VfsMalformedPathException);
    });

    it('powinien rzucić błąd dla nieistniejącego mount pointa', () => {
      expect(() => vfs.resolve('nexus://nonexistent/file.txt')).toThrow(VfsMalformedPathException);
    });
  });

  // ============================================================
  // Test 7: Zarządzanie tokenami
  // ============================================================
  describe('Test 7: Zarządzanie tokenami ACL', () => {
    it('powinien zarejestrować i odwołać token', () => {
      vfs.registerToken('agent_x', 'nexus://agents', ['read']);
      expect(vfs.getRegisteredTokens()).toContain('agent_x');

      vfs.revokeToken('agent_x');
      expect(vfs.getRegisteredTokens()).not.toContain('agent_x');

      // Po revoke — Default Deny
      const result = vfs.checkAcl('agent_x', 'nexus://agents', 'read');
      expect(result.allowed).toBe(false);
    });

    it('powinien zwrócić puste entry dla niezarejestrowanego tokenu', () => {
      const entries = vfs.getAclEntries('ghost_agent');
      expect(entries).toEqual([]);
    });
  });

  // ============================================================
  // Test 8: Operacje readdir, stat, exists przez VFS
  // ============================================================
  describe('Test 8: Operacje pomocnicze VFS', () => {
    it('powinien odczytać zawartość katalogu przez readdir', async () => {
      vfs.registerToken('agent_ls', 'nexus://agents', ['read']);

      const files = await vfs.readdir('agent_ls', 'nexus://agents');

      expect(files).toContain('agent_01.log');
    });

    it('powinien zwrócić stat pliku', async () => {
      vfs.registerToken('agent_stat', 'nexus://agents', ['read']);

      const info = await vfs.stat('agent_stat', 'nexus://agents/agent_01.log');

      expect(info.size).toBeGreaterThan(0);
      expect(info.isDirectory).toBe(false);
    });

    it('powinien sprawdzić istnienie pliku', async () => {
      vfs.registerToken('agent_ex', 'nexus://agents', ['read']);

      const exists = await vfs.exists('agent_ex', 'nexus://agents/agent_01.log');
      expect(exists).toBe(true);

      const notExists = await vfs.exists('agent_ex', 'nexus://agents/nonexistent.log');
      expect(notExists).toBe(false);
    });
  });
});
