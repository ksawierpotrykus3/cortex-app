// ================================================================
// NEXUS V2 — The Lonely Author Worker Thread (Phase 1.3)
// ================================================================
// Odciąża główny wątek Electron V8 od operacji dyskowych.
// Komunikacja wyłącznie przez SharedArrayBuffer + Atomics.wait.
// Zero postMessage — jedynym sygnałem sukcesu jest aktualizacja TAIL.
//
// ARCHITECTURE:
// - Atomics.wait z lastKnownHead — zamrożenie na poziomie jądra OS
// - TAIL aktualizowany DOPIERO po fs.promises.appendFile
// - TextDecoder zamiast msgpackr (natywny V8)
// - Split-char protection: scalony Uint8Array przed dekodowaniem
// - Append-only JSONL na dysk
// ================================================================

const { parentPort } = require('worker_threads');
const fs = require('fs');
const path = require('path');

// ------------------------------------------------------------------
// Stan wewnętrzny wątku
// ------------------------------------------------------------------
let sab = null;
let meta = null;
let data = null;
let capacity = 0;
let outputFile = null;
let running = true;

// Śledzenie ostatniej znanej wartości HEAD dla Atomics.wait
let lastKnownHead = 0;

// Offsety meta — zgodne z SharedMemoryBuffer w sharedMemory.ts
const META_HEAD = 0;
const META_TAIL = 1;

