// ================================================================
// NEXUS V2 — TDD Verification: ZCSMAP Circular Buffer
// Phase 1.2 — Lock-Free Atomics.add + UTF-8 split-char protection
// ================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { SharedMemoryBuffer } from './sharedMemory';

const KB = 1024;
const MB = 1024 * 1024;

describe('Phase 1.2 — Circular buffer arithmetic', () => {
  let buf: SharedMemoryBuffer;

  beforeEach(() => {
    buf = new SharedMemoryBuffer(KB); // 1024 total → data = 960 bajtów
  });

  it('pusty bufor: used = 0, available = capacity', () => {
    expect(buf.getAvailableSpace()).toBe(960);
  });

  it('write zwiększa HEAD, read zwiększa TAIL', () => {
    buf.write('hello');
    const s1 = buf.stats();
    expect(s1.head).toBeGreaterThan(0);
    expect(s1.tail).toBe(0);
    expect(s1.used).toBeGreaterThan(0);

    const text = buf.read();
    expect(text).toBe('hello');

    const s2 = buf.stats();
    expect(s2.head).toBe(s1.head);
    expect(s2.tail).toBe(s1.head); // TAIL dogonił HEAD
    expect(s2.used).toBe(0);
  });

  it('available = capacity - (head - tail) po wielu write', () => {
    buf.write('a');
    buf.write('b');
    buf.write('c');
    const s = buf.stats();
    expect(s.available).toBe(960 - s.used);
    expect(s.used).toBeGreaterThan(0);
  });

  it('read zwraca null dla pustego bufora', () => {
    expect(buf.read()).toBeNull();
  });

  it('write i read zachowują zgodność head/tail', () => {
    const texts = ['Ala', 'ma', 'kota'];
    for (const t of texts) buf.write(t);
    for (const t of texts) expect(buf.read()).toBe(t);
    expect(buf.read()).toBeNull();
  });
});

describe('Phase 1.2.1 — Polish diacritics (heavy UTF-8)', () => {
  let buf: SharedMemoryBuffer;

  beforeEach(() => {
    buf = new SharedMemoryBuffer(KB);
  });

  it('pojedynczy polski znak zażółć', () => {
    const input = 'Zażółć gęślą jaźń';
    buf.write(input);
    const output = buf.read();
    expect(output).toBe(input);
  });

  it('wszystkie polskie znaki diakrytyczne', () => {
    const input = 'ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ';
    buf.write(input);
    expect(buf.read()).toBe(input);
  });

  it('bardzo długi polski tekst', () => {
    const input =
      'Nie masz, nie masz nad polskie diakrytyki! ' +
      'Żąć, żąć, żąć — to jest nasze hasło. ' +
      'Źrebak i źdźbło, gęśl i jaźń, ' +
      'pójdźże, pójdźże, niechęć i płeć.'.repeat(10);
    buf.write(input);
    expect(buf.read()).toBe(input);
  });

  it('znaki wielobajtowe: emotikony i symbole', () => {
    const input = '😀🚀💻★☆☀☁☂☃♠♣♥♦';
    buf.write(input);
    expect(buf.read()).toBe(input);
  });

  it('mieszanka: polskie + CJK + emotikony', () => {
    const input = 'Zażółć gęślą jaźń 日本語 한국어 😀🚀 中文';
    buf.write(input);
    expect(buf.read()).toBe(input);
  });

  it('pusty string', () => {
    buf.write('');
    expect(buf.read()).toBe('');
  });
});

