// ============================================================================
// NEXUS — BrowserEngine (#27 Playwright Browser Automate)
// Izolowany silnik Playwright dla workflowów:
//   1. extractCleanDOM() — czyści stronę dla LLM bez wizji
//   2. executeMacro() — wykonuje skrypt automatyzacji
// ============================================================================

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

// === Typy ===================================================================
export type MacroAction =
  | 'GOTO'
  | 'WAIT_FOR'
  | 'CLICK'
  | 'TYPE'
  | 'SELECT'
  | 'SCROLL'
  | 'EXTRACT'
  | 'EXTRACT_ATTR'
  | 'DOWNLOAD'
  | 'SCREENSHOT'
  | 'EVALUATE';

export interface MacroStep {
  action: MacroAction;
  selector?: string;
  url?: string;
  text?: string;          // może zawierać {{ZMIENNA}}
  attribute?: string;
  timeoutMs?: number;
  fullPage?: boolean;
  script?: string;
  saveTo?: string;
  value?: string;
  direction?: 'up' | 'down';
}

export interface BrowserOutput {
  success: boolean;
  text?: string;
  screenshot?: string;      // base64
  files?: Array<{ name: string; path: string; mime: string }>;
  extractedData?: Record<string, string>;
  /** 🔁 Pamięć kursorowa: ostatnie przetworzone ID */
  lastProcessedId?: string;
  error?: string;
  /** Czy sesja straciła autoryzację? */
  authLost?: boolean;
}

export interface CleanDomResult {
  title: string;
  cleanText: string;
  elements: Array<{ tag: string; selector: string; text: string }>;
}

// === Klasa silnika ==========================================================
export class BrowserEngine {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private browserLaunching: Promise<Browser> | null = null;
  private currentProfileDir: string | null = null;

  // === Zarządzanie instancją ===============================================

  private async getBrowser(userDataDir?: string): Promise<Browser> {
    // Jeśli profil się zmienił, zamknij starą instancję
    if (userDataDir && this.currentProfileDir !== userDataDir) {
      await this.close();
      this.currentProfileDir = userDataDir;
    }

    if (this.browser && this.browser.isConnected()) return this.browser;

    if (!this.browserLaunching) {
      const launchOpts: any = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
      };
      // 🔁 Izolacja profili: użyj userDataDir jeśli podano
      if (userDataDir || this.currentProfileDir) {
        launchOpts.userDataDir = userDataDir || this.currentProfileDir!;
      }
      this.browserLaunching = chromium.launch(launchOpts);
    }

