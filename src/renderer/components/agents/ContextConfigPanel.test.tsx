// @vitest-environment jsdom
// ============================================================================
// NEXUS — ContextConfigPanel Tests
// ============================================================================

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ContextConfigPanel } from './ContextConfigPanel';
import { ContextConfig, DEFAULT_CONTEXT_CONFIG } from '../../../shared/types/schema';

// Helper: create a default config with specific sources enabled
function configWithEnabled(sourceIds: string[]): ContextConfig {
  return {
    ...DEFAULT_CONTEXT_CONFIG,
    sources: DEFAULT_CONTEXT_CONFIG.sources.map(s => ({
      ...s,
      enabled: sourceIds.includes(s.id),
    })),
  };
}

describe('ContextConfigPanel', () => {
  beforeEach(() => {
    cleanup();
    // Reset nexusBridge — używamy stubGlobal zamiast window manipulacji (P8 fix)
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  // === Happy Path ==========================================================
  it('renders all context sources with checkboxes', () => {
    render(<ContextConfigPanel config={DEFAULT_CONTEXT_CONFIG} onChange={vi.fn()} agentId="agent-1" agentName="Test" />);

    // All 8 sources should be present
    expect(screen.getByText('Notatki (NexusNode)')).toBeTruthy();
    expect(screen.getByText('Zadania (Task)')).toBeTruthy();
    expect(screen.getByText('Manuskrypty (WritingDraft)')).toBeTruthy();
    expect(screen.getByText('Historia outputów agenta')).toBeTruthy();
    expect(screen.getByText('Schowek systemowy')).toBeTruthy();
    expect(screen.getByText('Zmiany od ostatniego uruchomienia')).toBeTruthy();
    expect(screen.getByText('Plik z dysku')).toBeTruthy();
    expect(screen.getByText('Wynik innego agenta')).toBeTruthy();
  });

  it('toggles a source on checkbox click', () => {
    const onChange = vi.fn();
    render(<ContextConfigPanel config={DEFAULT_CONTEXT_CONFIG} onChange={onChange} agentId="agent-1" agentName="Test" />);

    // Find the first checkbox and click it
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    expect(onChange).toHaveBeenCalledTimes(1);
    const newConfig = onChange.mock.calls[0][0] as ContextConfig;
    expect(newConfig.sources[0].enabled).toBe(true);
  });

  it('shows "aktywne" badge when source is enabled', () => {
    const config = configWithEnabled(['notes']);
    render(<ContextConfigPanel config={config} onChange={vi.fn()} agentId="agent-1" agentName="Test" />);

    expect(screen.getByText('aktywne')).toBeTruthy();
  });

  it('renders max token input', () => {
    render(<ContextConfigPanel config={DEFAULT_CONTEXT_CONFIG} onChange={vi.fn()} agentId="agent-1" agentName="Test" />);
    expect(screen.getByText('Limit tokenów kontekstu')).toBeTruthy();
  });

  // === Happy Path (F6.2) ==================================================
  it('shows source breakdown when fetchContext returns it', async () => {
    const config = configWithEnabled(['notes']);
    const mockResult = {
      context: 'test note content',
      tokensUsed: 50,
      sourceBreakdown: [
        { sourceId: 'notes', chars: 100, tokens: 50 },
        { sourceId: '_custom_instructions', chars: 20, tokens: 10 },
      ],
    };
    vi.stubGlobal('nexusBridge', { fetchContext: vi.fn().mockResolvedValue(mockResult) });

    render(<ContextConfigPanel config={config} onChange={vi.fn()} agentId="agent-1" agentName="Test" />);

    const buttons = screen.getAllByRole('button');
    const testBtn = buttons.find(b => b.textContent?.includes('Testuj kontekst'))!;
    fireEvent.click(testBtn);

    await screen.findByText('test note content');

    // Source breakdown labels should appear
    expect(screen.getByText(/notes/)).toBeTruthy();
    expect(screen.getByText(/50 tok/)).toBeTruthy();
    expect(screen.getByText(/custom instructions/)).toBeTruthy();
    expect(screen.getByText(/10 tok/)).toBeTruthy();
  });

  // === Edge Cases (F6.2) ==================================================
  it('shows warning when no specific IDs selected for notes', () => {
    const config = configWithEnabled(['notes']);
    // Set selection type to 'ids' with empty array
    const configWithSelection: ContextConfig = {
      ...config,
      sources: config.sources.map(s =>
        s.id === 'notes' ? { ...s, selection: { type: 'ids' as const, ids: [] } } : s
      ),
    };

    render(<ContextConfigPanel config={configWithSelection} onChange={vi.fn()} agentId="agent-1" agentName="Test" />);

    expect(screen.getByText('Nie wybrano notatek — zostaną użyte wszystkie')).toBeTruthy();
  });

  it('shows tooltip when file source enabled without path', () => {
    const config = configWithEnabled(['file']);
    render(<ContextConfigPanel config={config} onChange={vi.fn()} agentId="agent-1" agentName="Test" />);

    // Button should be disabled
    const buttons = screen.getAllByRole('button');
    const testBtn = buttons.find(b => b.textContent?.includes('Testuj kontekst'))!;
    expect(testBtn).toBeTruthy();
    expect(testBtn!.hasAttribute('disabled')).toBe(true);

    // Tooltip should appear (the "Podaj ścieżkę pliku" warning)
    expect(screen.getByText('Podaj ścieżkę pliku')).toBeTruthy();
  });

  // === Filtering (F6.2) ===================================================
  it('shows selection toggle for tasks source when enabled', () => {
    const config = configWithEnabled(['tasks']);
    render(<ContextConfigPanel config={config} onChange={vi.fn()} agentId="agent-1" agentName="Test" />);

    expect(screen.getByText('Wybór zadań')).toBeTruthy();
    // Selection toggle buttons — use getAllByText because "Wszystkie" also appears in status dropdown
    const allWszystkie = screen.getAllByText('Wszystkie');
    expect(allWszystkie.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Wybrane')).toBeTruthy();
  });

  // === Existing: Edge Cases ===============================================
  it('disables test button when no sources are selected', () => {
    render(<ContextConfigPanel config={DEFAULT_CONTEXT_CONFIG} onChange={vi.fn()} agentId="agent-1" agentName="Test" />);

    const buttons = screen.getAllByRole('button');
    const testBtn = buttons.find(b => b.textContent?.includes('Testuj kontekst'));
    expect(testBtn).toBeTruthy();
    expect(testBtn!.hasAttribute('disabled')).toBe(true);
  });

  it('shows warning when no sources selected', () => {
    render(<ContextConfigPanel config={DEFAULT_CONTEXT_CONFIG} onChange={vi.fn()} agentId="agent-1" agentName="Test" />);

    expect(screen.getByText('Wybierz co najmniej jedno źródło kontekstu')).toBeTruthy();
  });

  it('enables test button when at least one source is selected', () => {
    const config = configWithEnabled(['notes']);
    render(<ContextConfigPanel config={config} onChange={vi.fn()} agentId="agent-1" agentName="Test" />);

    const buttons = screen.getAllByRole('button');
    const testBtn = buttons.find(b => b.textContent?.includes('Testuj kontekst'));
    expect(testBtn).toBeTruthy();
    expect(testBtn!.hasAttribute('disabled')).toBe(false);
  });

  it('shows specific config for notes source when enabled', () => {
    const config = configWithEnabled(['notes']);
    render(<ContextConfigPanel config={config} onChange={vi.fn()} agentId="agent-1" agentName="Test" />);

    expect(screen.getByText('Projekt')).toBeTruthy();
    expect(screen.getByText('Szukaj notatki')).toBeTruthy();
  });

  it('shows specific config for tasks source when enabled', () => {
    const config = configWithEnabled(['tasks']);
    render(<ContextConfigPanel config={config} onChange={vi.fn()} agentId="agent-1" agentName="Test" />);

    expect(screen.getByText('Status')).toBeTruthy();
  });

  it('shows path input for file source when enabled', () => {
    const config = configWithEnabled(['file']);
    render(<ContextConfigPanel config={config} onChange={vi.fn()} agentId="agent-1" agentName="Test" />);

    expect(screen.getByPlaceholderText('C:/path/to/file.txt')).toBeTruthy();
  });

  // === Error Case ==========================================================
  it('handles fetchContext error gracefully', async () => {
    const config = configWithEnabled(['notes']);
    vi.stubGlobal('nexusBridge', {
        fetchContext: vi.fn().mockRejectedValue(new Error('Network error')),
      });

    render(<ContextConfigPanel config={config} onChange={vi.fn()} agentId="agent-1" agentName="Test" />);

    const buttons = screen.getAllByRole('button');
    const testBtn = buttons.find(b => b.textContent?.includes('Testuj kontekst'))!;
    fireEvent.click(testBtn);

    const errorText = await screen.findByText(/Błąd: Network error/);
    expect(errorText).toBeTruthy();
  });

  it('calls fetchContext with correct payload', async () => {
    const onChange = vi.fn();
    const config = configWithEnabled(['notes']);
    const mockFetch = vi.fn().mockResolvedValue({ context: 'test context', tokensUsed: 50 });
    vi.stubGlobal('nexusBridge', { fetchContext: mockFetch });

    render(<ContextConfigPanel config={config} onChange={onChange} agentId="agent-1" agentName="Test" />);

    const buttons = screen.getAllByRole('button');
    const testBtn = buttons.find(b => b.textContent?.includes('Testuj kontekst'))!;
    fireEvent.click(testBtn);

    await screen.findByText('test context');

    expect(mockFetch).toHaveBeenCalledWith({
      agentId: 'agent-1',
      contextConfig: config,
    });
  });

  it('closes modal on close button click', async () => {
    const config = configWithEnabled(['notes']);
    vi.stubGlobal('nexusBridge', {
      fetchContext: vi.fn().mockResolvedValue({ context: 'test context', tokensUsed: 50 }),
    });

    render(<ContextConfigPanel config={config} onChange={vi.fn()} agentId="agent-1" agentName="Test" />);

    // Open modal
    const buttons = screen.getAllByRole('button');
    const testBtn = buttons.find(b => b.textContent?.includes('Testuj kontekst'))!;
    fireEvent.click(testBtn);
    await screen.findByText('test context');

    // Close modal
    fireEvent.click(screen.getByText('Zamknij'));
    expect(screen.queryByText('test context')).toBeNull();
  });

  // === Fallback test (no bridge) ===========================================
  it('shows fallback when no nexusBridge available', async () => {
    const config = configWithEnabled(['notes']);
    // Explicitly no bridge set
    render(<ContextConfigPanel config={config} onChange={vi.fn()} agentId="agent-1" agentName="Test" />);

    const buttons = screen.getAllByRole('button');
    const testBtn = buttons.find(b => b.textContent?.includes('Testuj kontekst'))!;
    fireEvent.click(testBtn);

    await screen.findByText(/Wybrane źródła kontekstu/);
  });

  // === Selection Toggle Tests (F6.2) =======================================
  it('shows selection toggle for notes source', () => {
    const config = configWithEnabled(['notes']);
    render(<ContextConfigPanel config={config} onChange={vi.fn()} agentId="agent-1" agentName="Test" />);

    expect(screen.getByText('Wybór notatek')).toBeTruthy();
    expect(screen.getByText('Wszystkie')).toBeTruthy();
    expect(screen.getByText('Wybrane')).toBeTruthy();
  });

  it('shows warning for empty ids selection in agent_output source', () => {
    const config: ContextConfig = {
      ...DEFAULT_CONTEXT_CONFIG,
      sources: DEFAULT_CONTEXT_CONFIG.sources.map(s =>
        s.id === 'agent_output'
          ? { ...s, enabled: true, selection: { type: 'ids' as const, ids: [] } }
          : s
      ),
    };

    render(<ContextConfigPanel config={config} onChange={vi.fn()} agentId="agent-1" agentName="Test" />);

    expect(screen.getByText(/Nie wybrano konkretnych outputów/)).toBeTruthy();
  });

  it('shows browse button for file source', () => {
    const config = configWithEnabled(['file']);
    render(<ContextConfigPanel config={config} onChange={vi.fn()} agentId="agent-1" agentName="Test" />);

    expect(screen.getByText('Przeglądaj')).toBeTruthy();
  });
});