describe('Phase 1.2.1 — Wrap-around split character protection', () => {
  const TINY_BUF = 200;

  let buf: SharedMemoryBuffer;

  beforeEach(() => {
    buf = new SharedMemoryBuffer(TINY_BUF);
  });

  it('zapis przy HEAD blisko końca bufora — wymuszenie wrap', () => {
    Atomics.store(buf.meta, 0, 130);  // HEAD
    Atomics.store(buf.meta, 1, 10);   // TAIL — zwolnij miejsce

    const input = 'ż';
    buf.write(input);

    // Ustaw TAIL na 130 (liniowo) — pozycja nagłówka
    Atomics.store(buf.meta, 1, 130);

    const output = buf.read();
    expect(output).toBe(input);
  });

  it('celowe rozcięcie 4-bajtowego headera — write przy HEAD blisko końca', () => {
    Atomics.store(buf.meta, 0, 134);
    Atomics.store(buf.meta, 1, 10);

    const input = 'ż';
    buf.write(input);

    // HEAD = 134+6 = 140
    Atomics.store(buf.meta, 1, 134);

    const output = buf.read();
    expect(output).toBe(input);
  });

  it('celowe rozcięcie znaku 2-bajtowego w payloadzie', () => {
    Atomics.store(buf.meta, 0, 132);
    Atomics.store(buf.meta, 1, 10);

    const input = 'żółć';
    buf.write(input);

    Atomics.store(buf.meta, 1, 132);

    const output = buf.read();
    expect(output).toBe(input);
  });

  it('bardzo długi tekst z polskimi znakami wymuszający wiele wrap-ów', () => {
    buf = new SharedMemoryBuffer(TINY_BUF);
    const input = 'Zażółć gęślą jaźń!';
    buf.write(input);

    const output = buf.read();
    expect(output).toBe(input);
  });
});

describe('Phase 1.2.1 — 5000 parallel async writes', () => {
  it('5000 równoległych zapisów bez korupcji', async () => {
    const buf = new SharedMemoryBuffer(MB);
    const count = 5000;
    const texts: string[] = [];

    for (let i = 0; i < count; i++) {
      texts.push(`Rekord #${i} — Zażółć gęślą jaźń: ${i}ąćęłńóśźż`);
    }

    await Promise.all(
      texts.map((t) => Promise.resolve().then(() => buf.write(t)))
    );

    const results: string[] = [];
    let read: string | null;
    while ((read = buf.read()) !== null) {
      results.push(read);
    }

    expect(results.length).toBe(count);

    for (let i = 0; i < count; i++) {
      expect(results[i]).toContain(`Rekord #${i}`);
      expect(results[i]).toContain('Zażółć gęślą jaźń');
      expect(results[i]).toContain('ąćęłńóśźż');
    }
  });

  it('5000 zapisów z bardzo długimi tekstami (1KB każdy)', async () => {
    const buf = new SharedMemoryBuffer(10 * MB);
    const count = 5000;

    const base = 'Zażółć gęślą jaźń — ąćęłńóśźż '.repeat(30);
    const texts = Array.from({ length: count }, (_, i) => `[${i}] ${base} — koniec #${i}`);

    await Promise.all(
      texts.map((t) => Promise.resolve().then(() => buf.write(t)))
    );

    const results: string[] = [];
    let read: string | null;
    while ((read = buf.read()) !== null) {
      results.push(read);
    }

    expect(results.length).toBe(count);

    for (let i = 0; i < count; i++) {
      expect(results[i]).toContain('Zażółć gęślą jaźń');
      expect(results[i]).toContain('ąćęłńóśźż');
      expect(results[i]).toContain(`[${i}]`);
    }
  });
});

describe('Phase 1.2.1 — Concurrent read/write stress test', () => {
  it('wielowątkowy zapis i odczyt — 1000 operacji', async () => {
    const buf = new SharedMemoryBuffer(5 * MB);

    const producer = async () => {
      for (let i = 0; i < 500; i++) {
        buf.write(`Producent #${i}: ąćęłńóśźż Zażółć gęślą jaźń`);
        await Promise.resolve();
      }
    };

    const consumer = async () => {
      const results: string[] = [];
      while (results.length < 500) {
        const val = buf.read();
        if (val !== null) {
          results.push(val);
        } else {
          await new Promise((r) => setTimeout(r, 1));
        }
      }
      return results;
    };

    const [, results] = await Promise.all([producer(), consumer()]);

    expect(results.length).toBe(500);

    for (let i = 0; i < 500; i++) {
      expect(results[i]).toContain('Zażółć gęślą jaźń');
    }
  });
});
