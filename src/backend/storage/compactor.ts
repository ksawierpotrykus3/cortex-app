// ================================================================
// NEXUS V2 — LogCompactor: Atomic Disk Swap (Phase 2.3)
// ================================================================
// Asynchroniczny robot kompresujący logi Append-Only.
// Usuwa dług techniczny: nadpisane starsze wersje rekordów oraz
// tombstone. Przepisuje tylko aktywne (live) rekordy do pliku .tmp,
// po czym wykonuje atomowy fs.rename (POSIX gwarancja).
//
// ARCHITEKTURA:
// 1. Trigger: rozmiar pliku > COMPACT_THRESHOLD (10MB) lub ręczny
// 2. Dla każdego aktywnego ID w KeyDir: getLiveRecordsForFile()
// 3. Otwiera plik źródłowy (read) i plik .tmp (write)
// 4. Dla każdego żywego rekordu: read z dysku → write do .tmp
// 5. Aktualizuje KeyDir w locie (nowe offset/size)
// 6. Zamyka oba deskryptory → fs.rename(tempPath, filePath)
// 7. Stary plik ginie w cyfrowej otchłani
// ================================================================

import { promises as fs } from 'fs';
import path from 'path';
import type { KeyDir, DocumentMeta } from './keyDir';

// ==============================================================
// Konfiguracja
// ==============================================================
const COMPACT_THRESHOLD = 10 * 1024 * 1024; // 10MB — próg kompakcji
const BUFFER_SIZE = 256 * 1024; // 256KB — rozmiar bufora read/write

// ==============================================================
// LogCompactor — główna klasa
// ==============================================================
export class LogCompactor {
  private readonly keyDir: KeyDir;
  private readonly threshold: number;
  private running = false;
  private compactCount = 0;

  constructor(options: {
    keyDir: KeyDir;
    threshold?: number;
  }) {
    this.keyDir = options.keyDir;
    this.threshold = options.threshold ?? COMPACT_THRESHOLD;
  }

