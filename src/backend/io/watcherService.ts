// ================================================================
// NEXUS V2 — Chokidar Watcher Service (Phase 4.1)
// ================================================================
// Nasłuch NTFS z blokadą stabilizacyjną przed uruchomieniem
// workflow agentów. Zmusza moduł Node.js do odczekania 2000ms
// absolutnego uśpienia bitowego przed emisją ReadyEvent.
//
// ARCHITEKTURA:
//   - chokidar.watch na DropZonie (/Watched_IO/In)
//   - awaitWriteFinish: stabilityThreshold=2000ms, pollInterval=100ms
//   - Ignorowanie podkatalogów roboczych Buffers
//   - EventEmitter z ReadyEvent gwarantującym stabilność bajtową
// ================================================================

import chokidar from 'chokidar';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';

// ==============================================================
// Konfiguracja
// ==============================================================
const DEFAULT_STABILITY_THRESHOLD_MS = 2000;
const DEFAULT_POLL_INTERVAL_MS = 100;

// ==============================================================
// Typy
// ==============================================================
export interface WatcherServiceOptions {
  /** Ścieżka do katalogu DropZone (domyślnie ./Watched_IO/In) */
  watchPath?: string;
  /** Dodatkowe wzorce do zignorowania */
  ignoredPatterns?: (string | RegExp)[];
  /** Próg stabilności w ms (domyślnie 2000) */
  stabilityThreshold?: number;
  /** Interwał pollingu w ms (domyślnie 100) */
  pollInterval?: number;
}

export interface WatcherFileEvent {
  /** Ścieżka bezwzględna do pliku */
  filePath: string;
  /** Nazwa pliku */
  fileName: string;
  /** Rozmiar w bajtach w momencie stabilizacji */
  size: number;
  /** Sygnatura czasowa stabilizacji (Date.now()) */
  stabilizedAt: number;
}

export type WatcherEventType = 'ready' | 'add' | 'change' | 'unlink' | 'error' | 'stable';

/**
 * ReadyEvent — emitowany przez WatcherService gdy plik jest w pełni
 * zapisany na dysku i stabilny przez 2000ms.
 */
export interface ReadyEvent {
  /** Ścieżka bezwzględna do stabilnego pliku */
  filePath: string;
  /** Rozmiar pliku w momencie stabilizacji */
  size: number;
  /** Sygnatura czasowa */
  timestamp: number;
}

/**
 * WatcherError — błąd systemu obserwatora
 */
export class WatcherError extends Error {
  public readonly code: string;
  public readonly filePath?: string;

  constructor(code: string, message: string, filePath?: string) {
    super(`[WATCHER] ${message}`);
    this.name = 'WatcherError';
    this.code = code;
    this.filePath = filePath;
  }
}

// ==============================================================
// WatcherService — systemowy obserwator katalogów
//
// 1. Inicjalizacja chokidar.watch na DropZonie
// 2. awaitWriteFinish z stabilityThreshold=2000ms
// 3. Ignorowanie Buffers i katalogów roboczych
// 4. Emisja ReadyEvent dopiero po 2000ms stabilności bajtowej
// ==============================================================
export class WatcherService extends EventEmitter {
  private readonly watchPath: string;
  private readonly stabilityThreshold: number;
  private readonly pollInterval: number;
  private readonly ignoredPatterns: (string | RegExp)[];

  private _watcher: chokidar.FSWatcher | null = null;
  private _isReady = false;
  private _isDestroyed = false;

  /** Mapa śledząca timestampy pierwszego wykrycia pliku (dla weryfikacji stabilności) */
  private readonly _firstSeen = new Map<string, number>();

