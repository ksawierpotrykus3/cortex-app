// @vitest-environment jsdom
// ============================================================================
// NEXUS — DiffViewer Tests (#5)
// ============================================================================

import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import '@testing-library/jest-dom/vitest';
import { DiffViewer } from './DiffViewer';

describe('DiffViewer', () => {
  afterEach(() => {
    cleanup();
  });

  // ------------------------------------------------------------------
  // Test 1: Renderuje oba nagłówki
  // ------------------------------------------------------------------
  it('renderuje tytuły starej i nowej wersji', () => {
    render(
      <DiffViewer
        oldTitle="Wersja 1"
        newTitle="Wersja 2"
        oldText="linia a\nlinia b"
        newText="linia a\nlinia b"
      />
    );

    expect(screen.getByText('Wersja 1')).toBeInTheDocument();
    expect(screen.getByText('Wersja 2')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // Test 2: Pokazuje licznik zmian
  // ------------------------------------------------------------------
  it('pokazuje licznik zmian (dodane/usunięte)', () => {
    render(
      <DiffViewer
        oldTitle="Old"
        newTitle="New"
        oldText="linia a"
        newText="linia b"
      />
    );

    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText('-1')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // Test 3: Przełącznik widoku inline/side-by-side
  // ------------------------------------------------------------------
  it('ma przyciski przełączania widoku', () => {
    render(
      <DiffViewer
        oldTitle="Old"
        newTitle="New"
        oldText="a"
        newText="b"
      />
    );

    expect(screen.getByText('Inline')).toBeInTheDocument();
    expect(screen.getByText('Side-by-side')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // Test 4: Przycisk cofnij widoczny gdy są zmiany
  // ------------------------------------------------------------------
  it('pokazuje przycisk "Cofnij zmiany" gdy są różnice', () => {
    render(
      <DiffViewer
        oldTitle="Old"
        newTitle="New"
        oldText="a"
        newText="b"
        onRevert={vi.fn()}
      />
    );

    expect(screen.getByText('Cofnij zmiany')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // Test 5: Przycisk cofnij niewidoczny gdy brak zmian
  // ------------------------------------------------------------------
  it('nie pokazuje "Cofnij zmiany" gdy tekst identyczny', () => {
    render(
      <DiffViewer
        oldTitle="Old"
        newTitle="New"
        oldText="a"
        newText="a"
        onRevert={vi.fn()}
      />
    );

    expect(screen.queryByText('Cofnij zmiany')).not.toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // Test 6: Przycisk close wywołuje onClose
  // ------------------------------------------------------------------
  it('wywołuje onClose po kliknięciu strzałki wstecz', () => {
    const onClose = vi.fn();
    render(
      <DiffViewer
        oldTitle="Old"
        newTitle="New"
        oldText="a"
        newText="b"
        onClose={onClose}
      />
    );

    const backButton = document.querySelector('.lucide-arrow-left')?.closest('button');
    expect(backButton).toBeTruthy();
    fireEvent.click(backButton!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