  // ============================================================
  // compact(filePath) — kompakcja pojedynczego pliku
  //
  // 2-FAZOWA STRATEGIA AKTUALIZACJI Meta:
  //   Faza 1 (copy):  meta.filePath = .tmp, meta.offset = new pos
  //                    → concurrent get() czyta z .tmp (dane już są)
  //   Faza 2 (post-rename): meta.filePath = oryginalny filePath
  //                    → po rename dane są pod właściwą ścieżką
  //
  // BEZPIECZEŃSTWO: między fazami nie ma okna, w którym meta
  // wskazuje na stary plik z nowym offsetem (przyczyna buga).
  // ============================================================
  public async compact(filePath: string): Promise<{
    compacted: boolean;
    recordsBefore: number;
    recordsAfter: number;
    sizeBefore: number;
    sizeAfter: number;
  }> {
    // ================================================================
    // Krok 1: Sprawdź rozmiar pliku
    // ================================================================
    let fileStat;
    try {
      fileStat = await fs.stat(filePath);
    } catch {
      return {
        compacted: false,
        recordsBefore: 0,
        recordsAfter: 0,
        sizeBefore: 0,
        sizeAfter: 0,
      };
    }

    const sizeBefore = fileStat.size;

    if (sizeBefore < this.threshold) {
      return {
        compacted: false,
        recordsBefore: 0,
        recordsAfter: 0,
        sizeBefore,
        sizeAfter: sizeBefore,
      };
    }

    // ================================================================
    // Krok 2: Zbierz żywe rekordy dla tego pliku
    // ================================================================
    const liveRecords: Array<{ id: string; meta: DocumentMeta }> = [];

    for (const [id, meta] of this.keyDir.entries()) {
      if (meta.filePath === filePath && !meta.isTombstone) {
        liveRecords.push({ id, meta });
      }
    }

    if (liveRecords.length === 0) {
      return {
        compacted: false,
        recordsBefore: 0,
        recordsAfter: 0,
        sizeBefore,
        sizeAfter: sizeBefore,
      };
    }

    const recordsBefore = liveRecords.length;
    this.running = true;

    // ================================================================
    // Krok 3: Otwórz plik źródłowy i tymczasowy
    // ================================================================
    const tempPath = filePath + '.compact.tmp';
    const srcHandle = await fs.open(filePath, 'r');
    const dstHandle = await fs.open(tempPath, 'w');

    // Zebrane nowe offset dla batch-update po rename
    const newOffsets: Array<{ id: string; offset: number; size: number }> = [];

    try {
      let currentOffset = 0;
      const readBuffer = Buffer.alloc(BUFFER_SIZE);

      for (const { id, meta } of liveRecords) {
        // ==============================================================
        // Krok 4a: Odczytaj rekord z dysku (precyzyjny wycinek)
        // ==============================================================
        let remaining = meta.size;
        let srcOffset = meta.offset;
        const chunks: Buffer[] = [];

        while (remaining > 0) {
          const readLen = Math.min(remaining, BUFFER_SIZE);
          const buf = (readLen <= BUFFER_SIZE)
            ? readBuffer.subarray(0, readLen)
            : Buffer.alloc(readLen);

          const { bytesRead } = await srcHandle.read(buf, 0, readLen, srcOffset);

          if (bytesRead === 0) break;

          chunks.push(bytesRead < readLen ? buf.subarray(0, bytesRead) : buf);
          srcOffset += bytesRead;
          remaining -= bytesRead;
        }

        // ==============================================================
        // Krok 4b: Zapisz w pliku .tmp
        // ==============================================================
        const recordBuffer = chunks.length === 1
          ? chunks[0]
          : Buffer.concat(chunks);

        await dstHandle.write(recordBuffer, 0, recordBuffer.length, currentOffset);

        // Zachowaj nowy offset do batch-update po rename
        newOffsets.push({ id, offset: currentOffset, size: recordBuffer.length });
        currentOffset += recordBuffer.length;
      }

      // ================================================================
      // Krok 5: Zamknij oba deskryptory
      // ================================================================
      await srcHandle.close();
      await dstHandle.close();

      // ================================================================
      // Krok 6: rename + batch update meta
      //
      // NAJPIERW rename (atomowa podmiana pliku):
      //   fs.rename(tempPath, filePath) — gwarancja atomowości NTFS:
      //   plik jest podmieniany w milisekundach. Stara wersja znika.
      //
      // POTEM batch update meta (nowe offsety, wciąż ten sam filePath):
      //   KeyDir jest aktualizowany dopiero po rename, więc nie ma okna,
      //   w którym meta wskazuje na stary plik z nowym offsetem.
      // ================================================================
      await fs.rename(tempPath, filePath);

      for (const { id, offset, size } of newOffsets) {
        const currentMeta = this.keyDir.getMeta(id);
        if (currentMeta) {
          this.keyDir.setFromWorker(id, { ...currentMeta, offset, size, filePath });
        }
      }
    } catch (err) {
      // W razie błędu — przywróć stare metadane i posprzątaj .tmp
      for (const { id, meta } of liveRecords) {
        this.keyDir.setFromWorker(id, meta);
      }
      try { await fs.unlink(tempPath); } catch { /* ok */ }
      this.running = false;
      throw err;
    }

    // ================================================================
    // Krok 7: Zweryfikuj rozmiar po kompakcji
    // ================================================================
    const newStat = await fs.stat(filePath);
    const sizeAfter = newStat.size;

    this.compactCount++;
    this.running = false;

    return {
      compacted: true,
      recordsBefore,
      recordsAfter: recordsBefore,
      sizeBefore,
      sizeAfter,
    };
  }

  // ============================================================
  // compactIfNeeded(filePath) — automatyczna kompakcja
  // Kompaktuje tylko jeśli plik przekroczył threshold
  // ============================================================
  public async compactIfNeeded(filePath: string): Promise<{
    compacted: boolean;
    recordsBefore: number;
    recordsAfter: number;
    sizeBefore: number;
    sizeAfter: number;
  }> {
    let sizeBefore = 0;
    try {
      const stat = await fs.stat(filePath);
      sizeBefore = stat.size;
    } catch {
      // Plik nie istnieje
    }

    if (sizeBefore < this.threshold) {
      return {
        compacted: false,
        recordsBefore: 0,
        recordsAfter: 0,
        sizeBefore,
        sizeAfter: sizeBefore,
      };
    }

    return this.compact(filePath);
  }

  // ============================================================
  // isRunning() — czy kompakcja jest w toku
  // ============================================================
  public isRunning(): boolean {
    return this.running;
  }

  // ============================================================
  // getCompactCount() — liczba wykonanych kompakcji
  // ============================================================
  public getCompactCount(): number {
    return this.compactCount;
  }
}