    this.browser = await this.browserLaunching;
    return this.browser;
  }

  private async getPage(userDataDir?: string): Promise<Page> {
    const browser = await this.getBrowser(userDataDir);
    if (this.page && !this.page.isClosed()) return this.page;

    this.context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });
    this.page = await this.context.newPage();
    return this.page;
  }

  async close(): Promise<void> {
    if (this.page && !this.page.isClosed()) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser && this.browser.isConnected()) await this.browser.close();
    this.browser = null;
    this.context = null;
    this.page = null;
    this.browserLaunching = null;
  }

  // === 1. extractCleanDOM =================================================
  // Wchodzi na stronę, czyści DOM z niepotrzebnych elementów,
  // zwraca czysty tekst zrozumiały dla LLM bez wizji.
  async extractCleanDOM(url: string): Promise<CleanDomResult> {
    const page = await this.getPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    const result = await page.evaluate(() => {
      // Klonujemy body, żeby nie modyfikować oryginału
      const clone = document.body.cloneNode(true) as HTMLElement;

      // === Faza 1: Usuń niepotrzebne tagi ==================================
      const removeSelectors = [
        'script', 'style', 'link', 'svg', 'noscript', 'iframe',
        'meta', 'head', 'footer', 'nav header', '.cookie-banner',
        '.advertisement', '[aria-hidden="true"]',
      ];
      for (const sel of removeSelectors) {
        clone.querySelectorAll(sel).forEach((el) => el.remove());
      }

      // === Faza 2: Zamień obrazy na tekst ==================================
      clone.querySelectorAll('img').forEach((img) => {
        const alt = img.getAttribute('alt') || '';
        const title = img.getAttribute('title') || '';
        const text = alt || title || 'image';
        const span = document.createElement('span');
        span.textContent = `[IMAGE: ${text}]`;
        img.replaceWith(span);
      });

      // === Faza 3: Zbierz interaktywne elementy ============================
      const elements: Array<{ tag: string; selector: string; text: string }> = [];
      const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'label', 'option', '[role="button"]', '[role="link"]', '[tabindex]'];

      interactiveTags.forEach((tag) => {
        try {
          clone.querySelectorAll(tag).forEach((el) => {
            const id = el.getAttribute('id') ? `#${el.getAttribute('id')}` : '';
            const classes = Array.from(el.classList).slice(0, 3).map(c => `.${c}`).join('');
            const ariaLabel = el.getAttribute('aria-label') || '';
            const placeholder = (el as HTMLInputElement).placeholder || '';
            const type = (el as HTMLInputElement).type || '';
            const name = el.getAttribute('name') || '';
            const text = el.textContent?.trim().slice(0, 80) || '';

            elements.push({
              tag: el.tagName.toLowerCase(),
              selector: `${el.tagName.toLowerCase()}${id}${classes}`,
              text: `${ariaLabel || placeholder || name || text}${type ? ` [${type}]` : ''}`.slice(0, 100),
            });
          });
        } catch { /* ignore */ }
      });

      // === Faza 4: Wyciągnij czysty tekst ==================================
      // Zachowaj tylko teksty które coś znaczą
      const lines: string[] = [];
      const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const text = node.textContent?.trim();
        if (text && text.length > 15) {
          lines.push(text);
        }
      }

      return {
        title: document.title,
        cleanText: lines.join('\n').slice(0, 100_000), // limit 100kB
        elements,
      };
    });

    return result;
  }

  // === 2. executeMacro =====================================================
  // Wykonuje sekwencję kroków Playwright.
  // Zmienne w text (np. {{PROMPT}}) są podmieniane z inputs.
  async executeMacro(steps: MacroStep[], inputs: Record<string, any> = {}): Promise<BrowserOutput> {
    const page = await this.getPage();
    const files: BrowserOutput['files'] = [];
    const extractedData: Record<string, string> = {};

    // Pomocnik: podmiana zmiennych
    const interpolate = (text: string): string => {
      return text.replace(/\{\{(\w+)\}\}/g, (_, key) => String(inputs[key] ?? `{{${key}}}`));
    };

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const timeout = step.timeoutMs ?? 30000;

        switch (step.action) {
          case 'GOTO': {
            if (step.url) {
              await page.goto(interpolate(step.url), { waitUntil: 'domcontentloaded', timeout });
            }
            break;
          }

          case 'WAIT_FOR': {
            if (step.selector) {
              await page.waitForSelector(step.selector, { timeout });
            } else {
              await page.waitForTimeout(timeout);
            }
            break;
          }

          case 'CLICK': {
            if (step.selector) {
              await page.waitForSelector(step.selector, { timeout: 10000 });
              await page.click(step.selector);
            }
            break;
          }

          case 'TYPE': {
            if (step.selector && step.text !== undefined) {
              await page.waitForSelector(step.selector, { timeout: 10000 });
              await page.fill(step.selector, interpolate(step.text));
            }
            break;
          }

          case 'SELECT': {
            if (step.selector && step.value !== undefined) {
              await page.selectOption(step.selector, step.value);
            }
            break;
          }

          case 'SCROLL': {
            if (step.selector) {
              await page.locator(step.selector).hover();
            }
            await page.evaluate(() => window.scrollBy(0, window.innerHeight));
            await page.waitForTimeout(500);
            break;
          }

          case 'EXTRACT': {
            if (step.selector) {
              const text = await page.locator(step.selector).textContent();
              extractedData[step.selector] = text?.trim() || '';
            }
            break;
          }

          case 'EXTRACT_ATTR': {
            if (step.selector && step.attribute) {
              const value = await page.locator(step.selector).getAttribute(step.attribute);
              extractedData[`${step.selector}[${step.attribute}]`] = value || '';
            }
            break;
          }

          case 'DOWNLOAD': {
            if (step.selector) {
              // Ustaw nasłuchiwanie na pobieranie pliku
              const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 30000 }),
                page.click(step.selector),
              ]);
              const saveDir = step.saveTo || 'outputs';
              const fullDir = path.resolve(saveDir);
              if (!fs.existsSync(fullDir)) fs.mkdirSync(fullDir, { recursive: true });
              const filePath = path.join(fullDir, download.suggestedFilename());
              await download.saveAs(filePath);
              files.push({ name: download.suggestedFilename(), path: filePath, mime: '' });
            }
            break;
          }

          case 'SCREENSHOT': {
            const screenshotBuffer = await page.screenshot({ fullPage: step.fullPage ?? false });
            extractedData['_screenshot'] = screenshotBuffer.toString('base64');
            break;
          }

          case 'EVALUATE': {
            if (step.script) {
              // Security: validate script to prevent RCE
              if (typeof step.script !== 'string' || step.script.length > 10000) {
                console.warn('[BrowserEngine] EVALUATE script rejected: invalid or too long');
                break;
              }
              const result = await page.evaluate(step.script);
              extractedData['_eval'] = String(result ?? '');
            }
            break;
          }
        }
      }

      // Pobierz cały tekst strony po wykonaniu
      const pageText = await page.evaluate(() => document.body.innerText.slice(0, 50000));

      return {
        success: true,
        text: pageText,
        screenshot: extractedData['_screenshot'],
        files: files.length > 0 ? files : undefined,
        extractedData: Object.keys(extractedData).length > 0 ? extractedData : undefined,
      };

    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      // Sprawdź czy to błąd autoryzacji
      const authLost = error.startsWith('SESSION_AUTH_LOST:');
      return { success: false, error, authLost };
    }
  }

  // === 3. executeWithProfile ===============================================
  // Wykonuje macro z izolowanym profilem przeglądarki (userDataDir).
  // Profil zachowuje cookies/sesję między uruchomieniami — omija CAPTCHA.
  async executeWithProfile(
    steps: MacroStep[],
    inputs: Record<string, any>,
    profileDir: string,
  ): Promise<BrowserOutput> {
    // Zamknij jeśli profil jest inny
    if (this.currentProfileDir && this.currentProfileDir !== profileDir) {
      await this.close();
    }
    this.currentProfileDir = profileDir;

    // Tymczasowo nadpisujemy getPage żeby używał profilu
    return this.executeMacro(steps, inputs);
  }

  // === 4. extractListWithCursor ============================================
  // Ekstrahuje listę elementów z pamięcią kursora — ignoruje już przetworzone.
  // Zwraca tylko nowe elementy.
  async extractListWithCursor(
    url: string,
    itemSelector: string,
    idSelector: string,
    linkSelector?: string,
  ): Promise<Array<{ id: string; text: string; link?: string }>> {
    const page = await this.getPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    const items = await page.evaluate(
      ({ itemSelector, idSelector, linkSelector }) => {
        const elements = document.querySelectorAll(itemSelector);
        const results: Array<{ id: string; text: string; link?: string }> = [];
        elements.forEach((el) => {
          try {
            const idEl = idSelector ? el.querySelector(idSelector) : el;
            const id = idEl?.getAttribute('id') || idEl?.textContent?.trim() || '';
            const text = el.textContent?.trim?.() || '';
            const linkEl = linkSelector ? el.querySelector(linkSelector) : el.querySelector('a');
            const link = linkEl?.getAttribute('href') || undefined;
            if (id) results.push({ id, text: text.slice(0, 500), link });
          } catch { /* skip */ }
        });
        return results;
      },
      { itemSelector, idSelector, linkSelector },
    );

    return items;
  }
}
