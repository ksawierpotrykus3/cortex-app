// @vitest-environment jsdom
// ================================================================
// NEXUS — AgentHistoryPanel: Tests
// ================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import '@testing-library/jest-dom/vitest';
import { AgentHistoryPanel } from './AgentHistoryPanel';

// ============================================================
// Mock data
// ============================================================
const mockOutputs = [
  {
    id: 'out-1',
    agentId: 'agent-1',
    agentName: 'Streszczacz',
    status: 'active' as const,
    prompt: 'Streszcz tekst',
    contextSize: 100,
    content: 'To jest pierwszy output',
    tokensUsed: 150,
    executionMs: 1200,
    triggerType: 'manual' as const,
    modelName: 'gemini-2.0-flash',
    rating: 8,
    approved: true,
    tags: [],
    createdAt: '2024-06-01T10:00:00Z',
    completedAt: '2024-06-01T10:00:01Z',
  },
  {
    id: 'out-2',
    agentId: 'agent-1',
    agentName: 'Streszczacz',
    status: 'active' as const,
    prompt: 'Sprawdź tekst',
    contextSize: 200,
    content: 'Drugi output z błędem',
    tokensUsed: 300,
    executionMs: 2500,
    triggerType: 'manual' as const,
    modelName: 'gemini-2.0-flash',
    rating: 3,
    approved: false,
    tags: [],
    createdAt: '2024-06-02T10:00:00Z',
    completedAt: '2024-06-02T10:00:02Z',
    error: 'Wystąpił błąd',
  },
];

const mockStats = {
  total: 2,
  avgTokens: 225,
  avgExecutionMs: 1850,
  errorRate: 0.5,
};

// ============================================================
// Tests
// ============================================================
describe('AgentHistoryPanel', () => {
  beforeEach(() => {
    (window as any).nexusBridge = {
      getOutputs: vi.fn().mockResolvedValue(mockOutputs),
      getOutputStats: vi.fn().mockResolvedValue(mockStats),
      deleteOutput: vi.fn().mockResolvedValue({ success: true }),
      clearOutputs: vi.fn().mockResolvedValue({ success: true }),
      executeAgent: vi.fn().mockResolvedValue({ success: true }),
    };
  });

  afterEach(() => {
    cleanup();
    delete (window as any).nexusBridge;
  });

  // ------------------------------------------------------------------
  // Test 1: Ładuje i wyświetla outputy
  // ------------------------------------------------------------------
  it('ładuje i wyświetla outputy przez bridge.getOutputs', async () => {
    render(<AgentHistoryPanel agentId="agent-1" agentName="Streszczacz" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('To jest pierwszy output')).toBeInTheDocument();
    });
    expect(screen.getByText('Drugi output z błędem')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // Test 2: Wyświetla statystyki
  // ------------------------------------------------------------------
  it('wyświetla statystyki z bridge.getOutputStats', async () => {
    render(<AgentHistoryPanel agentId="agent-1" agentName="Streszczacz" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Łącznie: 2/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Śr. tokenów: 225/)).toBeInTheDocument();
    expect(screen.getByText(/Błędy: 50%/)).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // Test 3: Filtruje po search
  // ------------------------------------------------------------------
  it('filtruje outputy po wpisaniu tekstu w search', async () => {
    render(<AgentHistoryPanel agentId="agent-1" agentName="Streszczacz" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('To jest pierwszy output')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Szukaj w outputach...');
    fireEvent.change(searchInput, { target: { value: 'Drugi' } });

    expect(screen.queryByText('To jest pierwszy output')).not.toBeInTheDocument();
    expect(screen.getByText('Drugi output z błędem')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // Test 4: Delete output woła bridge.deleteOutput z id
  // ------------------------------------------------------------------
  it('usuwa output przez bridge.deleteOutput z id', async () => {
    render(<AgentHistoryPanel agentId="agent-1" agentName="Streszczacz" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('To jest pierwszy output')).toBeInTheDocument();
    });

    // Znajdź pierwszy przycisk "Usuń" (Trash2) — każdy output ma button z title="Usuń"
    const deleteButtons = screen.getAllByTitle('Usuń');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect((window as any).nexusBridge.deleteOutput).toHaveBeenCalledWith({ id: 'out-1' });
    });
  });

  // ------------------------------------------------------------------
  // Test 5: Clear all woła bridge.clearOutputs z agentId
  // ------------------------------------------------------------------
  it('czyści wszystkie outputy przez bridge.clearOutputs z agentId', async () => {
    render(<AgentHistoryPanel agentId="agent-1" agentName="Streszczacz" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('To jest pierwszy output')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Wyczyść'));

    await waitFor(() => {
      expect((window as any).nexusBridge.clearOutputs).toHaveBeenCalledWith({ agentId: 'agent-1' });
    });
  });

  // ------------------------------------------------------------------
  // Test 6: Pusty stan pokazuje "Brak outputów"
  // ------------------------------------------------------------------
  it('pokazuje "Brak outputów" gdy lista jest pusta', async () => {
    (window as any).nexusBridge.getOutputs = vi.fn().mockResolvedValue([]);

    render(<AgentHistoryPanel agentId="agent-1" agentName="Streszczacz" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Brak outputów dla tego agenta')).toBeInTheDocument();
    });
  });
});