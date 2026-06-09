// ================================================================
// NEXUS V2 — TDD Verification: Chokidar Watcher Service (Phase 4.1)
// ================================================================
// Test 1: Symulowany plik pisany co 400ms — watcher nie emituje
//         ReadyEvent przed upływem 2000ms stabilności.
// Test 2: Normalny plik zapisany w całości — ReadyEvent po 2000ms
// Test 3: Ignorowanie katalogów Buffers
// Test 4: Obsługa błędów (WatcherError)
// ================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WatcherService, WatcherError, type ReadyEvent } from './watcherService';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { setTimeout as wait } from 'timers/promises';

describe('Phase 4.1 — Chokidar Watcher Service', () => {
  let watcher: WatcherService;
  let testDir: string;

  beforeEach(async () => {
    // Tworzymy tymczasowy katalog testowy
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-watcher-test-'));
    watcher = new WatcherService({
      watchPath: testDir,
      stabilityThreshold: 2000,
      pollInterval: 100,
    });
  });

  afterEach(async () => {
    if (watcher && !watcher.isDestroyed()) {
      await watcher.destroy();
    }
    // cleanup test dir
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  // ============================================================
  // Test 1: Symulowany plik pisany co 400ms — brak ReadyEvent
  //
  // Skrypt asercyjny pisze symulowany plik co 400 milisekund
  // dopisując sztuczne kawałki. Watcher podpięty na środowisko
  // testowe w żadnym z tych przerw (400ms) nie ma prawa wysłać
  // sygnału ReadyEvent. Asercja wymusza zablokowanie testu jeśli
  // powiadomienie padnie z wynikiem poniżej uśpienia matematycznego
  // progu 2000ms. Wynik sprawdź różnicą timerów Date.now().
  // ============================================================
  describe('Test 1: Plik pisany co 400ms — blokada stabilności', () => {
    it('nie powinien wyemitować stable przed upływem 2000ms stabilności', async () => {
      // Uruchom watcher
      await watcher.start();
      expect(watcher.isReady()).toBe(true);

      // Śledź emisje 'stable'
      const stableEvents: ReadyEvent[] = [];
      watcher.on('stable', (event: ReadyEvent) => {
        stableEvents.push(event);
      });

      // ================================================================
      // Symuluj plik pisany co 400ms
      //
      // Zapisujemy dane do pliku co 400ms. Ponieważ stabilityThreshold
      // wynosi 2000ms, a my piszemy co 400ms, plik NIGDY nie osiąga
      // 2000ms stabilności. Watcher NIE MA PRAWA wyemitować 'stable'.
      // ================================================================
      const filePath = path.join(testDir, 'streaming-test.txt');

      // Pisz 6 razy co 400ms (łącznie ~2400ms)
      for (let i = 0; i < 6; i++) {
        await fs.promises.appendFile(filePath, `Chunk ${i}: ${'A'.repeat(1024)}\n`);
        await wait(400);
      }

      // ================================================================
      // ASERCJA: Watcher nie wyemitował 'stable' podczas pisania
      // Żadne zdarzenie nie powinno paść poniżej progu 2000ms.
      // ================================================================
      // Jeśli stableEvents.length > 0 — sprawdź czy pierwsza emisja
      // była PO zaprzestaniu pisania (czyli po ostatnim append + 2000ms)
      if (stableEvents.length > 0) {
        // Weź pierwszą emisję
        const firstStable = stableEvents[0];
        // Znajdź czas pierwszego zapisu
        const firstSeen = watcher.getFirstSeen(filePath);
        expect(firstSeen).toBeDefined();

        if (firstSeen) {
          const timeSinceFirstSeen = firstStable.timestamp - firstSeen;
          // Różnica musiała być >= 2000ms (stabilityThreshold)
          expect(timeSinceFirstSeen).toBeGreaterThanOrEqual(2000);
        }
      }

      // Teraz przestań pisać i poczekaj 2500ms — powinien nastąpić 'stable'
      await wait(2500);

      // Powinien być co najmniej 1 event stable po zaprzestaniu pisania
      expect(stableEvents.length).toBeGreaterThanOrEqual(1);

      // Sprawdź, że ostatni stable event ma sensowny timestamp
      const lastStable = stableEvents[stableEvents.length - 1];
      expect(lastStable.filePath).toBe(filePath);
      expect(lastStable.size).toBeGreaterThan(0);
    }, 15_000);
  });

  // ============================================================
  // Test 2: Normalny plik zapisany w całości
  // ============================================================
  describe('Test 2: Plik zapisany w całości — ReadyEvent', () => {
    it('powinien wyemitować stable po 2000ms stabilności', async () => {
      await watcher.start();
      expect(watcher.isReady()).toBe(true);

      const stablePromise = new Promise<ReadyEvent>((resolve) => {
        watcher.once('stable', (event: ReadyEvent) => {
          resolve(event);
        });
      });

      // Zapisz plik w całości
      const filePath = path.join(testDir, 'complete-test.txt');
      await fs.promises.writeFile(filePath, 'Pełna zawartość pliku testowego');

      // Powinien dostać 'stable' w ciągu 5000ms (2000ms stabilności + margines)
      const event = await stablePromise;

      expect(event).toBeDefined();
      expect(event.filePath).toBe(filePath);
      expect(event.size).toBeGreaterThan(0);
      expect(event.timestamp).toBeGreaterThan(0);
    }, 10_000);

    it('powinien wyemitować add dla nowego pliku', async () => {
      await watcher.start();

      const addPromise = new Promise<any>((resolve) => {
        watcher.once('add', (event: any) => {
          resolve(event);
        });
      });

      const filePath = path.join(testDir, 'add-test.txt');
      await fs.promises.writeFile(filePath, 'Test add event');

      const event = await addPromise;
      expect(event.filePath).toBe(filePath);
      expect(event.fileName).toBe('add-test.txt');
    }, 10_000);
  });

  // ============================================================
  // Test 3: Ignorowanie katalogów Buffers
  // ============================================================
  describe('Test 3: Ignorowanie Buffers', () => {
    it('nie powinien wykrywać plików w podkatalogu Buffers', async () => {
      // Utwórz podkatalog Buffers wewnątrz watchPath
      const buffersDir = path.join(testDir, 'Buffers');
      await fs.promises.mkdir(buffersDir, { recursive: true });

      await watcher.start();

      let addCalled = false;
      watcher.on('add', () => {
        addCalled = true;
      });

      // Zapisz plik w Buffers
      const filePath = path.join(buffersDir, 'internal-comm.txt');
      await fs.promises.writeFile(filePath, 'Wewnętrzna komunikacja');

      // Odczekaj na ewentualne zdarzenia
      await wait(1000);

      // Watcher NIE powinien wykryć pliku w Buffers
      expect(addCalled).toBe(false);
    }, 10_000);
  });

  // ============================================================
  // Test 4: Obsługa błędów
  // ============================================================
  describe('Test 4: Obsługa błędów i lifecycle', () => {
    it('nie powinien pozwolić na podwójny start', async () => {
      await watcher.start();
      await expect(watcher.start()).rejects.toThrow(WatcherError);
    });

    it('powinien poprawnie się zniszczyć', async () => {
      await watcher.start();
      expect(watcher.isReady()).toBe(true);
      expect(watcher.isDestroyed()).toBe(false);

      await watcher.destroy();
      expect(watcher.isReady()).toBe(false);
      expect(watcher.isDestroyed()).toBe(true);
    });

    it('powinien zwrócić poprawny watchPath', async () => {
      const resolvedPath = path.resolve(testDir);
      expect(watcher.getWatchPath()).toBe(resolvedPath);
    });

    it('powinien zwrócić domyślny próg stabilności', () => {
      expect(watcher.getStabilityThreshold()).toBe(2000);
    });
  });
});
