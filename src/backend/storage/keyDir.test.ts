// ================================================================
// NEXUS V2 — TDD Verification: KeyDir RAM Index (Phase 2.1)
// ================================================================
// Test 1: Odporność na fizyczne uszkodzenie pliku (corruption proof)
// Test 2: Tombstone — DeletedObjectError przy odczycie skasowanego
// ================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { KeyDir, DeletedObjectError } from './keyDir';

describe('Phase 2.1 — KeyDir RAM Index (Bitcask O(1))', () => {
  let tmpDir: string;
  let keyDir: KeyDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-keydir-'));
    keyDir = new KeyDir({ logDir: tmpDir, logFileName: 'test.bitcask.jsonl' });
  });

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ============================================================
  // Test 1: Odporność na fizyczne uszkodzenie pliku
  // ============================================================
  describe('Test 1: Corruption-proof physical read', () => {
    it('powinien zwrócić oryginalny rekord mimo zewnętrznego dopisania danych na końcu pliku', async () => {
      // Arrange: zapisz rekord "agent_v2" z danymi
      const originalData = {
        name: 'Agent V2',
        version: '2.0.0',
        status: 'active',
        config: {
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 4096,
        },
      };

      await keyDir.write('agent_v2', originalData);

      // Symuluj uszkodzenie fizyczne pliku — zewnętrzne nadpisanie ścieżki
      // i powiększenie rozmiaru pliku o kilka wierszy śmieci
      const logFile = keyDir.getLogFile();
      const garbageLines = [
        '{"id":"hacker","timestamp":9999999999999,"data":"INJECTED_MALICIOUS_PAYLOAD"}\n',
        '{"id":"hacker2","timestamp":9999999999998,"data":{"should":"not","be":"read"}}\n',
        '{"id":"hacker3","timestamp":9999999999997,"data":"corruption_test"}\n',
      ];

      // Append śmieci bezpośrednio przez fs (symulacja zewnętrznego procesu)
      for (const line of garbageLines) {
        fs.appendFileSync(logFile, line, 'utf8');
      }

      // Dodatkowo dopisz jeszcze jeden wiersz z tym samym ID (nowsza wersja)
      // — indeks RAM wciąż wskazuje na ORYGINALNY rekord, więc get()
      // powinien zwrócić starą wersję mimo że nowsza istnieje w pliku
      fs.appendFileSync(
        logFile,
        '{"id":"agent_v2","timestamp":9999999999996,"data":{"name":"CORRUPTED","hacked":true}}\n',
        'utf8'
      );

      // Act: odczytaj agent_v2 przez KeyDir
      const result = await keyDir.get('agent_v2');

      // Assert: precyzyjnie zaadresowany skrawek wyciąga STARY wynik
      // niezależnie od modyfikacji dalszej części pliku
      expect(result).toEqual(originalData);
      expect(result).not.toHaveProperty('hacked');
      expect((result as any).name).toBe('Agent V2');
      expect((result as any).version).toBe('2.0.0');
    });

    it('powinien zwrócić null dla ID które nigdy nie zostało zapisane', async () => {
      const result = await keyDir.get('non_existent_id');
      expect(result).toBeNull();
    });

    it('powinien zwrócić zaktualizowaną wersję po nadpisaniu tego samego ID przez KeyDir.write()', async () => {
      // Zapisz wersję 1
      await keyDir.write('config', { version: 1, value: 'old' });

      // Zapisz wersję 2 (append-only, ale indeks wskazuje na nową)
      await keyDir.write('config', { version: 2, value: 'updated' });

      // Plik fizycznie ma oba rekordy, ale get() zwraca wersję 2
      const result = await keyDir.get('config');
      expect(result).toEqual({ version: 2, value: 'updated' });
    });
  });

  // ============================================================
  // Test 2: Tombstone — DeletedObjectError
  // ============================================================
  describe('Test 2: Tombstone — Deleted Object Found', () => {
    it('powinien rzucić DeletedObjectError przy próbie get() na tombstone', async () => {
      // Arrange: zapisz rekord, a potem go usuń (tombstone)
      await keyDir.write('agent_v2', {
        name: 'Agent V2',
        version: '2.0.0',
      });

      // Act: delete ustawia isTombstone=true
      const deleteMeta = await keyDir.delete('agent_v2');
      expect(deleteMeta.isTombstone).toBe(true);

      // Assert: get() rzuca DeletedObjectError
      try {
        await keyDir.get('agent_v2');
        // Jeśli doszliśmy tutaj, test FAIL — tombstone nie zadziałał
        expect.unreachable('DeletedObjectError powinien być rzucony — tombstone nie powstrzymał odczytu');
      } catch (err) {
        expect(err).toBeInstanceOf(DeletedObjectError);
        expect((err as DeletedObjectError).message).toContain('agent_v2');
        expect((err as DeletedObjectError).message).toContain('Deleted Object Found');
      }
    });

    it('has() powinien zwrócić false po tombstone', async () => {
      await keyDir.write('temp_key', { value: 'temporary' });
      expect(keyDir.has('temp_key')).toBe(true);

      await keyDir.delete('temp_key');
      expect(keyDir.has('temp_key')).toBe(false);
    });

    it('delete() na nieistniejącym ID — idempotentny, nie rzuca błędu', async () => {
      // delete na ID które nigdy nie istniało
      const meta = await keyDir.delete('never_existed');
      expect(meta.isTombstone).toBe(true);
      // get() na tym ID — null (nie istnieje) bo meta jest tombstone ale !existingMeta
      // W implementacji delete ustawia tombstone nawet dla nieistniejących ID
      const result = await keyDir.get('never_existed');
      expect(result).toBeNull();
    });

    it('podwójny delete() na tym samym ID — idempotentny, nie rzuca błędu', async () => {
      await keyDir.write('dup', { value: 'test' });
      const meta1 = await keyDir.delete('dup');
      expect(meta1.isTombstone).toBe(true);

      // Drugi delete — idempotentny, zwraca istniejące meta bez zapisu
      const meta2 = await keyDir.delete('dup');
      expect(meta2.isTombstone).toBe(true);

      // get() rzuca DeletedObjectError — rekord jest tombstone
      await expect(keyDir.get('dup')).rejects.toThrow(DeletedObjectError);
      expect(keyDir.has('dup')).toBe(false);
    });

    it('write() po tombstone — przywraca dostęp do rekordu', async () => {
      await keyDir.write('resurrected', { version: 1 });
      await keyDir.delete('resurrected');

      // Po tombstone — get rzuca błąd
      await expect(keyDir.get('resurrected')).rejects.toThrow(DeletedObjectError);

      // Nadpisz ten sam ID — nowy rekord
      await keyDir.write('resurrected', { version: 2, revived: true });

      // Teraz get() działa — nowy rekord nie jest tombstone
      const result = await keyDir.get('resurrected');
      expect(result).toEqual({ version: 2, revived: true });
    });
  });

  // ============================================================
  // Dodatkowe: size() i entries()
  // ============================================================
  describe('Auxiliary: size() and entries()', () => {
    it('size() zwraca 0 dla pustego indeksu', () => {
      expect(keyDir.size()).toBe(0);
    });

    it('size() zwraca liczbę aktywnych wpisów (bez tombstone)', async () => {
      await keyDir.write('a', { val: 1 });
      await keyDir.write('b', { val: 2 });
      await keyDir.write('c', { val: 3 });
      expect(keyDir.size()).toBe(3);

      await keyDir.delete('b');
      expect(keyDir.size()).toBe(2); // 'b' jest tombstone
    });

    it('entries() zwraca aktywne wpisy (size() pomija tombstone)', async () => {
      await keyDir.write('x', { val: 1 });
      await keyDir.write('y', { val: 2 });
      await keyDir.delete('x');

      // entries() zwraca wszystko z mapy (włącznie z tombstone)
      const entries = Array.from(keyDir.entries());
      expect(entries.length).toBe(2); // 'x' i 'y' wciąż w mapie, ale 'x' to tombstone

      // size() pomija tombstone
      expect(keyDir.size()).toBe(1);
    });
  });
});
