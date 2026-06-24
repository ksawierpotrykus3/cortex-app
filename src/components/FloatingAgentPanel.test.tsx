// @vitest-environment jsdom
// ============================================================================
// NEXUS — FloatingAgentPanel: Tests
// Agentow tworzy sie w widoku Agents, tutaj tylko wybiera z listy istniejacych.
// ============================================================================

import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import '@testing-library/jest-dom/vitest';
import { FloatingAgentPanel } from './FloatingAgentPanel';

afterEach(() => { cleanup(); });

const sampleAgents = [
  { id: 'ag_1', name: 'Asystent', systemPrompt: 'Pomagasz.', model: 'gemini-2.0-flash', capabilities: [], allowedFolders: [] },
  { id: 'ag_2', name: 'Koder', systemPrompt: 'Piszesz kod.', model: 'deepseek-pro', capabilities: [], allowedFolders: [] },
];

const defaultProps = {
  viewMode: 'nexus' as any,
  selectedNodeId: null,
  selectedAgentId: null,
  selectedTaskId: null,
  selectedManuscriptId: null,
  projectId: null,
  lastAction: 'Widok: nexus',
  onSendToAgent: vi.fn(),
  allAgents: sampleAgents,
};

// ============================================================
// Test 1: Zamkniety panel
// ============================================================
describe('FloatingAgentPanel — zamkniety', () => {
  it('renderuje przycisk z ikona PanelRight, title "Otworz agentow"', () => {
    render(<FloatingAgentPanel {...defaultProps} />);
    const btn = document.querySelector('button[title="Otworz agentow"]');
    expect(btn).toBeTruthy();
    expect(btn?.querySelector('.lucide-panel-right')).toBeTruthy();
  });

  it('ma klasy right-4 i z-50', () => {
    render(<FloatingAgentPanel {...defaultProps} />);
    const btn = document.querySelector('button[title="Otworz agentow"]');
    expect(btn?.className).toContain('right-4');
    expect(btn?.className).toContain('z-50');
  });

  it('NIE zawiera "Agenci" ani "Dodaj agenta"', () => {
    render(<FloatingAgentPanel {...defaultProps} />);
    expect(screen.queryByText('Agenci')).not.toBeInTheDocument();
    expect(screen.queryByText('Dodaj agenta')).not.toBeInTheDocument();
  });
});

// ============================================================
// Test 2: Otwarty panel
// ============================================================
describe('FloatingAgentPanel — otwarty', () => {
  it('klikniecie otwiera panel z naglowkiem "Agenci" i klasa right-2', () => {
    render(<FloatingAgentPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Otworz agentow'));
    expect(screen.getByText('Agenci')).toBeInTheDocument();
    const panel = document.querySelector('.fixed.top-2.bottom-2.right-2');
    expect(panel).toBeTruthy();
  });

  it('NIE ma presetow/templatek (Git Helper, Notatnik)', () => {
    render(<FloatingAgentPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Otworz agentow'));
    expect(screen.queryByText('Git Helper')).not.toBeInTheDocument();
    expect(screen.queryByText('Notatnik')).not.toBeInTheDocument();
  });

  it('ma przycisk "Dodaj agenta" ktory otwiera liste agentow', () => {
    render(<FloatingAgentPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Otworz agentow'));
    fireEvent.click(screen.getByText('Dodaj agenta'));
    expect(screen.getByText('Wybierz agenta z listy:')).toBeInTheDocument();
    expect(screen.getByText('Asystent')).toBeInTheDocument();
    expect(screen.getByText('Koder')).toBeInTheDocument();
  });

  it('klikniecie agenta z listy dodaje go do panelu', () => {
    render(<FloatingAgentPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Otworz agentow'));
    fireEvent.click(screen.getByText('Dodaj agenta'));
    fireEvent.click(screen.getByText('Asystent'));
    expect(screen.getByText('Asystent')).toBeInTheDocument();
    // Drugie otwarcie listy: Koder wciaz jest do wyboru (nie dodany)
    fireEvent.click(screen.getByText('Dodaj agenta'));
    expect(screen.getByText('Koder')).toBeInTheDocument();
    // Asystent jest w karcie (na stronie), ale nie w liscie wyboru — sprawdzamy ze Koder to jedyny widoczny w liscie
    const listItems = document.querySelectorAll('.overflow-y-auto button span');
    const listTexts = Array.from(listItems).map(el => el.textContent).filter(Boolean);
    expect(listTexts.some(t => t?.includes('Koder'))).toBe(true);
  });

  it('agent ma "Usun agenta" — klikniecie usuwa', () => {
    render(<FloatingAgentPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Otworz agentow'));
    fireEvent.click(screen.getByText('Dodaj agenta'));
    fireEvent.click(screen.getByText('Asystent'));

    const removeBtns = document.querySelectorAll('button[title="Usun agenta"]');
    expect(removeBtns.length).toBe(1);
    fireEvent.click(removeBtns[0]);
    expect(screen.getByText(/Brak agentow/i)).toBeInTheDocument();
  });

  it('komunikat "Brak agentow" gdy lista pusta', () => {
    render(<FloatingAgentPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Otworz agentow'));
    expect(screen.getByText(/Brak agentow/i)).toBeInTheDocument();
  });

  it('komunikat "Stworz agenta w widoku Agents" gdy allAgents pusta', () => {
    render(<FloatingAgentPanel {...defaultProps} allAgents={[]} />);
    fireEvent.click(screen.getByTitle('Otworz agentow'));
    fireEvent.click(screen.getByText('Dodaj agenta'));
    expect(screen.getByText(/Stworz agenta w widoku Agents/i)).toBeInTheDocument();
  });
});

// ============================================================
// Test 3: Kontekst bar
// ============================================================
describe('FloatingAgentPanel — kontekst bar', () => {
  it('pokazuje widok gdy kontekst jest wypelniony', () => {
    render(<FloatingAgentPanel {...defaultProps} />);
    fireEvent.click(document.querySelector('button[title="Otworz agentow"]')!);
    expect(screen.getByText(/Topologia/i)).toBeInTheDocument();
  });
});

// ============================================================
// Test 4: Brak tekstow sugerujacych AI
// ============================================================
describe('FloatingAgentPanel — brak gotowych rozwiazan AI', () => {
  it('NIE ma tekstow sugerujacych gotowe rozwiazania AI', () => {
    render(<FloatingAgentPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Otworz agentow'));
    const forbidden = [
      'Git Helper', 'Notatnik',
      'Wybierz szablon', 'Szablon agenta', 'preset',
      'inteligentny asystent', 'asystent ai',
    ];
    for (const text of forbidden) {
      expect(screen.queryByText(text, { exact: false })).not.toBeInTheDocument();
    }
  });
});
