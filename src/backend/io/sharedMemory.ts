// ================================================================
// NEXUS V2 — ZCSMAP: Zero-Copy Shared Memory Circular Buffer
// Moduł: Shared Memory Kernel (Phase 1.2 — Lock-Free)
// ================================================================
// - Atomics.add do rezerwacji HEAD (Lock-Free, multi-producer)
// - TextEncoder/TextDecoder natywne V8 (brak msgpackr)
// - Natural split-write (brak Magic Wrap 0xFFFFFFFF)
// - Split-char protection po stronie odczytu: składanie bajtów
//   przed dekodowaniem UTF-8
// ================================================================

const META_SIZE_BYTES = 64;
const DEFAULT_BUFFER_SIZE = 10 * 1024 * 1024;

const META_HEAD = 0;
const META_TAIL = 1;
const META_LOCK = 2;
const META_OPEN = 3;

export class SharedMemoryBuffer {
  public readonly sab: SharedArrayBuffer;
  public readonly meta: Int32Array;
  public readonly data: Uint8Array;
  public readonly capacity: number;

  constructor(sizeBytes: number = DEFAULT_BUFFER_SIZE) {
    if (sizeBytes < META_SIZE_BYTES + 1) {
      throw new RangeError(
        `SharedMemoryBuffer: rozmiar ${sizeBytes} < minimum ${META_SIZE_BYTES + 1}`
      );
    }
    this.sab = new SharedArrayBuffer(sizeBytes);
    this.meta = new Int32Array(this.sab, 0, 16);
    this.data = new Uint8Array(this.sab, META_SIZE_BYTES);
    this.capacity = this.data.byteLength;
    Atomics.store(this.meta, META_HEAD, 0);
    Atomics.store(this.meta, META_TAIL, 0);
    Atomics.store(this.meta, META_LOCK, 0);
    Atomics.store(this.meta, META_OPEN, 1);
    this.data.fill(0);
  }

  // ==============================================================
  // _getUsed() — zajęte bajty
  // HEAD >= TAIL → used = head - tail
  // HEAD < TAIL → overflow 32-bit lub test: used = capacity - tailPos + headPos
  // ==============================================================
  private _getUsed(head: number, tail: number): number {
    if (head === tail) return 0;
    if (head > tail) {
      const diff = head - tail;
      return diff >= this.capacity ? this.capacity : diff;
    }
    const headPos = head % this.capacity;
    const tailPos = tail % this.capacity;
    const used = this.capacity - tailPos + headPos;
    return used >= this.capacity ? this.capacity : used;
  }

  public getAvailableSpace(): number {
    const head = Atomics.load(this.meta, META_HEAD) >>> 0;
    const tail = Atomics.load(this.meta, META_TAIL) >>> 0;
    return this.capacity - this._getUsed(head, tail);
  }

  // ==============================================================
  // write(payloadText) — Lock-Free zapis tekstu
  //
  // 1. TextEncoder().encode(payloadText) — natywna UTF-8 w V8
  // 2. Spin-wait na wolną przestrzeń (_getUsed)
  // 3. Atomics.add(this.meta, META_HEAD, totalLen) — Lock-Free
  // 4. Zapis 4-bajtowego nagłówka Uint32 LE
  // 5. Zapis payloadu — naturalny split-write przy końcu bufora
  // 6. Atomics.notify — obudzenie konsumenta
  //
  // Zwraca: liczbę znaków UTF-16 zapisanego tekstu.
  // ==============================================================
  public write(payloadText: string): number {
    if (Atomics.load(this.meta, META_OPEN) === 0) {
      throw new Error('ZCSMAP: próba zapisu do zamkniętego bufora');
    }

    const encoded: Uint8Array = new TextEncoder().encode(payloadText);
    const payloadLen = encoded.byteLength;
    const totalLen = 4 + payloadLen;

    if (totalLen > this.capacity) {
      throw new Error(
        `ZCSMAP: payload ${totalLen}B przekracza pojemność ${this.capacity}B`
      );
    }

    // ================================================================
    // Spin-wait na wolną przestrzeń
    // ================================================================
    while (true) {
      const head = Atomics.load(this.meta, META_HEAD) >>> 0;
      const tail = Atomics.load(this.meta, META_TAIL) >>> 0;
      const used = this._getUsed(head, tail);
      if (used + totalLen <= this.capacity) break;
      Atomics.wait(this.meta, META_TAIL, tail, 1);
    }

    // ================================================================
    // Atomics.add — Lock-Free rezerwacja HEAD (multi-producer safe)
    // Zwraca starą wartość HEAD przed dodaniem
    // ================================================================
    const linearStart: number = Atomics.add(this.meta, META_HEAD, totalLen) >>> 0;
    const bufPos: number = linearStart % this.capacity;

    // ================================================================
    // Zapis 4-bajtowego nagłówka z rozmiarem (little-endian Uint32)
    // ================================================================
    this._writeUint32LE(bufPos, payloadLen);

    // ================================================================
    // Zapis bajtów payloadu z naturalnym split-write
    // ================================================================
    const payloadBufPos: number = (bufPos + 4) % this.capacity;
    this._writeBytesAt(payloadBufPos, encoded);

    // Obudź konsumenta
    Atomics.notify(this.meta, META_HEAD, 1);

    return payloadText.length;
  }