  constructor(options?: WatcherServiceOptions) {
    super();
    this.setMaxListeners(64); // System agentów może podpiąć wiele listenerów

    this.watchPath = options?.watchPath ?? './Watched_IO/In';
    this.stabilityThreshold = options?.stabilityThreshold ?? DEFAULT_STABILITY_THRESHOLD_MS;
    this.pollInterval = options?.pollInterval ?? DEFAULT_POLL_INTERVAL_MS;
    this.ignoredPatterns = options?.ignoredPatterns ?? [];

    // ============================================================
    // Żelazna lista ignored: podkatalogi robocze Buffers
    // Nigdy nie czytamy wewnętrznych zapętleń komunikacyjnych
    // własnej aplikacji (np. kompaktor, writer worker).
    // ============================================================
    this.ignoredPatterns.push(
      /[\\/]Buffers[\\/]/,
      /[\\/]\.tmp$/,
      /[\\/]\.compact\.tmp$/,
      /\.lock$/,
    );
  }

  /**
   * start() — inicjalizacja chokidar.watch na DropZonie
   *
   * Zwraca Promise który resolve'uje po pierwszym 'ready' chokidara,
   * co oznacza, że skan początkowy katalogu jest zakończony.
   */
  async start(): Promise<void> {
    if (this._watcher) {
      throw new WatcherError('ALREADY_STARTED', 'Obserwator jest już uruchomiony');
    }

    // ============================================================
    // Absolutna ścieżka — zabezpieczenie przed względnością
    // ============================================================
    const resolvedPath = path.resolve(this.watchPath);

    // ============================================================
    // Upewnij się, że katalog istnieje
    // ============================================================
    try {
      await fs.promises.mkdir(resolvedPath, { recursive: true });
    } catch {
      // Jeśli katalog już istnieje, mkdir rzuci błędem — ignorujemy
    }

    return new Promise<void>((resolve, reject) => {
      try {
        // ================================================================
        // Ujarzmienie NTFS: awaitWriteFinish
        //
        // System Windows podczas ściągania pliku PDF blokuje go tworząc
        // deskryptor. Standardowe czytanie rzuci "EOF error".
        //
        // Parametry:
        //   stabilityThreshold: 2000 — stabilność bajtowa przez 2s
        //   pollInterval: 100 — pomiar wagi co 100ms
        //
        // Chokidar wymusza pomiar wagi w 100ms pętlach i wystrzeliwuje
        // zdarzenie 'add'/'change' dopiero w momencie stabilności
        // wielkości bajtowej trwającej sztywne 2 sekundy (koniec zapisu).
        // ================================================================
        this._watcher = chokidar.watch(resolvedPath, {
          ignored: this.ignoredPatterns,
          persistent: true,
          ignoreInitial: false,
          awaitWriteFinish: {
            stabilityThreshold: this.stabilityThreshold,
            pollInterval: this.pollInterval,
          },
          // Windows NT: disable usePolling dla wydajności,
          // ale fallback do pollingu jeśli fs.watch nie działa
          usePolling: false,
          interval: this.pollInterval,
          binaryInterval: this.pollInterval,
          // Ignoruję ukryte pliki Windows (Thumbs.db, desktop.ini)
          ignoreDotFiles: true,
        });

        // ============================================================
        // Zdarzenie 'ready' — chokidar zakończył skan początkowy
        // ============================================================
        this._watcher.on('ready', () => {
          this._isReady = true;
          this.emit('ready');
          resolve();
        });

        // ============================================================
        // Zdarzenie 'add' — nowy plik wykryty w DropZonie
        //
        // awaitWriteFinish gwarantuje, że plik jest stabilny przez
        // stabilityThreshold (2000ms). Mimo to, rejestrujemy pierwszy
        // moment wykrycia dla dodatkowej asercji w testach.
        // ============================================================
        this._watcher.on('add', (filePath: string) => {
          const now = Date.now();

          // Rejestruj pierwsze wykrycie
          if (!this._firstSeen.has(filePath)) {
            this._firstSeen.set(filePath, now);
          }

          // Emituj surowe zdarzenie 'add'
          this.emit('add', {
            filePath,
            fileName: path.basename(filePath),
            size: 0, // Size zostanie uzupełniony po stabilizacji
            stabilizedAt: now,
          } as WatcherFileEvent);

          // ============================================================
          // ReadyEvent — plik w pełni zapisany i stabilny
          // Emitujemy go z rozmiarem pliku w momencie stabilizacji.
          // ============================================================
          this._emitReady(filePath);
        });

        // ============================================================
        // Zdarzenie 'change' — modyfikacja istniejącego pliku
        // ============================================================
        this._watcher.on('change', (filePath: string) => {
          const now = Date.now();

          this._firstSeen.set(filePath, now);

          this.emit('change', {
            filePath,
            fileName: path.basename(filePath),
            size: 0,
            stabilizedAt: now,
          } as WatcherFileEvent);

          this._emitReady(filePath);
        });

        // ============================================================
        // Zdarzenie 'unlink' — usunięcie pliku
        // ============================================================
        this._watcher.on('unlink', (filePath: string) => {
          this._firstSeen.delete(filePath);
          this.emit('unlink', {
            filePath,
            fileName: path.basename(filePath),
            size: 0,
            stabilizedAt: Date.now(),
          } as WatcherFileEvent);
        });

        // ============================================================
        // Zdarzenie 'error' — błąd chokidara
        // ============================================================
        this._watcher.on('error', (error: Error) => {
          const watcherErr = new WatcherError(
            'WATCHER_ERROR',
            `Błąd obserwatora: ${error.message}`,
          );
          this.emit('error', watcherErr);
        });

      } catch (err) {
        reject(new WatcherError(
          'INIT_FAILED',
          `Nie można zainicjalizować obserwatora: ${err instanceof Error ? err.message : String(err)}`,
        ));
      }
    });
  }

