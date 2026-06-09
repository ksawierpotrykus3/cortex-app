// ================================================================
// NEXUS V2 — TDD Verification: Log Compactor (Phase 2.3)
// ================================================================
// Test 1: 5000 aktualizacji "Projekt A" + 10 tombstone + kompakcja
//         + concurrent get() podczas fs.rename + weryfikacja wagi
// ================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { KeyDir } from './keyDir';
import { LogCompactor } from './compactor';

describe('Phase 2.3 — Log Compactor (Atomic Disk Swap)', () => {
  let tmpDir: string;
  let keyDir: KeyDir;
  let compactor: LogCompactor;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-compactor-'));
    keyDir = new KeyDir({ logDir: tmpDir, logFileName: 'test_compact.jsonl' });
    // Threshold = 1 bajt — zawsze kompaktuj (dla testów)
    compactor = new LogCompactor({ keyDir, threshold: 1 });
  });

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ============================================================
  // Test 1: 5000 aktualizacji + 10 tombstone + get podczas rename
  // ============================================================
  describe('Test 1: 5000 updates + 10 tombstone + concurrent get()', () => {
    it('powinien skompaktować plik z 5000 update\'ów i 10 tombstone, ' +
       'obsługując concurrent get() w trakcie rename, i zredukować wagę < 10%', async () => {
      const PROJECT_ID = 'Project_A';

      // =============================================================
      // Faza 1: 5000 aktualizacji "Projekt A"
      // Każda aktualizacja = nowy rekord w pliku (append-only)
      // Tylko ostatnia jest "żywa" — reszta to dług techniczny
      // =============================================================
      for (let i = 0; i < 5000; i++) {
        await keyDir.write(PROJECT_ID, {
          version: i,
          name: 'Projekt A',
          description: `Wersja #${i} — Zażółć gęślą jaźń ąćęłńóśźż 😀`,
          timestamp: Date.now() + i,
        });
      }

      // =============================================================
      // Faza 2: 10 tombstone dla różnych kluczy
      // =============================================================
      for (let i = 0; i < 10; i++) {
        const tempId = `temp_key_${i}`;
        await keyDir.write(tempId, { value: i, temp: true });
        await keyDir.delete(tempId);
      }

      // =============================================================
      // Faza 3: Pobierz rozmiar pliku przed kompakcją
      // =============================================================
      const logFile = keyDir.getLogFile();
      const originalStat = fs.statSync(logFile);
      const originalSize = originalStat.size;

      // Oczekiwanie: 5000 zapisów + 10 write + 10 delete = 5020 rekordów
      // Wszystkie w jednym pliku → plik musi być DUŻY
      expect(originalSize).toBeGreaterThan(100 * 1024); // >100KB

      // =============================================================
      // Faza 4: Uruchom kompaktor i concurrent get() podczas rename
      // =============================================================
      // Symulacja: pętla get() co mikrosekundę (microtask) podczas
      // gdy compactor wykonuje fs.rename
      const getResults: Array<{ version: number | null; error?: string }> = [];

      // Rozpocznij konkurencyjne odczyty w tle
      const concurrentReads = (async () => {
        for (let iter = 0; iter < 100; iter++) {
          try {
            const result = await keyDir.get(PROJECT_ID) as { version: number } | null;
            getResults.push({ version: result?.version ?? null });
          } catch (err: unknown) {
            getResults.push({ version: null, error: (err as Error).message });
          }
          // yield do event loop — microtask
          await new Promise((r) => setTimeout(r, 0));
        }
      })();

      // Wykonaj kompakcję
      const result = await compactor.compact(logFile);

      // Czekaj na konkurencyjne odczyty
      await concurrentReads;

      // =============================================================
      // Weryfikacja: kompakcja wykonana
      // =============================================================
      expect(result.compacted).toBe(true);
      expect(result.recordsBefore).toBe(1); // Tylko "Project_A" jest żywy
      expect(result.recordsAfter).toBe(1);

      // =============================================================
      // Weryfikacja: 100 konkurencyjnych get() zakończonych sukcesem
      // Żaden nie rzucił błędu związanego z podmianą pliku
      // =============================================================
      expect(getResults.length).toBe(100);
      const failedReads = getResults.filter((r) => r.error);
      expect(failedReads.length).toBe(0);

      // Wszystkie odczyty zwróciły wersję 4999 (najnowsza)
      for (const r of getResults) {
        expect(r.version).toBe(4999); // Ostatnia wersja (0-indexed: 5000-1)
      }

      // =============================================================
      // Weryfikacja: DRAMATYCZNY spadek wagi pliku
      // Oczekujemy: sizeAfter < originalSize * 0.1 (90%+ redukcji)
      // =============================================================
      const newStat = fs.statSync(logFile);
      const newSize = newStat.size;

      // 5000 rekordów → 1 żywy = 1/5000 oryginału
      // Plus 10 tombstone usunięte. W praktyce: < 0.1% oryginału
      expect(newSize).toBeLessThan(originalSize * 0.1);
      expect(newSize).toBeLessThan(originalSize * 0.05); // Bardziej rygorystyczne

      // =============================================================
      // Weryfikacja: get() działa po kompakcji
      // =============================================================
      const finalData = await keyDir.get(PROJECT_ID) as { version: number };
      expect(finalData.version).toBe(4999);
      expect(finalData.name).toBe('Projekt A');
    }, 60000);

    it('compactor nie robi nic gdy plik < threshold', async () => {
      // Użyj wysokiego threshold
      const bigCompactor = new LogCompactor({ keyDir, threshold: 10 * 1024 * 1024 }); // 10MB

      await keyDir.write('test', { value: 1 });

      const result = await bigCompactor.compactIfNeeded(keyDir.getLogFile());
      expect(result.compacted).toBe(false);
    });

    it('compactor nie rzuca błędu gdy plik nie istnieje', async () => {
      const result = await compactor.compact(path.join(tmpDir, 'non_existent.jsonl'));
      expect(result.compacted).toBe(false);
      expect(result.sizeBefore).toBe(0);
    });

    it('compactor zwraca poprawne statystyki i redukuje rozmiar po duplikatach', async () => {
      // Zapisz 100 unikalnych kluczy
      for (let i = 0; i < 20; i++) {
        await keyDir.write(`key_${i}`, { index: i });
      }

      // Nadpisz każdy klucz 5 razy — tworzy dług techniczny
      for (let version = 0; version < 5; version++) {
        for (let i = 0; i < 20; i++) {
          await keyDir.write(`key_${i}`, { index: i, version });
        }
      }

      const result = await compactor.compact(keyDir.getLogFile());
      expect(result.compacted).toBe(true);
      expect(result.recordsBefore).toBe(20); // 20 żywych kluczy
      expect(result.recordsAfter).toBe(20);
      expect(result.sizeAfter).toBeGreaterThan(0);
      expect(result.sizeAfter).toBeLessThan(result.sizeBefore);

      // Wszystkie dane wciąż dostępne
      for (let i = 0; i < 20; i++) {
        const data = await keyDir.get(`key_${i}`) as { index: number; version: number };
        expect(data.index).toBe(i);
        expect(data.version).toBe(4); // Ostatnia wersja (0..4)
      }
    });

    it('isRunning() i getCompactCount() działają poprawnie', async () => {
      expect(compactor.isRunning()).toBe(false);
      expect(compactor.getCompactCount()).toBe(0);

      await keyDir.write('a', { val: 1 });
      await compactor.compact(keyDir.getLogFile());

      expect(compactor.getCompactCount()).toBe(1);
      expect(compactor.isRunning()).toBe(false);
    });
  });
});