  // ==============================================================
  // read() — odczyt z ochroną split-char
  //
  // 1. Odczytaj 4-bajtowy nagłówek (obsługa wrap-around)
  // 2. Jeśli pusty payload → przesuń TAIL
  // 3. Odczytaj bajty payloadu — jeśli zawinięte, sklej w całość
  // 4. Dekoduj UTF-8 przez TextDecoder na scalonym buforze
  //    (gwarancja integralności znaków multi-bajtowych)
  // 5. Przesuń TAIL o 4 + payloadLen
  //
  // Zwraca: string lub null jeśli bufor pusty.
  // ==============================================================
  public read(): string | null {
    const head: number = Atomics.load(this.meta, META_HEAD) >>> 0;
    const tail: number = Atomics.load(this.meta, META_TAIL) >>> 0;

    if (tail === head) return null;

    const tailPos: number = tail % this.capacity;

    // Odczytaj 4-bajtowy nagłówek
    const payloadLen: number = this._readUint32LE(tailPos, 4);

    if (payloadLen === 0) {
      const newTail: number = tail + 4;
      Atomics.store(this.meta, META_TAIL, newTail);
      Atomics.notify(this.meta, META_TAIL, 1);
      return '';
    }

    // Odczytaj bajty payloadu (z automatycznym składaniem przy wrap)
    const payloadBufPos: number = (tailPos + 4) % this.capacity;
    const payloadBuf: Uint8Array = this._readBytesAt(payloadBufPos, payloadLen);

    // ================================================================
    // DEKODOWANIE UTF-8 — BEZPIECZNE PRZED SPLIT-CHAR
    // TextDecoder operuje na kompletnym, scalonym Uint8Array.
    // Znaki wielobajtowe (np. "ż" = 0xC5 0xBC) nie zostaną rozcięte,
    // ponieważ _readBytesAt scalił zawinięte bajty w jeden bufor.
    // ================================================================
    const decoded: string = new TextDecoder().decode(payloadBuf);

    // Przesuń TAIL
    const newTail: number = tail + 4 + payloadLen;
    Atomics.store(this.meta, META_TAIL, newTail);
    Atomics.notify(this.meta, META_TAIL, 1);

    return decoded;
  }

  // ==============================================================
  // _writeUint32LE — zapis 4 bajtów LE w pozycji bufPos
  // ==============================================================
  private _writeUint32LE(bufPos: number, value: number): void {
    const untilEnd = this.capacity - bufPos;

    if (4 <= untilEnd) {
      this.data[bufPos] = value & 0xFF;
      this.data[bufPos + 1] = (value >>> 8) & 0xFF;
      this.data[bufPos + 2] = (value >>> 16) & 0xFF;
      this.data[bufPos + 3] = (value >>> 24) & 0xFF;
    } else {
      // Header zawija się — zapisz w 2 częściach
      for (let i = 0; i < 4; i++) {
        const pos = (bufPos + i) % this.capacity;
        this.data[pos] = (value >>> (i * 8)) & 0xFF;
      }
    }
  }

  // ==============================================================
  // _readUint32LE — odczyt 4 bajtów LE z pozycji bufPos
  // ==============================================================
  private _readUint32LE(bufPos: number, _length?: number): number {
    let b0, b1, b2, b3;

    if (bufPos + 4 <= this.capacity) {
      b0 = this.data[bufPos];
      b1 = this.data[bufPos + 1];
      b2 = this.data[bufPos + 2];
      b3 = this.data[bufPos + 3];
    } else {
      // Header zawinięty — czytaj z wrap-around
      b0 = this.data[bufPos];
      b1 = this.data[(bufPos + 1) % this.capacity];
      b2 = this.data[(bufPos + 2) % this.capacity];
      b3 = this.data[(bufPos + 3) % this.capacity];
    }

    return (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0;
  }

  // ==============================================================
  // _writeBytesAt — zapis tablicy bajtów z naturalnym split-write
  // ==============================================================
  private _writeBytesAt(bufPos: number, bytes: Uint8Array): void {
    const len = bytes.byteLength;
    const untilEnd = this.capacity - bufPos;

    if (len <= untilEnd) {
      this.data.set(bytes, bufPos);
    } else {
      // Natural split: część od bufPos do końca + reszta od początku
      this.data.set(bytes.subarray(0, untilEnd), bufPos);
      this.data.set(bytes.subarray(untilEnd), 0);
    }
  }

  // ==============================================================
  // _readBytesAt — odczyt bajtów z automatycznym składaniem wrap
  // Zwraca: nowy, scalony Uint8Array (gotowy do TextDecoder)
  // ==============================================================
  private _readBytesAt(bufPos: number, length: number): Uint8Array {
    const result = new Uint8Array(length);
    const untilEnd = this.capacity - bufPos;

    if (length <= untilEnd) {
      result.set(this.data.subarray(bufPos, bufPos + length));
    } else {
      // Składanie: część z końca + część z początku
      result.set(this.data.subarray(bufPos, this.capacity));
      result.set(this.data.subarray(0, length - untilEnd), untilEnd);
    }

    return result;
  }

  // ==============================================================
  // close() / reset() / stats()
  // ==============================================================
  public close(): void {
    Atomics.store(this.meta, META_OPEN, 0);
    Atomics.notify(this.meta, META_HEAD, 1);
  }

  public reset(): void {
    Atomics.store(this.meta, META_HEAD, 0);
    Atomics.store(this.meta, META_TAIL, 0);
    this.data.fill(0);
  }

  public stats(): {
    head: number;
    tail: number;
    used: number;
    available: number;
    capacity: number;
    open: boolean;
  } {
    const head = Atomics.load(this.meta, META_HEAD) >>> 0;
    const tail = Atomics.load(this.meta, META_TAIL) >>> 0;
    const used = this._getUsed(head, tail);
    return {
      head,
      tail,
      used,
      available: this.capacity - used,
      capacity: this.capacity,
      open: Atomics.load(this.meta, META_OPEN) === 1,
    };
  }
}
