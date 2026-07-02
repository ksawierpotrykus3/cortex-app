// @vitest-environment jsdom
// ================================================================
// NEXUS — TopNavigation: Tests
// ================================================================

import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import '@testing-library/jest-dom/vitest';
import { TopNavigation } from './TopNavigation';
import { ViewMode, RightPanelState, ModalState } from '../types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (window as any).nexusBridge;
});

const defaultProps = {
  activeView: 'nexus' as ViewMode,
  setActiveView: vi.fn(),
  rightPanel: 'none' as RightPanelState,
  setRightPanel: vi.fn(),
  setModal: vi.fn(),
  isSidebarOpen: true,
  setIsSidebarOpen: vi.fn(),
  onOpenTagDialog: undefined,
};

// ============================================================
// Test 1: Renderowanie glownych zakladek
// ============================================================
describe('TopNavigation — zakladki', () => {
  it('renderuje glowne zakladki: Topology, Laboratory, More', () => {
    render(<TopNavigation {...defaultProps} />);

    expect(screen.getByText('Topology')).toBeInTheDocument();
    expect(screen.getByText('Laboratory')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('NIE renderuje "Szukaj AI" ani "AI Search"', () => {
    render(<TopNavigation {...defaultProps} />);

    expect(screen.queryByText('Szukaj AI')).not.toBeInTheDocument();
    expect(screen.queryByText('AI Search')).not.toBeInTheDocument();
  });
});

// ============================================================
// Test 2: Klikniecie na zakladke zmienia activeView
// ============================================================
describe('TopNavigation — zmiana widoku', () => {
  it('klikniecie Topology wywoluje setActiveView z "nexus"', () => {
    const setActiveView = vi.fn();
    render(<TopNavigation {...defaultProps} setActiveView={setActiveView} activeView="sandbox" />);

    fireEvent.click(screen.getByText('Topology'));
    expect(setActiveView).toHaveBeenCalledWith('nexus');
  });

  it('klikniecie Laboratory wywoluje setActiveView z "lab-todo"', () => {
    const setActiveView = vi.fn();
    render(<TopNavigation {...defaultProps} setActiveView={setActiveView} />);

    fireEvent.click(screen.getByText('Laboratory'));
    expect(setActiveView).toHaveBeenCalledWith('lab-todo');
  });

  
});

// ============================================================
// Test 3: More dropdown — klikniecie otwiera subViews
// ============================================================
describe('TopNavigation — More dropdown', () => {
  it('klikniecie More otwiera dropdown z subViews', () => {
    render(<TopNavigation {...defaultProps} />);

    fireEvent.click(screen.getByText('More'));

    // Sprawdz czy dropdown zawiera expected sub-views
    expect(screen.getByText('Raw Fragments')).toBeInTheDocument();
    expect(screen.getByText('Changes')).toBeInTheDocument();
    expect(screen.getByText('Wiki')).toBeInTheDocument();
    expect(screen.getByText('Git')).toBeInTheDocument();
    expect(screen.getByText('Feedback')).toBeInTheDocument();
  });

  it('klikniecie elementu w More dropdown zmienia widok', () => {
    const setActiveView = vi.fn();
    render(<TopNavigation {...defaultProps} setActiveView={setActiveView} />);

    // Otworz dropdown
    fireEvent.click(screen.getByText('More'));
    // Kliknij "Git"
    fireEvent.click(screen.getByText('Git'));

    expect(setActiveView).toHaveBeenCalledWith('git');
  });
});

// ============================================================
// Test 4: Feedback badge/licznik nieprzeczytanych
// ============================================================
describe('TopNavigation — Feedback', () => {
  it('pokazuje Feedback w dropdown More', () => {
    render(<TopNavigation {...defaultProps} />);

    fireEvent.click(screen.getByText('More'));

    expect(screen.getByText('Feedback')).toBeInTheDocument();
  });

  it('klikniecie Feedback w dropdown zmienia widok na feedback', () => {
    const setActiveView = vi.fn();
    render(<TopNavigation {...defaultProps} setActiveView={setActiveView} />);

    fireEvent.click(screen.getByText('More'));
    fireEvent.click(screen.getByText('Feedback'));

    expect(setActiveView).toHaveBeenCalledWith('feedback');
  });
});
