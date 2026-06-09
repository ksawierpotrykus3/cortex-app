// ================================================================
// NEXUS V2 — KeyDir: Bitcask In-Memory Hash Index (Phase 2.1)
// ================================================================
// Paradygmat Bitcask (Log-Structured Hash Table):
// - Append-Only: brak nadpisywania, każda modyfikacja = nowy rekord
// - Tombstones: usunięcie = zapis znacznika śmierci, usunięcie z Map
// - O(1) RAM: pamięć trzyma tylko Map<id, DocumentMeta> — koordynaty
//   na dysku (filePath, offset, size). Żadne logi nie są ładowane do RAM.
// - Odczyt: precyzyjne wycięcie bajtów z pliku (handle.read z offsetem)
// - Zero-Copy zgodność: brak msgpackr, natywny JSON + Buffer
// ================================================================

import { promises as fs } from 'fs';
import path from 'path';

// ==============================================================
// DocumentMeta — wpis w indeksie KeyDir
// ==============================================================
export interface DocumentMeta {
  /** Ścieżka bezwzględna pliku logu */
  filePath: string;
  /** Bajtowe przesunięcie od początku pliku (0-based) */
  offset: number;
  /** Rozmiar rekordu w bajtach (JSON linia + newline) */
  size: number;
  /** Timestamp UTC w milisekundach */
  timestamp: number;
  /** Czy rekord jest logicznie usunięty (tombstone) */
  isTombstone: boolean;
}

// ==============================================================
// KeyDirError — błędy domenowe KeyDir
// ==============================================================
export class KeyDirError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeyDirError';
  }
}

export class DeletedObjectError extends KeyDirError {
  constructor(id: string) {
    super(`Deleted Object Found: "${id}" — rekord został logicznie usunięty (tombstone)`);
    this.name = 'DeletedObjectError';
  }
}

// ==============================================================
// Interna: typ rekordu w pliku JSONL
// ==============================================================
interface LogRecord {
  id: string;
  timestamp: number;
  tombstone?: boolean;
  data?: unknown;
}

// ==============================================================
// KeyDir — Główna klasa indeksu
// ==============================================================
export class KeyDir {
  /** Główna hashmapa O(1) — ID → DocumentMeta */
  private readonly map = new Map<string, DocumentMeta>();

  /** Bazowa ścieżka pliku logu */
  private readonly basePath: string;

  /** Obecny plik logu (append-only) */
  private readonly logFile: string;

  // ============================================================
  // constructor
  // ============================================================
  constructor(options: { logDir: string; logFileName?: string }) {
    this.basePath = options.logDir;
    this.logFile = path.join(options.logDir, options.logFileName ?? 'nexus.bitcask.jsonl');
  }

  // ============================================================
  // write(id, data) — Append-Only write
  //
  // 1. Serializuje rekord do JSONL
  // 2. Pobiera rozmiar pliku PRZED appendem (to będzie offset)
  // 3. Dopisuje rekord na koniec pliku (fs.promises.appendFile)
  // 4. Aktualizuje Map<id, DocumentMeta> w RAM
  //
  // Zgodność z Bitcask: stary rekord pozostaje w pliku, ale indeks
  // w RAM wskazuje na najnowszą wersję. Przy kompakcji (Phase 3)
  // martwe rekordy zostaną fizycznie usunięte.
  // ============================================================
  public async write(id: string, data: unknown): Promise<DocumentMeta> {
    const timestamp = Date.now();

    // Serializacja w formacie JSONL (jedna linia JSON + \n)
    const record: LogRecord = { id, timestamp, data };
    const line = JSON.stringify(record) + '\n';
    const encoded = Buffer.from(line, 'utf8');
    const size = encoded.byteLength;

    // Pobierz aktualny rozmiar pliku — to będzie offset nowego rekordu
    let offset = 0;
    try {
      const stat = await fs.stat(this.logFile);
      offset = stat.size;
    } catch {
      // Plik nie istnieje — offset = 0 (pierwszy zapis)
    }

    // Append-only write — nigdy nie modyfikuje istniejących danych
    await fs.appendFile(this.logFile, encoded, { flag: 'a' });

    // Aktualizuj indeks w RAM
    const meta: DocumentMeta = {
      filePath: this.logFile,
      offset,
      size,
      timestamp,
      isTombstone: false,
    };

    this.map.set(id, meta);

    return meta;
  }

  // ============================================================
  // get(id) — O(1) odczyt z dysku przez indeks RAM
  //
  // 1. const meta = this.map.get(id)
  // 2. Jeśli !meta → null (nie istnieje)
  // 3. Jeśli meta.isTombstone → rzuć DeletedObjectError
  // 4. Otwórz plik Read-Only (fs.promises.open, flag 'r')
  // 5. Alokuj BUFFER.alloc(meta.size) — ani bajtu więcej!
  // 6. handle.read(buffer, 0, meta.size, meta.offset)
  // 7. Zamknij uchwyt twardo
  // 8. Rozpakuj: JSON.parse(buffer.toString('utf8'))
  //
  // GWARANCJA PRECYZYJNEGO WYCINKA:
  // Dzięki meta.offset i meta.size odczytujemy DOKŁADNIE ten
  // fragment pliku, który należy do rekordu. Nawet jeśli plik
  // został rozszerzony z zewnątrz (append corruption test),
  // odczytujemy tylko stare bajty — reszta pliku nas nie obchodzi.
  // ============================================================
  public async get(id: string): Promise<unknown | null> {
    const meta = this.map.get(id);

    if (!meta) {
      return null;
    }

    if (meta.isTombstone) {
      throw new DeletedObjectError(id);
    }

    // Otwórz plik Read-Only
    const handle = await fs.open(meta.filePath, 'r');
    try {
      // Alokuj DOKŁADNIE meta.size bajtów
      // Absolutny zakaz czytania o bajt więcej — szczątki sąsiedniego
      // rekordu zniszczyłyby format JSON przy parsowaniu.
      const buffer = Buffer.alloc(meta.size);

      // Precyzyjny odczyt: meta.offset bajtów od początku pliku
      const { bytesRead } = await handle.read(buffer, 0, meta.size, meta.offset);

      if (bytesRead !== meta.size) {
        throw new KeyDirError(
          `KeyDir.get("${id}"): odczytano ${bytesRead}B zamiast ${meta.size}B — ` +
          `plik ${meta.filePath} jest uszkodzony lub obcięty`
        );
      }

      // Rozpakuj — natywny JSON.parse (zakaz msgpackr)
      const parsed = JSON.parse(buffer.toString('utf8'));

      return parsed.data ?? null;
    } finally {
      // Twarde zamknięcie uchwytu — zwolnij deskryptor pliku
      await handle.close();
    }
  }

