// ============================================================================
// NEXUS — ConditionEval (#6 IF/THEN)
// Ewaluacja warunków IF/THEN dla pipeline'ów
// ============================================================================

interface Condition {
  expression: string;
  mode: 'skip-when-false' | 'skip-when-true' | 'always';
}

interface RunState {
  nodeResults: Map<string, string | any>;
  currentNodeId: string | null;
}

/**
 * Ewaluuje warunek.
 * Zwraca `true` jeśli node powinien być pominięty (skipped).
 */
export function evalCondition(
  condition: Condition,
  context: string,
  runState: RunState,
): boolean {
  const expr = condition.expression.trim();
  if (!expr) return false;

  const result = evaluateExpression(expr, context, runState);

  switch (condition.mode) {
    case 'skip-when-false':
      return result === false;
    case 'skip-when-true':
      return result === true;
    default:
      return false;
  }
}

/**
 * Prosty evaluator wyrażeń warunkowych.
 * Obsługuje:
 *   - "{{prev.output}} contains 'tekst'"
 *   - "{{prev.output}} === 'dokładny tekst'"
 *   - "output.length > 100"
 *   - "{{prev.output}} matches /regex/"
 *   - "true" / "false" (stałe)
 */
function evaluateExpression(
  expr: string,
  context: string,
  runState: RunState,
): boolean | null {
  const trimmed = expr.trim();

  // Stałe logiczne
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // {{prev.output}} contains '...'
  const containsMatch = trimmed.match(/^\{\{prev\.output\}\}\s*contains\s*['"](.+)['"]$/i);
  if (containsMatch) {
    return context.toLowerCase().includes(containsMatch[1].toLowerCase());
  }

  // {{prev.output}} === '...' or {{prev.output}} == '...'
  const eqMatch = trimmed.match(/^\{\{prev\.output\}\}\s*===\s*['"](.+)['"]$/);
  if (eqMatch) {
    return context.trim() === eqMatch[1];
  }

  const eq2Match = trimmed.match(/^\{\{prev\.output\}\}\s*==\s*['"](.+)['"]$/);
  if (eq2Match) {
    return context.trim() === eq2Match[1];
  }

  // {{prev.output}} matches /regex/
  const regexMatch = trimmed.match(/^\{\{prev\.output\}\}\s*matches\s*\/(.+)\/([im]*)$/);
  if (regexMatch) {
    try {
      const flags = regexMatch[2] || '';
      const re = new RegExp(regexMatch[1], flags);
      return re.test(context);
    } catch {
      return null;
    }
  }

  // output.length > N, output.length < N, output.length >= N, etc.
  const lengthMatch = trimmed.match(/^output\.length\s*([><=!]+)\s*(\d+)$/i);
  if (lengthMatch) {
    const op = lengthMatch[1];
    const val = parseInt(lengthMatch[2], 10);
    const len = context.length;
    switch (op) {
      case '>': return len > val;
      case '<': return len < val;
      case '>=': return len >= val;
      case '<=': return len <= val;
      case '===': case '==': return len === val;
      case '!==': case '!=': return len !== val;
    }
  }

  // {{prev.output}} is empty / not empty
  if (/^\{\{prev\.output\}\}\s*is\s+empty$/i.test(trimmed)) {
    return context.trim().length === 0;
  }
  if (/^\{\{prev\.output\}\}\s*is\s+not\s+empty$/i.test(trimmed)) {
    return context.trim().length > 0;
  }

  // Nieznane wyrażenie — loguj ostrzeżenie, nie pomijaj
  console.warn(`[ConditionEval] Unknown expression: "${trimmed}" — treating as false`);
  return false;
}
