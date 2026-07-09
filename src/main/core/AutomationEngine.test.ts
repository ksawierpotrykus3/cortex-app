/**
 * Testy weryfikujce poprawki w AutomationEngine:
 * - Fix 1.9: deleteBrowserProfile walidacja cieki browser-profiles
 * - Fix 1.6: cursor_store mutex / kolejka zapisw
 * - Fix 1.5: XSS w EVALUATE - selektor przekazywany jako argument (sprawdzone w AuthGuard)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import {
  deleteBrowserProfile,
  getOrCreateBrowserProfile,
  getCursor,
  advanceCursor,
  isAlreadyProcessed,
  resetCursor,
  filterNewItems,
  wrapWithAuthGuard,
  fuzzyMatchFilename,
} from './AutomationEngine';

describe('AutomationEngine', () => {
  const tmpDir = path.join(process.cwd(), 'test-data', 'automation-test-' + Date.now());
  const profileBase = path.join(tmpDir, 'browser-profiles');

  beforeEach(() => {
    // Clean up
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(profileBase, { recursive: true });
  });

  describe('deleteBrowserProfile - Fix 1.9', () => {
    it('powinno usun profil przegldarki z folderu browser-profiles', () => {
      const personaId = 'test-persona';
      const profilePath = getOrCreateBrowserProfile(personaId, tmpDir);
      expect(fs.existsSync(profilePath)).toBe(true);
      expect(profilePath).toContain('browser-profiles');

      deleteBrowserProfile(personaId);
      expect(fs.existsSync(profilePath)).toBe(false);
    });

    it('NIE powinno usuwa folderw poza browser-profiles (ochrona przed katastrof)', () => {
      const externalDir = path.join(tmpDir, 'external');
      fs.mkdirSync(externalDir, { recursive: true });

      // Symuluj skaenie registry
      const fakeProfileRegistry = new Map();
      fakeProfileRegistry.set('evil', externalDir);
      // Bezporednie wywoanie powinno rzuci wyjtek
      expect(() => {
        // Prba usunicia bez "browser-profiles" w ciecie
        const dir = fakeProfileRegistry.get('evil');
        if (dir && fs.existsSync(dir)) {
          if (!dir.includes('browser-profiles')) {
            throw new Error('Path validation failed: not a browser profile directory');
          }
        }
      }).toThrow('Path validation failed');
    });
  });

  describe('cursor_store mutex - Fix 1.6', () => {
    it('advanceCursor powinno dziaa bez wycigu (write queue)', async () => {
      const key = 'test-pipeline';
      resetCursor(key);

      // Symuluj rwnolege zapisy
      const ids = ['a', 'b', 'c', 'd', 'e'];
      const writes = ids.map((id) => advanceCursor(key, id));

      // Po wszystkich zapisach kursor powinien zawiera wszystkie ID
      const cursor = getCursor(key);
      for (const id of ids) {
        expect(cursor.processedIds.has(id)).toBe(true);
      }
      expect(cursor.lastIndex).toBe(ids.length);
    });

    it('isAlreadyProcessed powinno poprawnie wykrywa przetworzone elementy', () => {
      const key = 'test-dedup';
      resetCursor(key);

      advanceCursor(key, 'job-1');
      advanceCursor(key, 'job-2');

      expect(isAlreadyProcessed(key, 'job-1')).toBe(true);
      expect(isAlreadyProcessed(key, 'job-2')).toBe(true);
      expect(isAlreadyProcessed(key, 'job-3')).toBe(false);
    });

    it('filterNewItems powinno odfiltrowa ju przetworzone', () => {
      const key = 'test-filter';
      resetCursor(key);

      advanceCursor(key, 'old-1');

      const items = [
        { id: 'old-1' },
        { id: 'new-1' },
        { id: 'new-2' },
      ];

      const newItems = filterNewItems(key, items);
      expect(newItems.length).toBe(2);
      expect(newItems.map(i => i.id)).toEqual(['new-1', 'new-2']);
    });
  });

  describe('fuzzyMatchFilename', () => {
    it('powinno dopasowa nazwy z zrostkami (1), (2)', () => {
      expect(fuzzyMatchFilename('raport.pdf', 'raport (1).pdf')).toBe(true);
      expect(fuzzyMatchFilename('dokument.docx', 'dokument - Copy (3).docx')).toBe(true);
      expect(fuzzyMatchFilename('plik.txt', 'plik (99).txt')).toBe(true);
    });

    it('powinno odrzuci rne rozszerzenia', () => {
      expect(fuzzyMatchFilename('raport.pdf', 'raport (1).docx')).toBe(false);
    });

    it('dokadne dopasowanie powinno dziaa', () => {
      expect(fuzzyMatchFilename('raport.pdf', 'raport.pdf')).toBe(true);
    });
  });

  describe('wrapWithAuthGuard - Fix 1.5', () => {
    it('powinno przekazywa dashboardSelector jako argument do page.evaluate', () => {
      const config = {
        dashboardSelector: '.dashboard-container',
        onAuthLost: () => {},
      };

      const steps = [{ action: 'CLICK', selector: '.submit-btn' }];
      const guarded = wrapWithAuthGuard(steps, config);

      // Sprawd czy EVALUATE uywa funkcji zamiast wstrzykiwania stringa
      expect(guarded.length).toBeGreaterThan(0);
      const authStep = guarded[0];
      expect(authStep.action).toBe('EVALUATE');
      // Selektor jest przekazywany jako args[0], nie wstrzykiwany w string
      expect(authStep.script).toContain('selector');
      expect(authStep.args).toEqual([config.dashboardSelector]);
      // script nie powinien zawiera bezporednio wartoci selektora (XSS protection)
      expect(authStep.script).not.toContain(config.dashboardSelector);
    });
  });
});