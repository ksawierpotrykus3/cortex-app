// ================================================================
// NEXUS V2 — Indexer: Binary Stream Rebuilding (Phase 2.2)
// ================================================================
// Niskopoziomowy czytnik startowy do odbudowy indeksu KeyDir.
// Odrzuca `readline` — samodzielnie skanuje binarne Buffer
// w poszukiwaniu 0x0A ('\n') jako separatora rekordów.
//
// STRATEGIA 2-PRZEBIEGOWA:
//   Przebieg 1: createReadStream → skanowanie 0x0A → lista pozycji
//   Przebieg 2: fs.open + handle.read → precyzyjny odczyt każdego
//               rekordu (Buffer.alloc dokładnego rozmiaru)
//
// ODPORNOŚĆ NA \r\n vs \n:
//   - separator = 0x0A ('\n')
//   - Jeśli linia kończy się na 0x0D ('\r'), obcinamy przed parse
//   - Identyczne działanie na Windows i Linux
//
// BEZPIECZEŃSTWO UTF-8:
//   - Strumień binarny (createReadStream bez kodowania)
//   - 0x0A nie występuje w środku sekwencji UTF-8:
//     - ASCII 0x00-0x7F: 0x0A to LF (znak kontrolny, nie w środku)
//     - 2-bajtowe: 0xC0-0xDF + 0x80-0xBF (0x0A w 0x80-0xBF? NIE)
//     - 3-bajtowe: 0xE0-0xEF + 0x80-0xBF (0x0A w 0x80-0xBF? NIE)
//     - 4-bajtowe: 0xF0-0xF4 + 0x80-0xBF (0x0A = 00001010, nie w tym
//       zakresie) → Żaden wielobajtowy znak nie zawiera 0x0A
// ================================================================

import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import type { DocumentMeta } from './keyDir';

// ==============================================================
// Konfiguracja
// ==============================================================
const NEWLINE = 0x0a; // '\n'
const CARRIAGE_RETURN = 0x0d; // '\r'
const MAX_RECORD_SIZE = 10 * 1024 * 1024; // 10MB — ochrona przed OOM

// ==============================================================
// rebuildIndex(targetDir, onRecord) — odbudowa indeksu
//
// 1. Skanuje wszystkie pliki *.jsonl w katalogu (sortuje)
// 2. Dla każdego pliku: 2-przebiegowy rebuildFromFile
// 3. Woła onRecord(id, meta) dla każdego znalezionego rekordu
//
// Zwraca: liczbę odbudowanych rekordów
// ==============================================================
export async function rebuildFromFileV2(
  filePath: string,
  onRecord: (id: string, meta: DocumentMeta) => void
): Promise<number> {
  return rebuildFromFile(filePath, onRecord);
}

export async function rebuildIndex(
  targetDir: string,
  onRecord: (id: string, meta: DocumentMeta) => void
): Promise<number> {
  let totalRecords = 0;

  let files: string[];
  try {
    files = await fs.readdir(targetDir);
  } catch {
    return 0;
  }

  const jsonlFiles = files
    .filter((f) => f.endsWith('.jsonl'))
    .sort()
    .map((f) => targetDir + '/' + f);

  for (const filePath of jsonlFiles) {
    const count = await rebuildFromFile(filePath, onRecord);
    totalRecords += count;
  }

  return totalRecords;
}

// ==============================================================
// rebuildFromFile(filePath, onRecord) — 2-przebiegowy rebuild
//
// Przebieg 1: Skanuje plik binarnie, znajduje wszystkie pozycje
//             znaku '\n' (0x0A). Rezultat: lista newlinePositions.
//
// Przebieg 2: Otwiera plik (fs.open), dla każdego rekordu:
//   a) Odczytuje dokładnie lineLength bajtów z lineStart
//   b) Obcina '\r' jeśli obecny (CRLF Windows)
//   c) JSON.parse → wyciąga id, timestamp, tombstone flag
//   d) Konstruuje DocumentMeta z precyzyjnym offset i size
//   e) Woła onRecord(id, meta)
// ==============================================================
async function rebuildFromFile(
  filePath: string,
  onRecord: (id: string, meta: DocumentMeta) => void
): Promise<number> {
  let fileSize: number;
  try {
    const stat = await fs.stat(filePath);
    if (stat.size === 0) return 0;
    fileSize = stat.size;
  } catch {
    return 0;
  }

  // ================================================================
  // PRZEBIEG 1: Skanowanie binarne — znajdź wszystkie '\n'
  // ================================================================
  const newlinePositions: number[] = [];

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath, {
      highWaterMark: 256 * 1024, // 256KB na chunk
    });
    let offset = 0;

    stream.on('data', (chunk: Buffer) => {
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] === NEWLINE) {
          newlinePositions.push(offset + i);
        }
      }
      offset += chunk.length;
    });

    stream.on('end', () => {
      // Jeśli plik nie kończy się '\n', dodaj sztuczny koniec
      const lastPos = newlinePositions[newlinePositions.length - 1];
      if (lastPos === undefined || lastPos !== fileSize - 1) {
        newlinePositions.push(fileSize);
      }
      resolve();
    });

    stream.on('error', reject);
  });

  if (newlinePositions.length === 0) return 0;

  // ================================================================
  // PRZEBIEG 2: Precyzyjny odczyt każdego rekordu z dysku
  // ================================================================
  const handle = await fs.open(filePath, 'r');
  let recordCount = 0;

  try {
    let prevNewline = -1; // Pozycja przed pierwszym bajtem pliku

    for (const pos of newlinePositions) {
      const lineStart = prevNewline + 1;
      const lineEnd = (pos === fileSize) ? fileSize : pos;
      const lineLength = lineEnd - lineStart;

      if (lineLength > 0) {
        const readLen = Math.min(lineLength, MAX_RECORD_SIZE);
        const buffer = Buffer.alloc(readLen);
        const { bytesRead } = await handle.read(buffer, 0, readLen, lineStart);

        if (bytesRead === 0) break;

        const rawLine = (bytesRead < readLen)
          ? buffer.subarray(0, bytesRead)
          : buffer;

        // Obetnij '\r' (Windows CRLF → CRLF → LF)
        const line = (rawLine.length > 0 && rawLine[rawLine.length - 1] === CARRIAGE_RETURN)
          ? rawLine.subarray(0, rawLine.length - 1)
          : rawLine;

        if (line.length > 0) {
          try {
            const parsed = JSON.parse(line.toString('utf8'));
            const id = parsed.id;
            if (typeof id === 'string' && id.length > 0) {
              const timestamp = parsed.timestamp ?? Date.now();
              const isTombstone = parsed.tombstone === true;

              // Rozmiar rekordu na dysku = linia + newline
              // Jeśli plik nie kończy się newline, ostatni rekord nie ma go
              const recordSize = (pos < fileSize) ? lineLength + 1 : lineLength;

              const meta: DocumentMeta = {
                filePath,
                offset: lineStart,
                size: recordSize,
                timestamp,
                isTombstone,
              };

              onRecord(id, meta);
              recordCount++;
            }
          } catch {
            // Zły JSON — pomiń uszkodzony rekord (korupcja w starym logu)
          }
        }
      }

      prevNewline = pos;
    }
  } finally {
    await handle.close();
  }

  return recordCount;
}