  // ============================================================
  // delete(id) — Tombstone write
  //
  // Zapisuje znacznik śmierci (tombstone) na końcu pliku i
  // aktualizuje indeks. Rekord jest logicznie usunięty — aplikacja
  // nie zobaczy go przy get(), ale fizycznie pozostaje w pliku
  // aż do kompakcji (Phase 3).
  //
  // Zgodność z Bitcask: tombstone to zwykły rekord z flagą.
  // Kompaktor (Phase 3) usunie fizycznie rekordy tombstone
  // oraz wszystkie starsze wersje tego samego ID.
  // ============================================================
  public async delete(id: string): Promise<DocumentMeta> {
    const existingMeta = this.map.get(id);

    if (!existingMeta) {
      // ID nigdy nie istniało — nie dodawaj do mapy (phantom tombstone).
      // get() zwróci null, bo meta nie ma w indeksie.
      return {
        filePath: this.logFile,
        offset: 0,
        size: 0,
        timestamp: Date.now(),
        isTombstone: true,
      };
    }

    if (existingMeta.isTombstone) {
      // Już tombstone — idempotentny zwrot istniejącego meta
      return existingMeta;
    }

    const timestamp = Date.now();

    // Zapisz tombstone JSONL
    const record: LogRecord = { id, timestamp, tombstone: true };
    const line = JSON.stringify(record) + '\n';
    const encoded = Buffer.from(line, 'utf8');
    const size = encoded.byteLength;

    // Pobierz offset (koniec pliku)
    const stat = await fs.stat(this.logFile);
    const offset = stat.size;

    // Append tombstone
    await fs.appendFile(this.logFile, encoded, { flag: 'a' });

    // Aktualizuj indeks — isTombstone = true, get() rzuci DeletedObjectError
    const meta: DocumentMeta = {
      filePath: this.logFile,
      offset,
      size,
      timestamp,
      isTombstone: true,
    };

    this.map.set(id, meta);

    return meta;
  }

  // ============================================================
  // has(id) — szybkie sprawdzenie istnienia (O(1))
  // ============================================================
  public has(id: string): boolean {
    const meta = this.map.get(id);
    return !!meta && !meta.isTombstone;
  }

  // ============================================================
  // getMeta(id) — dostęp do surowego meta (do diagnostyki)
  // ============================================================
  public getMeta(id: string): DocumentMeta | undefined {
    return this.map.get(id);
  }

  // ============================================================
  // size() — liczba aktywnych wpisów w indeksie
  // ============================================================
  public size(): number {
    let count = 0;
    for (const meta of this.map.values()) {
      if (!meta.isTombstone) count++;
    }
    return count;
  }

  // ============================================================
  // entries() — iteracja po aktywnych wpisach
  // ============================================================
  public entries(): IterableIterator<[string, DocumentMeta]> {
    return this.map.entries();
  }

  // ============================================================
  // setFromWorker(meta) — aktualizacja indeksu z potwierdzenia workera
  //
  // Zgodnie ze specyfikacją Phase 2.1, metoda przeznaczona do
  // wywołania po potwierdzeniu zapisu przez Lonely Author Worker.
  // W architekturze Zero-IPC (Phase 1.3) worker nie wysyła
  // postMessage — potwierdzenie odbywa się przez atomową
  // aktualizację TAIL w SharedArrayBuffer.
  //
  // Metoda pozostawiona dla przyszłej integracji (Phase 2.2+).
  // Obecnie indeks jest aktualizowany synchronicznie w write().
  // ============================================================
  public setFromWorker(id: string, meta: DocumentMeta): void {
    this.map.set(id, meta);
  }

  // ============================================================
  // loadFromHintFile(hintPath) — odbudowa indeksu z hint file
  //
  // Przy starcie system może odbudować indeks RAM skanując
  // hint file (zapisany kompaktowy indeks) zamiast skanować
  // cały log. Implementacja w Phase 3 (Compaction Engine).
  // ============================================================
  public async loadFromHintFile(_hintPath: string): Promise<number> {
    // TODO: Phase 3 — odbudowa indeksu z hint file
    // Na razie zwraca 0 załadowanych wpisów
    return 0;
  }

  // ============================================================
  // getLogFile() — ścieżka do aktywnego pliku logu
  // ============================================================
  public getLogFile(): string {
    return this.logFile;
  }

  // ============================================================
  // getBasePath() — katalog logów
  // ============================================================
  public getBasePath(): string {
    return this.basePath;
  }
}
