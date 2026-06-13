// @vitest-environment jsdom
// ================================================================
// NEXUS — WikiPanel: Tests
// ================================================================

import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import '@testing-library/jest-dom/vitest';
import { WikiPanel } from './WikiPanel';
import { WikiArticle } from '../types';

// ============================================================
// Helpers
// ============================================================
function createArticle(overrides: Partial<WikiArticle> = {}): WikiArticle {
  const now = new Date().toISOString();
  return {
    id: `id-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Default title',
    content: 'Default content',
    tags: [],
    category: 'General',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================
describe('WikiPanel', () => {
  afterEach(() => {
    cleanup();
  });

  // ------------------------------------------------------------------
  // Test 1: Sortowanie malejąco po updatedAt
  // ------------------------------------------------------------------
  it('wyświetla artykuły posortowane po updatedAt malejąco', () => {
    const articles = [
      createArticle({ id: 'a1', title: 'Artykuł A', updatedAt: '2024-01-01T00:00:00Z' }),
      createArticle({ id: 'a2', title: 'Artykuł B', updatedAt: '2024-06-01T00:00:00Z' }),
      createArticle({ id: 'a3', title: 'Artykuł C', updatedAt: '2024-03-01T00:00:00Z' }),
    ];

    render(<WikiPanel articles={articles} onSave={vi.fn()} onDelete={vi.fn()} />);

    const titles = screen.getAllByText(/Artykuł [ABC]/);
    expect(titles).toHaveLength(3);
    // Najnowszy first
    expect(titles[0].textContent).toBe('Artykuł B');
    expect(titles[1].textContent).toBe('Artykuł C');
    expect(titles[2].textContent).toBe('Artykuł A');
  });

  // ------------------------------------------------------------------
  // Test 2: Filtrowanie po kategorii
  // ------------------------------------------------------------------
  it('filtruje artykuły po kategorii przez kliknięcie kategorii na liście', () => {
    const articles = [
      createArticle({ id: 'a1', title: 'Tech artykuł', category: 'Tech' }),
      createArticle({ id: 'a2', title: 'Design artykuł', category: 'Design' }),
      createArticle({ id: 'a3', title: 'Kolejny Tech', category: 'Tech' }),
    ];

    render(<WikiPanel articles={articles} onSave={vi.fn()} onDelete={vi.fn()} />);

    // Kliknij kategorię "Tech" (pokazuje licznik: Tech (2))
    fireEvent.click(screen.getByText('Tech (2)'));

    expect(screen.getByText('Tech artykuł')).toBeInTheDocument();
    expect(screen.getByText('Kolejny Tech')).toBeInTheDocument();
    expect(screen.queryByText('Design artykuł')).not.toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // Test 3: Szukanie po tytule
  // ------------------------------------------------------------------
  it('szuka artykułów po tytule przez input search', () => {
    const articles = [
      createArticle({ id: 'a1', title: 'React components', content: '...', tags: [] }),
      createArticle({ id: 'a2', title: 'CSS styles', content: '...', tags: [] }),
    ];

    render(<WikiPanel articles={articles} onSave={vi.fn()} onDelete={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText('Szukaj...');
    fireEvent.change(searchInput, { target: { value: 'React' } });

    expect(screen.getByText('React components')).toBeInTheDocument();
    expect(screen.queryByText('CSS styles')).not.toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // Test 4: Tworzenie nowego artykułu
  // ------------------------------------------------------------------
  it('tworzy nowy artykuł i wywołuje onSave z domyślnymi polami', () => {
    const onSave = vi.fn();
    render(<WikiPanel articles={[]} onSave={onSave} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByText('Nowy artykuł'));

    expect(onSave).toHaveBeenCalledTimes(1);
    const article = onSave.mock.calls[0][0] as WikiArticle;
    expect(article.title).toBe('Nowy artykuł');
    expect(article.content).toBe('');
    expect(article.tags).toEqual([]);
    expect(article.category).toBe('General');
    expect(article.id).toBeDefined();
    expect(article.createdAt).toBeDefined();
    expect(article.updatedAt).toBeDefined();
  });

  // ------------------------------------------------------------------
  // Test 5: Usuwanie artykułu
  // ------------------------------------------------------------------
  it('usuwa artykuł i wywołuje onDelete z id', () => {
    const articles = [createArticle({ id: 'del-1', title: 'Do usunięcia' })];
    const onDelete = vi.fn();

    const { container } = render(<WikiPanel articles={articles} onSave={vi.fn()} onDelete={onDelete} />);

    // Kliknij artykuł na liście → otwiera edytor
    fireEvent.click(screen.getByText('Do usunięcia'));

    // Znajdź przycisk kosza (Trash2) w edytorze i kliknij go
    const trashIcon = container.querySelector('.lucide-trash-2');
    expect(trashIcon).toBeTruthy();
    const deleteButton = trashIcon!.closest('button');
    expect(deleteButton).toBeTruthy();
    fireEvent.click(deleteButton!);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith('del-1');
  });
});
