// ============================================================================
// NEXUS — Tag Engine Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { suggestTags, getAllTags, getTagsByCategory } from './tagEngine';

describe('suggestTags', () => {
  it('sugests programming tag for code-related content', () => {
    const result = suggestTags('Bug fix in React', 'The function was throwing an error in the async handler. Fixed with a try/catch block.');
    const tags = result.map(t => t.tag);
    expect(tags).toContain('programming');
    expect(tags).toContain('bug');
  });

  it('sugests ai-ml tag for AI-related content', () => {
    const result = suggestTags('AI Model', 'Using Gemini to generate embeddings and run inference on the LLM model.');
    const tags = result.map(t => t.tag);
    expect(tags).toContain('ai-ml');
  });

  it('returns empty array for empty content', () => {
    const result = suggestTags('', '');
    expect(result).toEqual([]);
  });

  it('returns at most MAX_TAG_SUGGESTIONS tags', () => {
    const longText = 'bug error crash fix hotfix problem code typescript python javascript react ai model prompt agent project deadline milestone task idea concept research analysis reference link url design ui personal health todo pending';
    const result = suggestTags('Test', longText);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('sorts by score descending', () => {
    // Make sure we trigger multiple tags
    const text = 'bug error crash problem code typescript api python ai model agent';
    const result = suggestTags('Test', text);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });
});

describe('getAllTags', () => {
  it('returns all tags with categories', () => {
    const tags = getAllTags();
    expect(tags.length).toBeGreaterThan(10);
    for (const t of tags) {
      expect(t.tag).toBeTruthy();
      expect(t.category).toBeTruthy();
    }
  });
});

describe('getTagsByCategory', () => {
  it('groups tags into categories', () => {
    const byCat = getTagsByCategory();
    const categories = Object.keys(byCat);
    expect(categories.length).toBeGreaterThan(5);
    for (const [cat, tags] of Object.entries(byCat)) {
      expect(tags.length).toBeGreaterThan(0);
      expect(cat).toBeTruthy();
    }
  });
});