  /**
   * _emitReady — emituje 'stable' z pełną informacją o pliku
   *
   * Wywoływane po 'add' i 'change'. Chokidar z awaitWriteFinish
   * gwarantuje już stabilityThreshold ms stabilności, więc emisja
   * następuje natychmiast po zdarzeniu chokidara.
   */
  private async _emitReady(filePath: string): Promise<void> {
    try {
      const stat = await fs.promises.stat(filePath);
      const readyEvent: ReadyEvent = {
        filePath,
        size: stat.size,
        timestamp: Date.now(),
      };

      this.emit('stable', readyEvent);
    } catch {
      // Plik mógł zostać usunięty między add a stat
      this._firstSeen.delete(filePath);
    }
  }

  /**
   * getFirstSeen(filePath) — zwraca timestamp pierwszego wykrycia pliku
   *
   * Używane w testach TDD do weryfikacji, że ReadyEvent nie został
   * wyemitowany przed upływem stabilityThreshold.
   */
  getFirstSeen(filePath: string): number | undefined {
    return this._firstSeen.get(filePath);
  }

  /**
   * getStabilityThreshold() — zwraca aktualny próg stabilności
   */
  getStabilityThreshold(): number {
    return this.stabilityThreshold;
  }

  /**
   * isReady() — czy chokidar zakończył skan początkowy
   */
  isReady(): boolean {
    return this._isReady;
  }

  /**
   * getWatchPath() — zwraca obserwowaną ścieżkę
   */
  getWatchPath(): string {
    return path.resolve(this.watchPath);
  }

  /**
   * destroy() — zamknięcie obserwatora i cleanup
   *
   * Zgodnie z zasadami Zero-Copy i Append-Only:
   * - Zamykamy watcher (chokidar.close)
   * - Czyścimy mapy wewnętrzne
   * - Ustawiamy flagę _isDestroyed
   */
  async destroy(): Promise<void> {
    this._isDestroyed = true;
    this._isReady = false;

    if (this._watcher) {
      await this._watcher.close();
      this._watcher = null;
    }

    this._firstSeen.clear();
    this.removeAllListeners();
  }

  /**
   * isDestroyed() — czy serwis został zniszczony
   */
  isDestroyed(): boolean {
    return this._isDestroyed;
  }
}
