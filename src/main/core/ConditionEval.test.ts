// ============================================================================
// NEXUS — ConditionEval Testy (#6 IF/THEN)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { evalCondition } from './ConditionEval';

function createRunState(results: Record<string, string>) {
  const nodeResults = new Map(Object.entries(results));
  return { nodeResults, currentNodeId: 'test-node' };
}

describe('ConditionEval', () => {
  const runState = createRunState({});

  describe('contains', () => {
    it('returns true when context contains the string', () => {
      expect(evalCondition(
        { expression: "{{prev.output}} contains 'error'", mode: 'skip-when-false' },
        'This is an error message',
        runState,
      )).toBe(false); // mode skip-when-false + result=true → should NOT skip → false

      expect(evalCondition(
        { expression: "{{prev.output}} contains 'error'", mode: 'skip-when-true' },
        'This is an error message',
        runState,
      )).toBe(true); // mode skip-when-true + result=true → should skip → true
    });

    it('is case insensitive', () => {
      expect(evalCondition(
        { expression: "{{prev.output}} contains 'ERROR'", mode: 'skip-when-false' },
        'This is an error message',
        runState,
      )).toBe(false);
    });

    it('returns false when context does NOT contain the string', () => {
      expect(evalCondition(
        { expression: "{{prev.output}} contains 'success'", mode: 'skip-when-false' },
        'This is an error message',
        runState,
      )).toBe(true); // result=false + skip-when-false → skip
    });
  });

  describe('exact match (===)', () => {
    it('matches exact string', () => {
      expect(evalCondition(
        { expression: "{{prev.output}} === 'hello world'", mode: 'skip-when-false' },
        'hello world',
        runState,
      )).toBe(false);
    });

    it('does NOT match different string', () => {
      expect(evalCondition(
        { expression: "{{prev.output}} === 'hello'", mode: 'skip-when-false' },
        'hello world',
        runState,
      )).toBe(true); // mismatch → skip
    });
  });

  describe('regex match', () => {
    it('matches regex pattern', () => {
      expect(evalCondition(
        { expression: '{{prev.output}} matches /error/i', mode: 'skip-when-false' },
        'This is an Error message',
        runState,
      )).toBe(false);
    });

    it('does NOT match non-matching regex', () => {
      expect(evalCondition(
        { expression: '{{prev.output}} matches /^error/ ', mode: 'skip-when-false' },
        'This is an error message',
        runState,
      )).toBe(true); // no match → skip
    });
  });

  describe('output.length', () => {
    it('checks length > N', () => {
      expect(evalCondition(
        { expression: 'output.length > 10', mode: 'skip-when-false' },
        'Hello World!!!', // 14 chars
        runState,
      )).toBe(false); // condition true → should NOT skip
    });

    it('checks length < N', () => {
      expect(evalCondition(
        { expression: 'output.length < 5', mode: 'skip-when-false' },
        'Hello World!!!', // 14 chars
        runState,
      )).toBe(true); // condition false → should skip
    });
  });

  describe('is empty / is not empty', () => {
    it('detects empty context', () => {
      expect(evalCondition(
        { expression: '{{prev.output}} is empty', mode: 'skip-when-true' },
        '',
        runState,
      )).toBe(true);
    });

    it('detects non-empty context', () => {
      expect(evalCondition(
        { expression: '{{prev.output}} is not empty', mode: 'skip-when-false' },
        'some content',
        runState,
      )).toBe(false);
    });
  });

  describe('constant expressions', () => {
    it('true → should NOT skip when skip-when-false', () => {
      expect(evalCondition(
        { expression: 'true', mode: 'skip-when-false' },
        '',
        runState,
      )).toBe(false);
    });

    it('false → should skip when skip-when-false', () => {
      expect(evalCondition(
        { expression: 'false', mode: 'skip-when-false' },
        '',
        runState,
      )).toBe(true);
    });
  });

  describe('unknown expression', () => {
    it('treats unknown expressions as null (safe — do not skip)', () => {
      expect(evalCondition(
        { expression: 'some weird expression', mode: 'skip-when-false' },
        '',
        runState,
      )).toBe(false); // unknown → null → null !== false → NOT skip
    });
  });
});