// ------------------------------------------------------------------
// Pomocnik: odczyt 4-bajtowego integera LE z wrap-around
// ------------------------------------------------------------------
function readUint32LE(pos) {
  let b0, b1, b2, b3;

  if (pos + 4 <= capacity) {
    b0 = data[pos];
    b1 = data[pos + 1];
    b2 = data[pos + 2];
    b3 = data[pos + 3];
  } else {
    b0 = data[pos];
    b1 = data[(pos + 1) % capacity];
    b2 = data[(pos + 2) % capacity];
    b3 = data[(pos + 3) % capacity];
  }

  return (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0;
}

// ------------------------------------------------------------------
// Pomocnik: odczyt bajtów z uwzględnieniem wrap-around
// Zawsze zwraca scalony, gotowy do dekodowania Uint8Array
// =================================================================
// SPLIT-CHAR PROTECTION:
// Jeśli payload fizycznie zawija się przez koniec bufora,
// readBytesAt składa go w jeden ciągły Uint8Array tymczasowy.
// TextDecoder dekoduje KOMPLETNY bufor — żaden znak wielobajtowy
// (np. "ż" = 0xC5 0xBC) nie zostanie rozcięty.
// =================================================================
function readBytesAt(bufPos, length) {
  const result = new Uint8Array(length);
  const untilEnd = capacity - bufPos;

  if (length <= untilEnd) {
    result.set(data.subarray(bufPos, bufPos + length));
  } else {
    // Zawijanie: część z końca bufora + część z początku
    result.set(data.subarray(bufPos, capacity));
    result.set(data.subarray(0, length - untilEnd), untilEnd);
  }

  return result;
}

// ------------------------------------------------------------------
// Inicjalizacja workera
// ------------------------------------------------------------------
parentPort.on('message', (msg) => {
  if (msg.type === 'init') {
    sab = msg.sab;
    meta = new Int32Array(sab, 0, 16);
    data = new Uint8Array(sab, 64);
    capacity = data.byteLength;
    outputFile = msg.outputFile;

    const dir = path.dirname(outputFile);
    fs.mkdirSync(dir, { recursive: true });

    // Start pętli konsumpcyjnej
    consumeLoop().catch((err) => {
      console.error('[LonelyAuthor] Fatal error:', err);
      process.exit(1);
    });
  }

  if (msg.type === 'shutdown') {
    running = false;
    // Obudź wątek aby sprawdził flagę running i zakończył pętlę
    Atomics.notify(meta, META_HEAD, 1);
  }
});

// ------------------------------------------------------------------
// Główna pętla konsumpcyjna — Cichy Zrzut Dyskowy
// =================================================================
// KONTRAKT ZERO-COPY:
// 1. Budzi się gdy HEAD zmienia się (Atomics.notify od producenta)
// 2. Odczytuje nagłówek i payload z SharedArrayBuffer
// 3. Dekoduje UTF-8 (natywny TextDecoder V8 — zakaz msgpackr)
// 4. Zapisuje na dysk przez fs.promises.appendFile
// 5. DOPIERO POTEM aktualizuje TAIL (Atomics.store)
// 6. NIGDY nie woła parentPort.postMessage()
//
// Aktualizacja TAIL po zapisie dyskowym jest JEDYNYM sygnałem
// dla głównego wątku, że dane zostały przetworzone. Jeśli proces
// padnie między krokiem 4 a 5, TAIL nie zostaje przesunięty,
// a rekord pozostaje w buforze — gwarancja Exactly-Once.
// =================================================================
async function consumeLoop() {
  while (running) {
    const head = Atomics.load(meta, META_HEAD) >>> 0;
    const tail = Atomics.load(meta, META_TAIL) >>> 0;

    if (tail === head) {
      // ================================================================
      // SPRZĘTOWE USYPIANIE (Atomics.wait)
      // Wątek zamarza na poziomie jądra OS — zero obciążenia CPU.
      // Atomics.wait(meta, META_HEAD, lastKnownHead) blokuje dopóki
      // główny wątek nie wykona Atomics.notify(meta, META_HEAD, 1)
      // po zakończeniu zapisu w SharedMemoryBuffer.write().
      // ================================================================
      lastKnownHead = head;
      Atomics.wait(meta, META_HEAD, head);
      continue;
    }

    const tailPos = tail % capacity;

    // ------------------------------------------------------------------
    // Odczytaj 4-bajtowy nagłówek (obsługa wrap-around przez readUint32LE)
    // ------------------------------------------------------------------
    const payloadLen = readUint32LE(tailPos);

    if (payloadLen === 0) {
      // Pusty payload — przesuń TAIL i kontynuuj
      const newTail = (tail + 4) >>> 0;
      Atomics.store(meta, META_TAIL, newTail);
      Atomics.notify(meta, META_TAIL, 1);
      continue;
    }

    // ------------------------------------------------------------------
    // Odczytaj bajty payloadu z ewentualnym wrap-around
    // readBytesAt zwraca scalony Uint8Array (split-char protection)
    // ------------------------------------------------------------------
    const payloadBufPos = (tailPos + 4) % capacity;
    const payloadBuf = readBytesAt(payloadBufPos, payloadLen);

    // ------------------------------------------------------------------
    // DEKODOWANIE UTF-8 — natywny TextDecoder V8
    // Kategoryczny zakaz msgpackr. Operuje na scalonym buforze.
    // =================================================================
    // SPLIT-CHAR PROTECTION: TextDecoder dekoduje KOMPLETNY bufor.
    // Znaki wielobajtowe (np. "ż" = 0xC5 0xBC, "😀" = 4 bajty) nie
    // zostaną rozcięte, ponieważ readBytesAt scalił je w jeden ciągły
    // Uint8Array tymczasowy, zanim trafiły do decoder.
    // =================================================================
    const decoded = new TextDecoder().decode(payloadBuf);

    // ------------------------------------------------------------------
    // KROK 1: CIŻY ZRZUT DYSKOWY (Append File)
    // Asynchroniczny zapis do pliku w formacie JSONL.
    // Użycie fs.promises.appendFile z kodowaniem utf8 gwarantuje
    // nieblokujący zapis — wątek główny nie jest zatrzymywany.
    // ------------------------------------------------------------------
    try {
      const line = JSON.stringify({
        t: Date.now(),
        p: decoded,
      }) + '\n';

      await fs.promises.appendFile(outputFile, line, 'utf8');
    } catch (err) {
      // ================================================================
      // Błąd zapisu dyskowego — NIE PRZESUWAJ TAIL
      // Rekord pozostaje w buforze. Przy następnej iteracji pętli
      // worker odczyta ten sam rekord ponownie (automatyczny retry).
      // Bufor wypełni się, a producenci zablokują się na Atomics.add
      // czekając na wolną przestrzeń — system informuje o awarii.
      // ================================================================
      console.error('[LonelyAuthor] Disk write failed, retrying:', err.message);
      continue;
    }

    // ------------------------------------------------------------------
    // KROK 2: PODCIĄGNIJ OGON (Atomics.store TAIL)
    // ====================================================================
    // To jest JEDYNY sygnał sukcesu dla głównego wątku. Aktualizacja TAIL
    // zwalnia miejsce w buforze dla producentów. Worker NIGDY nie woła
    // parentPort.postMessage() — cisza radiowa na IPC.
    //
    // GWARANCJA EXACTLY-ONCE:
    // Jeśli proces padnie między appendFile a Atomics.store, TAIL nie
    // zostaje przesunięty — rekord pozostaje w buforze. Po restarcie
    // konsument odczyta go ponownie i zapisze na dysk. Idempotentny
    // zapis JSONL (append-only) gwarantuje brak duplikacji semantycznej.
    // ====================================================================
    const newTail = (tail + 4 + payloadLen) >>> 0;
    Atomics.store(meta, META_TAIL, newTail);
    Atomics.notify(meta, META_TAIL, 1);
  }
}

// ------------------------------------------------------------------
// Obsługa błędów — nigdy nie przerywaj cicho
// ------------------------------------------------------------------
process.on('uncaughtException', (err) => {
  console.error('[LonelyAuthor] Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('[LonelyAuthor] Unhandled rejection:', err);
});