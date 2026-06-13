// ============================================================================
// NEXUS — DiffEngine (#5)
// Silnik porównywania tekstu (Myers diff) + typy DiffViewer
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

/** Typ operacji w diff */
export type DiffOperation = 'add' | 'delete' | 'equal';

/** Pojedyncza linia diffa */
export interface DiffLine {
  op: DiffOperation;
  text: string;
  oldLineNum?: number;
  newLineNum?: number;
}

/** Wynik diffa */
export interface DiffResult {
  lines: DiffLine[];
  additions: number;
  deletions: number;
  unchanged: number;
}

/** Tryb wyświetlania */
export type DiffViewMode = 'side_by_side' | 'inline';

/** Snapshot wersji encji (notatki, taska, manuskryptu) */
export interface EntitySnapshot {
  id: string;
  entityId: string;
  entityType: 'node' | 'task' | 'manuscript' | 'wiki';
  content: string;
  title: string;
  timestamp: string;
  version: number;
  /** Referencja do change entry jeśli pochodzi z ChangeLog */
  changeEntryId?: string;
}

// ============================================================================
// DIFF ENGINE — implementacja Myers'a (linia po linii)
// ============================================================================

/**
 * Porównuje dwie tablice stringów linia po linii.
 * Zwraca tablicę DiffLine[] z operacjami add/delete/equal.
 */
export function diffLines(oldText: string, newText: string): DiffResult {
  // Trivial cases
  if (oldText === newText) {
    const lines = oldText === '' ? [] : oldText.split('\n');
    return {
      lines: lines.map((line, i) => ({
        op: 'equal' as DiffOperation,
        text: line,
        oldLineNum: i + 1,
        newLineNum: i + 1,
      })),
      additions: 0,
      deletions: 0,
      unchanged: lines.length,
    };
  }

  const oldLines = oldText === '' ? [] : oldText.split('\n');
  const newLines = newText === '' ? [] : newText.split('\n');

  // Gdy jedna strona jest pusta — szybka ścieżka
  if (oldLines.length === 0) {
    return {
      lines: newLines.map((line, i) => ({
        op: 'add' as DiffOperation,
        text: line,
        newLineNum: i + 1,
      })),
      additions: newLines.length,
      deletions: 0,
      unchanged: 0,
    };
  }
  if (newLines.length === 0) {
    return {
      lines: oldLines.map((line, i) => ({
        op: 'delete' as DiffOperation,
        text: line,
        oldLineNum: i + 1,
      })),
      additions: 0,
      deletions: oldLines.length,
      unchanged: 0,
    };
  }

  // Myers diff na liniach
  const ops = myersDiff(oldLines, newLines);

  // Konwersja na DiffLine z numerami linii
  const result: DiffLine[] = [];
  let oldIdx = 0;
  let newIdx = 0;

  for (const op of ops) {
    switch (op.type) {
      case 'equal':
        result.push({
          op: 'equal',
          text: op.text,
          oldLineNum: oldIdx + 1,
          newLineNum: newIdx + 1,
        });
        oldIdx++;
        newIdx++;
        break;
      case 'delete':
        result.push({
          op: 'delete',
          text: op.text,
          oldLineNum: oldIdx + 1,
        });
        oldIdx++;
        break;
      case 'add':
        result.push({
          op: 'add',
          text: op.text,
          newLineNum: newIdx + 1,
        });
        newIdx++;
        break;
    }
  }

  // Liczniki
  return {
    lines: result,
    additions: result.filter(l => l.op === 'add').length,
    deletions: result.filter(l => l.op === 'delete').length,
    unchanged: result.filter(l => l.op === 'equal').length,
  };
}

/**
 * Generuje HTML z kolorowaniem diffa (inline).
 */
export function diffToHtml(diff: DiffResult): string {
  return diff.lines
    .map(line => {
      const escaped = escapeHtml(line.text);
      switch (line.op) {
        case 'add':
          return `<div class="diff-add">+ ${escaped}</div>`;
        case 'delete':
          return `<div class="diff-del">- ${escaped}</div>`;
        case 'equal':
          return `<div class="diff-eq">  ${escaped}</div>`;
      }
    })
    .join('\n');
}

