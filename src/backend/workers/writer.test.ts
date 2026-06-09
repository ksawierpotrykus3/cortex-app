// ================================================================
// NEXUS V2 — TDD Verification: Lonely Author Worker (Phase 1.3)
// ================================================================
// Test 1: Zero-IPC / Zero-Copy weryfikacja dla 10,000 zapisów.
//
// WERYFIKACJA DETERMINISTYCZNA:
// - 10,000 asynchronicznych modyfikacji z MainThread
// - WorkerThread konsumujący wynik przez SharedArrayBuffer
// - Detektor IPC udowadnia ZERO postMessage z wnętrza Workera
// - 100% zgodność zapisanych danych po stronie pliku
// ================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { SharedMemoryBuffer } from '../io/sharedMemory';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------------------------------------------------------
// Test 1: 10,000 zapisów + Zero-IPC + integralność dyskowa
// ------------------------------------------------------------------
describe('Phase 1.3 — Lonely Author Worker (Zero-IPC)', () => {
  const RECORD_COUNT = 10000;
  const BUFFER_SIZE = 10 * 1024 * 1024; // 10MB — pomieści wszystkie rekordy
  const POLL_TIMEOUT_MS = 60000;

  let tmpDir: string;
  let outputFile: string;
  let buf: SharedMemoryBuffer;
  let worker: Worker;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-writer-test-'));
    outputFile = path.join(tmpDir, 'nexus.jsonl');
    buf = new SharedMemoryBuffer(BUFFER_SIZE);
  });

  afterEach(() => {
    if (worker && !worker.threadId) {
      worker.terminate().catch(() => {});
    }
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('Test 1: 10,000 writes + Zero-IPC + dysk — ani jednego postMessage', async () => {
    // ==============================================================
    // Krok 1: Uruchom Worker Thread z writer.cjs
    // ==============================================================
    const workerPath = path.join(__dirname, 'writer.cjs');
    worker = new Worker(workerPath);

    // Detektor IPC — liczy każdą wiadomość z Workera do MainThread
    let ipcMessageCount = 0;
    const receivedMessages: unknown[] = [];

    worker.on('message', (msg) => {
      ipcMessageCount++;
      receivedMessages.push(msg);
    });

    // Worker.on('error') — natychmiastowa detekcja awarii
    const workerErrors: Error[] = [];
    worker.on('error', (err) => {
      workerErrors.push(err);
    });

    // ==============================================================
    // Krok 2: Zainicjalizuj Worker — przekaż SharedArrayBuffer
    // ==============================================================
    const initPromise = new Promise<void>((resolve) => {
      // Worker nie odpowiada na init — czekamy na pierwszy cykl
      setTimeout(resolve, 100);
    });

    worker.postMessage({
      type: 'init',
      sab: buf.sab,
      outputFile,
    });

    await initPromise;

    // Sprawdź czy worker nie wybuchł przy starcie
    expect(workerErrors.length).toBe(0);

    // ==============================================================
    // Krok 3: Wykonaj 10,000 zapisów z MainThread
    // ==============================================================
    const texts: string[] = [];

    for (let i = 0; i < RECORD_COUNT; i++) {
      // Każdy rekord zawiera polskie znaki diakrytyczne +
      // unikalny identyfikator do weryfikacji integralności
      texts.push(
        `Record #${i} — Polish: Zażółć gęślą jaźń ąćęłńóśźż | ` +
        `CJK: 日本語 한국어 中文 | Emoji: 😀🚀💻`
      );
    }

    // Synchroniczny zapis wszystkich rekordów do bufora
    // SharedMemoryBuffer.write() jest synchroniczny — blokuje tylko
    // na Atomics.add (Lock-Free) i ewentualnym spin-wait na miejsce
    for (const t of texts) {
      buf.write(t);
    }

    // ==============================================================
    // Krok 4: Czekaj aż Worker skonsumuje wszystkie rekordy
    // Polling na stats.used === 0 (TAIL dogonił HEAD)
    // ==============================================================
    const pollStart = Date.now();
    let consumed = false;

    while (Date.now() - pollStart < POLL_TIMEOUT_MS) {
      const stats = buf.stats();
      if (stats.used === 0) {
        consumed = true;
        break;
      }
      // Czekaj 10ms między pollami — nie obciążaj CPU
      await new Promise((r) => setTimeout(r, 10));
    }

    // Dodatkowe opóźnienie na flush dyskowy
    await new Promise((r) => setTimeout(r, 200));

    // ==============================================================
    // Krok 5: WERYFIKACJA ZERO-IPC
    // Ani jeden komunikat typu postMessage nie został rzucony
    // z wewnątrz Workera do MainThread podczas transferu danych.
    // ==============================================================
    expect(ipcMessageCount).toBe(0);
    expect(receivedMessages.length).toBe(0);

    // ==============================================================
    // Krok 6: WERYFIKACJA INTEGRALNOŚCI DYSKOWEJ
    // ==============================================================
    expect(consumed).toBe(true);
    expect(workerErrors.length).toBe(0);

    // Sprawdź czy plik istnieje i ma odpowiednią liczbę linii
    expect(fs.existsSync(outputFile)).toBe(true);

    const fileContent = fs.readFileSync(outputFile, 'utf8');
    const lines = fileContent.trim().split('\n');
    expect(lines.length).toBe(RECORD_COUNT);

    // Weryfikacja każdego rekordu:
    // - Poprawny JSON
    // - Pole 't' (timestamp) > 0
    // - Pole 'p' zawiera oryginalny tekst z polskimi znakami
    for (let i = 0; i < RECORD_COUNT; i++) {
      const parsed = JSON.parse(lines[i]);
      expect(parsed.t).toBeGreaterThan(0);
      expect(typeof parsed.t).toBe('number');
      expect(parsed.p).toBe(
        `Record #${i} — Polish: Zażółć gęślą jaźń ąćęłńóśźż | ` +
        `CJK: 日本語 한국어 中文 | Emoji: 😀🚀💻`
      );
    }

    // ==============================================================
    // Krok 7: Wyślij shutdown do Workera
    // ==============================================================
    worker.postMessage({ type: 'shutdown' });

    // Daj workerowi czas na zamknięcie
    await new Promise((r) => setTimeout(r, 50));

    // Po shutdownie — wciąż ZERO wiadomości IPC
    expect(ipcMessageCount).toBe(0);
    expect(receivedMessages.length).toBe(0);
  }, POLL_TIMEOUT_MS + 30000); // Timeout vitest = 90s
});
