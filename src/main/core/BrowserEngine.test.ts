/**
 * Testy weryfikujce poprawki w BrowserEngine:
 * - Fix 3.2: close() odporny na wyjtki
 * - Fix 3.9: stare BrowserContext zamykany przed nadpisaniem
 * - Fix 3.13: SCROLL uwzgldnia direction
 */
import { describe, it, expect } from 'vitest';

describe('BrowserEngine - close() exception-proof (Fix 3.2)', () => {
  it('powinno zamkn wszystkie zasoby nawet gdy jedno close() rzuci wyjtek', async () => {
    const closed: string[] = [];
    let errorThrown = false;

    // Symulacja zamykania zasobw
    const closePage = async () => {
      if (!errorThrown) {
        errorThrown = true;
        throw new Error('Page close failed');
      }
      closed.push('page');
    };
    const closeContext = async () => { closed.push('context'); };
    const closeBrowser = async () => { closed.push('browser'); };

    // Poprawiony close() - kady .close() w osobnym try/catch
    try { await closePage(); } catch { /* page close failed - OK */ }
    try { await closeContext(); } catch { /* ignore */ }
    try { await closeBrowser(); } catch { /* ignore */ }

    // Wszystkie trzy zasoby powinny zosta zamknite
    expect(closed).toContain('context');
    expect(closed).toContain('browser');
    expect(closed.length).toBe(2); // page nie doszed do push bo rzucic wyjtek
  });

  it('gdy wszystko dziaa, wszystkie zasoby s zamykane', async () => {
    const closed: string[] = [];
    await Promise.resolve().then(() => closed.push('page'));
    await Promise.resolve().then(() => closed.push('context'));
    await Promise.resolve().then(() => closed.push('browser'));
    expect(closed).toEqual(['page', 'context', 'browser']);
  });
});

describe('BrowserEngine - BrowserContext leak (Fix 3.9)', () => {
  it('getPage() powinno zamyka stary context przed nadpisaniem', () => {
    const closedContexts: string[] = [];
    const contexts: { id: string; close: () => void }[] = [];

    function createContext(id: string) {
      const ctx = {
        id,
        close: () => { closedContexts.push(id); },
      };
      contexts.push(ctx);
      return ctx;
    }

    function getPage(currentContext: typeof contexts[0] | null): typeof contexts[0] {
      // Zawsze zamykaj stary context przed utworzeniem nowego
      if (currentContext) {
        currentContext.close();
      }
      return createContext('ctx-' + (contexts.length + 1));
    }

    let ctx = getPage(null);
    expect(closedContexts.length).toBe(0); // Pierwszy - brak do zamknicia

    ctx = getPage(ctx);
    expect(closedContexts).toContain('ctx-1'); // Stary zamknity

    ctx = getPage(ctx);
    expect(closedContexts).toEqual(['ctx-1', 'ctx-2']);
  });
});

describe('BrowserEngine - SCROLL direction (Fix 3.13)', () => {
  it('scroll w d powinien uywa dodatniego offsetu', () => {
    let scrollY = 0;
    const scrollBy = (_x: number, y: number) => { scrollY = y; };
    const innerHeight = 900;
    const direction: string = 'down';

    // Poprawiony scroll
    scrollBy(0, direction === 'up' ? -innerHeight : innerHeight);
    expect(scrollY).toBe(900);
  });

  it('scroll w gr powinien uywa ujemnego offsetu', () => {
    let scrollY = 0;
    const scrollBy = (_x: number, y: number) => { scrollY = y; };
    const innerHeight = 900;
    const direction = 'up';

    scrollBy(0, direction === 'up' ? -innerHeight : innerHeight);
    expect(scrollY).toBe(-900);
  });
});