/**
 * Generuje dane dla widoku side-by-side.
 * Zwraca pary (lewa: linia stara, prawa: linia nowa).
 */
export function diffToSideBySide(diff: DiffResult): {
  leftLines: (DiffLine | null)[];
  rightLines: (DiffLine | null)[];
} {
  const leftLines: (DiffLine | null)[] = [];
  const rightLines: (DiffLine | null)[] = [];

  for (const line of diff.lines) {
    switch (line.op) {
      case 'equal':
        leftLines.push(line);
        rightLines.push(line);
        break;
      case 'delete':
        leftLines.push(line);
        rightLines.push(null);
        break;
      case 'add':
        leftLines.push(null);
        rightLines.push(line);
        break;
    }
  }

  return { leftLines, rightLines };
}

// ============================================================================
// MYERS DIFF ALGORITHM — O(ND)
// ============================================================================

interface DiffOp {
  type: 'equal' | 'delete' | 'add';
  text: string;
}

interface MyersPoint {
  x: number;
  y: number;
}

function myersDiff(oldArr: string[], newArr: string[]): DiffOp[] {
  const maxD = oldArr.length + newArr.length;
  const trace: Map<number, number>[] = [];

  // Phase 1: Build trace (shortest edit script)
  for (let d = 0; d <= maxD; d++) {
    const row = new Map<number, number>();
    trace.push(row);

    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && (trace[d - 1]?.get(k - 1) ?? -Infinity) < (trace[d - 1]?.get(k + 1) ?? -Infinity))) {
        x = trace[d - 1]?.get(k + 1) ?? 0;
      } else {
        x = (trace[d - 1]?.get(k - 1) ?? 0) + 1;
      }
      let y = x - k;
      while (x < oldArr.length && y < newArr.length && oldArr[x] === newArr[y]) {
        x++;
        y++;
      }
      row.set(k, x);
      if (x >= oldArr.length && y >= newArr.length) {
        // Phase 2: Backtrack
        return backtrack(oldArr, newArr, trace, d, k);
      }
    }
  }

  // Fallback (should never reach here)
  return [];
}

function backtrack(
  oldArr: string[],
  newArr: string[],
  trace: Map<number, number>[],
  dEnd: number,
  kEnd: number
): DiffOp[] {
  const ops: DiffOp[] = [];
  let d = dEnd;
  let k = kEnd;
  let x = trace[d]?.get(k) ?? 0;
  let y = x - k;

  // Stack of ops in reverse
  const stack: DiffOp[] = [];

  while (d > 0) {
    const prevRow = trace[d - 1];
    if (!prevRow) break;

    // Check if we moved diagonally
    const prevK1 = k + 1;
    const prevK_1 = k - 1;
    const prevX1 = prevRow.get(prevK1) ?? -1;
    const prevX_1 = prevRow.get(prevK_1) ?? -1;

    let cameFromK: number;
    if (k === -d || (k !== d && prevX_1 < prevX1)) {
      cameFromK = k + 1;
    } else {
      cameFromK = k - 1;
    }

    const prevX = prevRow.get(cameFromK) ?? 0;
    const prevY = prevX - cameFromK;
    const diagSteps = x - prevX;

    // Add diagonal equal steps (in reverse)
    for (let i = diagSteps - 1; i >= 0; i--) {
      stack.push({ type: 'equal', text: oldArr[prevX + i] });
    }

    if (cameFromK === k - 1) {
      // Vertical move → add in new (insertion)
      stack.push({ type: 'delete', text: oldArr[prevX] });
    } else {
      // Horizontal move → delete from old (deletion)
      stack.push({ type: 'add', text: newArr[prevY] });
    }

    d--;
    k = cameFromK;
    x = prevX;
    y = x - k;
  }

  // Add initial equal lines
  for (let i = 0; i < x; i++) {
    stack.push({ type: 'equal', text: oldArr[i] });
  }

  // Reverse stack to get correct order
  return stack.reverse();
}

// ============================================================================
// HELPERS
// ============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
