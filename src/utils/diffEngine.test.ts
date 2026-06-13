// @vitest-environment jsdom
// ============================================================================
// NEXUS — DiffEngine Tests (#5)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { diffLines, diffToSideBySide } from './diffEngine';

describe('diffEngine', () => {
  // ------------------------------------------------------------------
  // Test 1: Identyczny tekst
  // ------------------------------------------------------------------
  it('zwraca same "equal" dla identycznego tekstu', () => {
    const result = diffLines('linia1\nlinia2\nlinia3', 'linia1\nlinia2\nlinia3');
    expect(result.lines.every(l => l.op === 'equal')).toBe(true);
    expect(result.lines).toHaveLength(3);
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
  });

  // ------------------------------------------------------------------
  // Test 2: Pusty vs pełny
  // ------------------------------------------------------------------
  it('zwraca same "add" gdy stary jest pusty', () => {
    const result = diffLines('', 'nowa linia');
    expect(result.lines.every(l => l.op === 'add')).toBe(true);
    expect(result.additions).toBe(1);
  });

  // ------------------------------------------------------------------
  // Test 3: Pełny vs pusty
  // ------------------------------------------------------------------
  it('zwraca same "delete" gdy nowy jest pusty', () => {
    const result = diffLines('stara linia', '');
    expect(result.lines.every(l => l.op === 'delete')).toBe(true);
    expect(result.deletions).toBe(1);
  });

  // ------------------------------------------------------------------
  // Test 4: Dodanie linii
  // ------------------------------------------------------------------
  it('wykrywa dodanie linii w środku', () => {
    const oldText = 'a\nb\nd';
    const newText = 'a\nb\nc\nd';
    const result = diffLines(oldText, newText);

    const adds = result.lines.filter(l => l.op === 'add');
    expect(adds).toHaveLength(1);
    expect(adds[0].text).toBe('c');
  });

  // ------------------------------------------------------------------
  // Test 5: Usunięcie linii
  // ------------------------------------------------------------------
  it('wykrywa usunięcie linii', () => {
    const oldText = 'a\nb\nc\nd';
    const newText = 'a\nb\nd';
    const result = diffLines(oldText, newText);

    const dels = result.lines.filter(l => l.op === 'delete');
    expect(dels).toHaveLength(1);
    expect(dels[0].text).toBe('c');
  });

  // ------------------------------------------------------------------
  // Test 6: Modyfikacja linii
  // ------------------------------------------------------------------
  it('wykrywa modyfikację (usunięcie + dodanie)', () => {
    const oldText = 'a\nb\nc';
    const newText = 'a\nX\nc';
    const result = diffLines(oldText, newText);

    const dels = result.lines.filter(l => l.op === 'delete');
    const adds = result.lines.filter(l => l.op === 'add');
    expect(dels.length).toBe(1);
    expect(adds.length).toBe(1);
    expect(dels[0].text).toBe('b');
    expect(adds[0].text).toBe('X');
  });

  // ------------------------------------------------------------------
  // Test 7: diffToSideBySide — pary
  // ------------------------------------------------------------------
  it('side-by-side ma tyle samo wierszy co linii diff', () => {
    const result = diffLines('a\nb', 'a\nc');
    const sbs = diffToSideBySide(result);
    expect(sbs.leftLines.length).toBe(result.lines.length);
    expect(sbs.rightLines.length).toBe(result.lines.length);
  });

  // ------------------------------------------------------------------
  // Test 8: Liczniki
  // ------------------------------------------------------------------
  it('poprawnie liczy add/delete/unchanged', () => {
    const result = diffLines('jeden\ndwa\ntrzy', 'jeden\nnowy\ntrzy');
    expect(result.additions).toBe(1);
    expect(result.deletions).toBe(1);
    expect(result.lines.filter(l => l.op === 'equal').length).toBeGreaterThanOrEqual(2);
  });
});
