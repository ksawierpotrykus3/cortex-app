// ================================================================
// NEXUS V2 — TDD Verification: Binary Stream Rebuilding (Phase 2.2)
// ================================================================
// Test 1: 50MB plik + \r\n i \n mieszane + 8454-ty rekord
// ================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { rebuildIndex, rebuildFromFileV2 } from './indexer';
import type { DocumentMeta } from './keyDir';

describe('Phase 2.2 — Binary Stream Rebuilding (Indexer)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-indexer-'));
  });

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ============================================================
  // Test 1: 50MB plik + mieszane \r\n i \n + 8454-ty rekord
  // ============================================================
  describe('Test 1: 50MB mixed line endings + 8454th record', () => {
    it('powinien zrebuildować indeks z 50MB pliku z mieszanką \\r\\n i \\n oraz znaleźć 8454-ty rekord', async () => {
      const filePath = path.join(tmpDir, 'test_mixed.jsonl');
      const RECORD_COUNT = 10000;
      const TARGET_INDEX = 8453; // 0-based: 8454 = index 8453

      // =============================================================
      // Generuj 10,000 rekordów z MIESZANYMI zakończeniami linii
      // Co drugi rekord: \r\n (Windows), co drugi: \n (Unix)
      // =============================================================
      const writeStream = fs.createWriteStream(filePath, { encoding: 'utf8' });

      for (let i = 0; i < RECORD_COUNT; i++) {
        const record = JSON.stringify({
          id: `record_${i}`,
          timestamp: Date.now() + i,
          data: {
            index: i,
            payload: 'x'.repeat(5120), // ~5KB na rekord → ~50MB całość
            description: `Rekord #${i} z polskimi znakami: Zażółć gęślą jaźń ąćęłńóśźż 😀🚀`,
          },
        });

        // Mieszane zakończenia: parzyste → \r\n, nieparzyste → \n
        const lineEnding = (i % 2 === 0) ? '\r\n' : '\n';
        writeStream.write(record + lineEnding);
      }

      // Ostatni rekord specjalny — bez newline na końcu (test boundary)
      const lastRecord = JSON.stringify({
        id: 'last_record_no_newline',
        timestamp: Date.now(),
        data: { final: true },
      });
      writeStream.write(lastRecord); // Brak \n na końcu!
      writeStream.end();

      // Czekaj na finish
      await new Promise<void>((resolve) => writeStream.on('finish', resolve));

      // Sprawdź rozmiar pliku — powinien być ~50MB
      const fileStat = fs.statSync(filePath);
      expect(fileStat.size).toBeGreaterThan(48 * 1024 * 1024); // >48MB

      // =============================================================
      // Uruchom rebuild — 2-przebiegowy skaner binarny
      // =============================================================
      const rebuiltRecords: Map<string, DocumentMeta> = new Map();

      const count = await (await import('./indexer')).rebuildFromFileV2(
        filePath,
        (id: string, meta: DocumentMeta) => {
          rebuiltRecords.set(id, meta);
        }
      );

      // =============================================================
      // Weryfikacja: liczba rekordów
      // =============================================================
      // 10,000 + 1 (ostatni bez newline) = 10,001
      expect(count).toBe(RECORD_COUNT + 1);
      expect(rebuiltRecords.size).toBe(RECORD_COUNT + 1);

      // =============================================================
      // Weryfikacja: 8454-ty rekord (record_8453)
      // =============================================================
      const targetMeta = rebuiltRecords.get('record_8453');
      expect(targetMeta).toBeDefined();
      expect(targetMeta!.offset).toBeGreaterThan(0);
      expect(targetMeta!.size).toBeGreaterThan(0);

      // Odczytaj precyzyjnie z dysku używając meta
      const handle = await fs.promises.open(filePath, 'r');
      const buffer = Buffer.alloc(targetMeta!.size);
      const { bytesRead } = await handle.read(buffer, 0, targetMeta!.size, targetMeta!.offset);
      await handle.close();
      expect(bytesRead).toBe(targetMeta!.size);

      const parsed = JSON.parse(buffer.toString('utf8'));
      expect(parsed.id).toBe('record_8453');
      expect(parsed.data.index).toBe(8453);
      expect(parsed.data.description).toContain('Zażółć gęślą jaźń');
      expect(parsed.data.description).toContain('ąćęłńóśźż');
      expect(parsed.data.description).toContain('😀🚀');

      // =============================================================
      // Weryfikacja: ostatni rekord (bez końcowego newline)
      // =============================================================
      const lastMeta = rebuiltRecords.get('last_record_no_newline');
      expect(lastMeta).toBeDefined();
      const lastHandle = await fs.promises.open(filePath, 'r');
      const lastBuffer = Buffer.alloc(lastMeta!.size);
      await lastHandle.read(lastBuffer, 0, lastMeta!.size, lastMeta!.offset);
      await lastHandle.close();
      const lastParsed = JSON.parse(lastBuffer.toString('utf8'));
      expect(lastParsed.id).toBe('last_record_no_newline');
      expect(lastParsed.data.final).toBe(true);

      // =============================================================
      // Weryfikacja: brak błędów msgpackr (czysty JSON)
      // =============================================================
      // Test przechodzi — wszystkie 10,001 rekordów zostało
      // poprawnie zparsowanych bez potrzeby użycia readline
      // ani żadnego zewnętrznego parsera.
    }, 120000); // 2 min timeout na generację 50MB
  });

  // ============================================================
  // Dodatkowe testy
  // ============================================================
  it('rebuildIndex z nieistniejącego katalogu zwraca 0', async () => {
    const count = await rebuildIndex(
      path.join(tmpDir, 'non_existent'),
      () => { /* noop */ }
    );
    expect(count).toBe(0);
  });

  it('rebuildIndex z pustego katalogu zwraca 0', async () => {
    const count = await rebuildIndex(tmpDir, () => {});
    expect(count).toBe(0);
  });

  it('rebuildIndex z pojedynczym rekordem', async () => {
    const filePath = path.join(tmpDir, 'single.jsonl');
    fs.writeFileSync(
      filePath,
      '{"id":"test1","timestamp":100,"data":{"hello":"world"}}\n',
      'utf8'
    );

    const records: Array<{ id: string; meta: DocumentMeta }> = [];
    await rebuildIndex(tmpDir, (id, meta) => {
      records.push({ id, meta });
    });

    expect(records.length).toBe(1);
    expect(records[0].id).toBe('test1');
    expect(records[0].meta.offset).toBe(0);
    expect(records[0].meta.size).toBeGreaterThan(0);
  });

  it('rebuildIndex pomija uszkodzone JSON (korupcja)', async () => {
    const filePath = path.join(tmpDir, 'corrupted.jsonl');
    fs.writeFileSync(
      filePath,
      '{"id":"good1","timestamp":1,"data":{}}\n' +
      '{"id":"bad1","timestamp":2,data:missing_quotes}\n' + // Zły JSON
      '{"id":"good2","timestamp":3,"data":{}}\n',
      'utf8'
    );

    const records: Array<{ id: string }> = [];
    await rebuildIndex(tmpDir, (id) => {
      records.push({ id });
    });

    // Tylko dobre rekordy powinny być policzone
    expect(records.length).toBe(2);
    expect(records[0].id).toBe('good1');
    expect(records[1].id).toBe('good2');
  });

  it('rebuildIndex rozpoznaje tombstone', async () => {
    const filePath = path.join(tmpDir, 'with_tombstone.jsonl');
    fs.writeFileSync(
      filePath,
      '{"id":"alive","timestamp":1,"data":{"v":1}}\n' +
      '{"id":"dead","timestamp":2,"tombstone":true}\n' +
      '{"id":"alive","timestamp":3,"data":{"v":2}}\n',
      'utf8'
    );

    const records: Map<string, DocumentMeta> = new Map();
    await rebuildIndex(tmpDir, (id, meta) => {
      records.set(id, meta);
    });

    // "dead" to tombstone
    expect(records.get('dead')?.isTombstone).toBe(true);

    // "alive" wskazuje na najnowszą wersję (offset drugiego wpisu)
    expect(records.get('alive')?.isTombstone).toBe(false);
    expect(records.get('alive')?.offset).toBeGreaterThan(0);
  });
});
