// @vitest-environment jsdom
// ================================================================
// NEXUS #26 — FeedbackPanel: Tests
// ================================================================

import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import '@testing-library/jest-dom/vitest';
import { FeedbackPanel } from './FeedbackPanel';
import { FeedbackEntry } from '../types';

afterEach(() => {
  cleanup();
});

const sampleFeedback: FeedbackEntry[] = [
  {
    id: 'fb_1',
    title: 'Pomysl na funkcje',
    context: 'Przydalaby sie integracja z API',
    feedbackType: 'idea',
    timestamp: '2026-06-01T10:00:00Z',
    entityType: 'general',
    status: 'new',
    contextSnapshot: {
      viewMode: 'nexus',
      selectedAgentId: null,
      selectedNodeId: 'node_1',
      selectedTaskId: null,
      selectedManuscriptId: null,
      projectId: null,
      lastAction: 'Widok: nexus',
    },
  },
  {
    id: 'fb_2',
    title: 'Blad logowania',
    context: 'Nie dziala przycisk logowania w trybie ciemnym',
    feedbackType: 'problem',
    timestamp: '2026-06-02T14:00:00Z',
    entityType: 'general',
    status: 'read',
    contextSnapshot: {
      viewMode: 'sandbox',
      selectedAgentId: null,
      selectedNodeId: null,
      selectedTaskId: null,
      selectedManuscriptId: null,
      projectId: null,
      lastAction: 'Widok: sandbox',
    },
  },
  {
    id: 'fb_3',
    title: 'Kolejny pomysl',
    context: 'Mozna dodac eksport do PDF',
    feedbackType: 'idea',
    timestamp: '2026-06-03T09:00:00Z',
    entityType: 'general',
    status: 'in-progress',
  },
];

const defaultProps = {
  feedback: sampleFeedback,
  onDelete: vi.fn(),
  onStatusChange: vi.fn(),
};

// ============================================================
// Test 1: Renderuje pusta liste — komunikat
// ============================================================
describe('FeedbackPanel — pusta lista', () => {
  it('wyswietla "Brak feedbacku" gdy lista jest pusta', () => {
    render(<FeedbackPanel feedback={[]} onDelete={vi.fn()} onStatusChange={vi.fn()} />);

    expect(screen.getByText(/Brak feedbacku/i)).toBeInTheDocument();
  });

  it('NIE renderuje "Analizuj i posegreguj AI" ani "posegreguj"', () => {
    render(<FeedbackPanel feedback={[]} onDelete={vi.fn()} onStatusChange={vi.fn()} />);

    expect(screen.queryByText(/Analizuj i posegreguj AI/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/posegreguj/i)).not.toBeInTheDocument();
  });
});

