// ============================================================================
// NEXUS — Tag Engine
// Automatyczne proponowanie tagów na podstawie treści notatki
// ============================================================================

/**
 * Wbudowane kategorie tagów — słowa kluczowe mapowane na tagi.
 * Działa jak prosty klasyfikator: im więcej słów kluczowych pasuje, tym wyższy score.
 */
const TAG_RULES: { tag: string; keywords: string[]; category: string }[] = [
  { tag: 'programming', category: 'Technologie', keywords: ['kod', 'code', 'funkcja', 'api', 'bug', 'debug', 'typescript', 'python', 'javascript', 'css', 'html', 'react', 'node', 'backend', 'frontend', 'server', 'database', 'sql', 'algorithm', 'function', 'class', 'import', 'export', 'async', 'promise', 'callback', 'variable', 'loop', 'array', 'object'] },
  { tag: 'ai-ml', category: 'Technologie', keywords: ['ai', 'sztuczna inteligencja', 'machine learning', 'model', 'llm', 'gemini', 'gpt', 'openai', 'neural', 'training', 'dataset', 'prompt', 'agent', 'embedding', 'token', 'inference', 'deep learning', 'sieć neuronowa'] },
  { tag: 'project', category: 'Zarządzanie', keywords: ['projekt', 'project', 'deadline', 'milestone', 'sprint', 'task', 'zadanie', 'issue', 'roadmap', 'status', 'progress', 'goal', 'cel', 'plan', 'scope'] },
  { tag: 'idea', category: 'Myśli', keywords: ['pomysł', 'idea', 'koncept', 'concept', 'think', 'może', 'maybe', 'what if', 'a gdyby', 'vision', 'wizja', 'inovacja'] },
  { tag: 'note', category: 'Notatki', keywords: ['notatka', 'note', 'summary', 'streszczenie', 'podsumowanie', 'tl;dr', 'ważne', 'important', 'uwaga', 'reminder', 'przypomnienie'] },
  { tag: 'research', category: 'Badania', keywords: ['research', 'badania', 'analiza', 'analysis', 'study', 'źródło', 'source', 'reference', 'citation', 'bibliografia', 'paper', 'artykuł', 'article', 'findings', 'wyniki'] },
  { tag: 'writing', category: 'Pisanie', keywords: ['pisać', 'write', 'draft', 'manuskrypt', 'rozdział', 'chapter', 'paragraph', 'akapit', 'tekst', 'text', 'edit', 'rewrite', 'przepisać', 'wersja', 'version', 'content'] },
  { tag: 'bug', category: 'Jakość', keywords: ['błąd', 'error', 'bug', 'crash', 'exception', 'fail', 'issue', 'problem', 'warning', 'alert', 'fix', 'naprawa', 'hotfix'] },
  { tag: 'question', category: 'Pytania', keywords: ['pytanie', 'question', 'jak?', 'how?', 'dlaczego?', 'why?', 'co to?', 'what is?', 'help', 'pomoc', 'nie wiem', 'unknown', 'wątpliwość'] },
  { tag: 'tutorial', category: 'Edukacja', keywords: ['tutorial', 'guide', 'poradnik', 'jak', 'how to', 'krok po kroku', 'step by step', 'przykład', 'example', 'demo', 'learn', 'nauka'] },
  { tag: 'meeting', category: 'Spotkania', keywords: ['meeting', 'spotkanie', 'agenda', 'minutes', 'protokół', 'call', 'rozmowa', 'discussion', 'dyskusja', 'decided', 'ustalono', 'action item'] },
  { tag: 'design', category: 'Design', keywords: ['design', 'ui', 'ux', 'layout', 'wireframe', 'mockup', 'prototype', 'prototyp', 'szkic', 'sketch', 'style', 'kolor', 'color', 'typography', 'font'] },
  { tag: 'reference', category: 'Referencje', keywords: ['link', 'url', 'https://', 'http://', 'www.', 'reference', 'dokumentacja', 'docs', 'manual', 'wiki', 'stackoverflow', 'github'] },
  { tag: 'personal', category: 'Osobiste', keywords: ['osobiste', 'personal', 'dziennik', 'journal', 'feelings', 'emocje', 'zdrowie', 'health', 'życie', 'life', 'rodzina', 'family', 'przyjaciele', 'friends'] },
  { tag: 'todo', category: 'Zadania', keywords: ['todo', 'do zrobienia', 'pending', 'zaległe', 'następne', 'next', 'kolejka', 'queue', 'backlog', 'checkbox', 'lista'] },
];

const MIN_SCORE = 1;
const MAX_TAG_SUGGESTIONS = 5;

export interface TagSuggestion {
  tag: string;
  category: string;
  score: number;
}

/**
 * Analizuje treść i tytuł, zwraca posortowane sugerowane tagi.
 */
export function suggestTags(title: string, content: string): TagSuggestion[] {
  const text = `${title} ${content}`.toLowerCase();
  const scores = new Map<string, TagSuggestion>();

  for (const rule of TAG_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        score++;
      }
    }
    if (score >= MIN_SCORE) {
      scores.set(rule.tag, { tag: rule.tag, category: rule.category, score });
    }
  }

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_TAG_SUGGESTIONS);
}

/**
 * Zwraca wszystkie dostępne tagi z kategoriami.
 */
export function getAllTags(): { tag: string; category: string }[] {
  return TAG_RULES.map(({ tag, category }) => ({ tag, category }));
}

/**
 * Grupuje tagi po kategoriach.
 */
export function getTagsByCategory(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const { tag, category } of TAG_RULES) {
    if (!map[category]) map[category] = [];
    map[category].push(tag);
  }
  return map;
}