// ============================================================
// Test 2: Pokazuje feedback entries z odpowiednimi polami
// ============================================================
describe('FeedbackPanel — lista feedbackow', () => {
  it('pokazuje wszystkie feedback entries', () => {
    render(<FeedbackPanel {...defaultProps} />);

    expect(screen.getByText('Pomysl na funkcje')).toBeInTheDocument();
    expect(screen.getByText('Blad logowania')).toBeInTheDocument();
    expect(screen.getByText('Kolejny pomysl')).toBeInTheDocument();
  });

  it('pokazuje tytul, opis i typ dla kazdego entry', () => {
    render(<FeedbackPanel {...defaultProps} />);

    // Tytuly
    expect(screen.getByText('Pomysl na funkcje')).toBeInTheDocument();
    expect(screen.getByText('Blad logowania')).toBeInTheDocument();

    // Opis (context)
    expect(screen.getByText('Przydalaby sie integracja z API')).toBeInTheDocument();
    expect(screen.getByText('Nie dziala przycisk logowania w trybie ciemnym')).toBeInTheDocument();

    // Status badges (wystepuja tez jako filtry, wiec getAllByText)
    const nowyBadges = screen.getAllByText('Nowy');
    expect(nowyBadges.length).toBeGreaterThanOrEqual(1);
    const przeczytanyBadges = screen.getAllByText('Przeczytany');
    expect(przeczytanyBadges.length).toBeGreaterThanOrEqual(1);
    const wtrakcieBadges = screen.getAllByText('W trakcie');
    expect(wtrakcieBadges.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// Test 3: Filtrowanie po typie
// ============================================================
describe('FeedbackPanel — filtrowanie po typie', () => {
  it('pokazuje Pomysly po kliknieciu Pomysly', () => {
    render(<FeedbackPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('Pomysly'));

    // Pomysly should be visible
    expect(screen.getByText('Pomysl na funkcje')).toBeInTheDocument();
    expect(screen.getByText('Kolejny pomysl')).toBeInTheDocument();
    // Problems should be hidden
    expect(screen.queryByText('Blad logowania')).not.toBeInTheDocument();
  });

  it('pokazuje Problemy po kliknieciu Problemy', () => {
    render(<FeedbackPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('Problemy'));

    expect(screen.getByText('Blad logowania')).toBeInTheDocument();
    expect(screen.queryByText('Pomysl na funkcje')).not.toBeInTheDocument();
    expect(screen.queryByText('Kolejny pomysl')).not.toBeInTheDocument();
  });

  it('pokazuje Wszystkie po kliknieciu Wszystkie', () => {
    render(<FeedbackPanel {...defaultProps} />);

    fireEvent.click(screen.getByText('Problemy'));
    expect(screen.queryByText('Pomysl na funkcje')).not.toBeInTheDocument();

    // "Wszystkie" appears twice (type filter + status filter) — use getAllByText and click first
    const wszystkieButtons = screen.getAllByText('Wszystkie');
    fireEvent.click(wszystkieButtons[0]);

    expect(screen.getByText('Pomysl na funkcje')).toBeInTheDocument();
    expect(screen.getByText('Blad logowania')).toBeInTheDocument();
    expect(screen.getByText('Kolejny pomysl')).toBeInTheDocument();
  });
});

// ============================================================
// Test 4: Filtrowanie po statusie
// ============================================================
describe('FeedbackPanel — filtrowanie po statusie', () => {
  it('pokazuje tylko Nowy po wybraniu filtru Nowy', () => {
    render(<FeedbackPanel {...defaultProps} />);

    // "Nowy" appears as both filter button and status badge — click the first one (filter)
    const nowyButtons = screen.getAllByText('Nowy');
    fireEvent.click(nowyButtons[0]);

    expect(screen.getByText('Pomysl na funkcje')).toBeInTheDocument();
    expect(screen.queryByText('Blad logowania')).not.toBeInTheDocument();
    expect(screen.queryByText('Kolejny pomysl')).not.toBeInTheDocument();
  });

  it('pokazuje W trakcie po wybraniu filtru W trakcie', () => {
    render(<FeedbackPanel {...defaultProps} />);

    // "W trakcie" appears as both filter button and status badge — click the first one (filter)
    const wtrakcieButtons = screen.getAllByText('W trakcie');
    fireEvent.click(wtrakcieButtons[0]);

    expect(screen.getByText('Kolejny pomysl')).toBeInTheDocument();
    expect(screen.queryByText('Pomysl na funkcje')).not.toBeInTheDocument();
    expect(screen.queryByText('Blad logowania')).not.toBeInTheDocument();
  });

  it('pokazuje Zrobione po wybraniu filtru Zrobione (pusta lista)', () => {
    render(<FeedbackPanel {...defaultProps} />);

    // "Zrobione" appears as both filter button and (potentially) status badge
    const zrobioneButtons = screen.getAllByText('Zrobione');
    fireEvent.click(zrobioneButtons[0]);

    // Should show empty state - "Brak wynikow dla wybranych filtrow"
    expect(screen.getByText(/Brak wynikow/i)).toBeInTheDocument();
  });
});

// ============================================================
// Test 5: Zmiana statusu dziala
// ============================================================
describe('FeedbackPanel — zmiana statusu', () => {
  it('klikniecie check (done) wywoluje onStatusChange z "done"', () => {
    const onStatusChange = vi.fn();
    render(<FeedbackPanel feedback={sampleFeedback} onDelete={vi.fn()} onStatusChange={onStatusChange} />);

    // feedback jest sortowany DESC po timestamp, wiec fb_3 (2026-06-03) jest pierwszy
    // fb_1 (2026-06-01, status new) ma przycisk "Oznacz jako zrobione"
    const doneButtons = document.querySelectorAll('button[title="Oznacz jako zrobione"]');
    expect(doneButtons.length).toBeGreaterThan(0);

    // fb_3 ma status in-progress — ma przycisk done
    fireEvent.click(doneButtons[0]);
    expect(onStatusChange).toHaveBeenCalledWith('fb_3', 'done');
  });

  it('klikniecie X (read) wywoluje onStatusChange z "read"', () => {
    const onStatusChange = vi.fn();
    render(<FeedbackPanel feedback={sampleFeedback} onDelete={vi.fn()} onStatusChange={onStatusChange} />);

    // fb_2 (Blad logowania, status read) nie ma przycisku "Oznacz jako przeczytane" bo juz przeczytany
    // fb_1 (Pomysl na funkcje, status new) ma przycisk "Oznacz jako przeczytane"
    const readButtons = document.querySelectorAll('button[title="Oznacz jako przeczytane"]');
    expect(readButtons.length).toBeGreaterThan(0);

    // fb_1 jest ostatni w kolejnosci DESC (najstarszy timestamp)
    const lastIndex = readButtons.length - 1;
    fireEvent.click(readButtons[lastIndex]);
    expect(onStatusChange).toHaveBeenCalledWith('fb_1', 'read');
  });
});

// ============================================================
// Test 6: Usuwanie feedbacku
// ============================================================
describe('FeedbackPanel — usuwanie', () => {
  it('klikniecie kosza wywoluje onDelete z id', () => {
    const onDelete = vi.fn();
    render(<FeedbackPanel feedback={sampleFeedback} onDelete={onDelete} onStatusChange={vi.fn()} />);

    const deleteButtons = document.querySelectorAll('button[title="Usun"]');
    expect(deleteButtons.length).toBe(3);

    // feedback jest sortowany DESC po timestamp, wiec [fb_3, fb_2, fb_1]
    // pierwszy przycisk usun to fb_3
    fireEvent.click(deleteButtons[0]);
    expect(onDelete).toHaveBeenCalledWith('fb_3');
  });
});
