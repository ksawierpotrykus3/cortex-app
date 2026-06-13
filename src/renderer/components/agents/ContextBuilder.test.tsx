// @vitest-environment jsdom
// ============================================================================
// NEXUS — ContextBuilder Tests
// ============================================================================

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ContextBuilder } from './ContextBuilder';
import { ContextConfig, DEFAULT_CONTEXT_CONFIG } from '../../../shared/types/schema';

// Helper: create a config with specific includedEntities
function configWithEntities(entityIds: string[]): ContextConfig {
  return {
    ...DEFAULT_CONTEXT_CONFIG,
    includedEntities: entityIds.map((id, i) => ({
      type: (i === 0 ? 'node' : i === 1 ? 'task' : 'draft') as 'node' | 'task' | 'draft',
      entityId: id,
    })),
  };
}

describe('ContextBuilder', () => {
  beforeEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  // === Happy Path ==========================================================
  it('renders all three sections (nodes, tasks, drafts) with checkboxes', async () => {
    // Provide mock bridge data
    vi.stubGlobal('nexusBridge', {
      getWorkspaceEntities: vi.fn().mockResolvedValue({
        nodes: [
          { id: 'node-1', title: 'Notatka architektura' },
          { id: 'node-2', title: 'API design' },
        ],
        tasks: [
          { id: 'task-1', title: 'Dokończyć testy' },
        ],
        drafts: [
          { id: 'draft-1', contentPreview: 'Manuskrypt o AI...' },
        ],
      }),
    });

    render(<ContextBuilder config={DEFAULT_CONTEXT_CONFIG} onChange={vi.fn()} />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Nexus Canvas — Notatki')).toBeTruthy();
    });

    expect(screen.getByText('Lab — Taski')).toBeTruthy();
    expect(screen.getByText('Lab — Manuskrypty')).toBeTruthy();

    // Should show specific items
    expect(screen.getByText('Notatka architektura')).toBeTruthy();
    expect(screen.getByText('API design')).toBeTruthy();
    expect(screen.getByText('Dokończyć testy')).toBeTruthy();
    expect(screen.getByText('Manuskrypt o AI...')).toBeTruthy();

    // Should show "Inne" section with toggles
    expect(screen.getByText('Inne')).toBeTruthy();
    expect(screen.getByText('Dołącz obraz z schowka')).toBeTruthy();
    expect(screen.getByText('Dołącz output ostatniego agenta')).toBeTruthy();
  });

  it('selects and deselects items via checkboxes', async () => {
    vi.stubGlobal('nexusBridge', {
      getWorkspaceEntities: vi.fn().mockResolvedValue({
        nodes: [{ id: 'node-1', title: 'Test Note' }],
        tasks: [],
        drafts: [],
      }),
    });

    // Track config like the real store would
    let currentConfig = { ...DEFAULT_CONTEXT_CONFIG };
    const onChange = vi.fn((cfg: ContextConfig) => {
      currentConfig = cfg;
    });

    const { rerender } = render(<ContextBuilder config={currentConfig} onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByText('Test Note')).toBeTruthy();
    });

    // Find the entity checkbox (first non-sr-only checkbox) by looking for the label containing "Test Note"
    const noteLabel = screen.getByText('Test Note').closest('label');
    expect(noteLabel).toBeTruthy();
    const checkbox = noteLabel!.querySelector('input[type="checkbox"]');
    expect(checkbox).toBeTruthy();
    fireEvent.click(checkbox!);

    expect(onChange).toHaveBeenCalledTimes(1);
    const newConfig = onChange.mock.calls[0][0] as ContextConfig;
    expect(newConfig.includedEntities).toEqual([
      { type: 'node', entityId: 'node-1' },
    ]);

    // Re-render with updated config to simulate store update
    rerender(<ContextBuilder config={newConfig} onChange={onChange} />);

    // Click again to deselect
    const noteLabel2 = screen.getByText('Test Note').closest('label');
    const checkbox2 = noteLabel2!.querySelector('input[type="checkbox"]');
    fireEvent.click(checkbox2!);
    expect(onChange).toHaveBeenCalledTimes(2);
    const deselectConfig = onChange.mock.calls[1][0] as ContextConfig;
    expect(deselectConfig.includedEntities).toEqual([]);
  });

  it('shows summary count when items are selected', async () => {
    vi.stubGlobal('nexusBridge', {
      getWorkspaceEntities: vi.fn().mockResolvedValue({
        nodes: [
          { id: 'n1', title: 'Note 1' },
          { id: 'n2', title: 'Note 2' },
        ],
        tasks: [{ id: 't1', title: 'Task 1' }],
        drafts: [],
      }),
    });

    const config = configWithEntities(['n1', 't1']);
    const { container } = render(<ContextBuilder config={config} onChange={vi.fn()} />);

    await waitFor(() => {
      expect(container.textContent).toContain('2');
      expect(container.textContent).toContain('notatka');
      expect(container.textContent).toContain('task');
    });
  });

  // === Edge Case: 0 selected ==============================================
  it('shows "nie wybrano" message when no entities selected', async () => {
    vi.stubGlobal('nexusBridge', {
      getWorkspaceEntities: vi.fn().mockResolvedValue({
        nodes: [{ id: 'n1', title: 'Note 1' }],
        tasks: [],
        drafts: [],
      }),
    });

    render(<ContextBuilder config={DEFAULT_CONTEXT_CONFIG} onChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Nie wybrano żadnych elementów/)).toBeTruthy();
    });
  });

  it('shows empty section messages when no data available', async () => {
    vi.stubGlobal('nexusBridge', {
      getWorkspaceEntities: vi.fn().mockResolvedValue({
        nodes: [],
        tasks: [],
        drafts: [],
      }),
    });

    render(<ContextBuilder config={DEFAULT_CONTEXT_CONFIG} onChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Brak notatek w workspace')).toBeTruthy();
    });
    expect(screen.getByText('Brak tasków w workspace')).toBeTruthy();
    expect(screen.getByText('Brak manuskryptów w workspace')).toBeTruthy();
  });

  // === Error Case ==========================================================
  it('shows error message when bridge fails', async () => {
    vi.stubGlobal('nexusBridge', {
      getWorkspaceEntities: vi.fn().mockRejectedValue(new Error('Connection refused')),
    });

    render(<ContextBuilder config={DEFAULT_CONTEXT_CONFIG} onChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Connection refused')).toBeTruthy();
    });
  });

  it('recovers after error on refresh', async () => {
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        nodes: [{ id: 'n1', title: 'Note after refresh' }],
        tasks: [],
        drafts: [],
      });

    vi.stubGlobal('nexusBridge', {
      getWorkspaceEntities: mockFn,
    });

    render(<ContextBuilder config={DEFAULT_CONTEXT_CONFIG} onChange={vi.fn()} />);

    // Error should show
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeTruthy();
    });

    // Click refresh button
    const refreshBtn = screen.getByText('Odśwież listę');
    fireEvent.click(refreshBtn);

    // After refresh, data should load
    await waitFor(() => {
      expect(screen.getByText('Note after refresh')).toBeTruthy();
    });
  });

  // === Filtering / Limit ==================================================
  it('shows refresh button that reloads data', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      nodes: [{ id: 'n1', title: 'Note 1' }],
      tasks: [],
      drafts: [],
    });

    vi.stubGlobal('nexusBridge', {
      getWorkspaceEntities: mockFn,
    });

    render(<ContextBuilder config={DEFAULT_CONTEXT_CONFIG} onChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Note 1')).toBeTruthy();
    });

    // Click refresh
    fireEvent.click(screen.getByText('Odśwież listę'));
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('handles empty bridge gracefully by showing error', async () => {
    // No nexusBridge available — should show error, not fallback data
    render(<ContextBuilder config={DEFAULT_CONTEXT_CONFIG} onChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Brak mostu IPC/)).toBeTruthy();
    });
  });

  // === Inne Section Toggles ================================================
  it('toggles includeClipboardImage flag via Inne section', async () => {
    vi.stubGlobal('nexusBridge', {
      getWorkspaceEntities: vi.fn().mockResolvedValue({
        nodes: [],
        tasks: [],
        drafts: [],
      }),
    });

    let currentConfig = { ...DEFAULT_CONTEXT_CONFIG };
    const onChange = vi.fn((cfg: ContextConfig) => {
      currentConfig = cfg;
    });

    const { rerender } = render(<ContextBuilder config={currentConfig} onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByText('Inne')).toBeTruthy();
    });

    // Find the clipboard toggle label and click its checkbox
    const clipboardLabel = screen.getByText('Dołącz obraz z schowka').closest('label');
    expect(clipboardLabel).toBeTruthy();
    const clipboardToggle = clipboardLabel!.querySelector('input[type="checkbox"]');
    expect(clipboardToggle).toBeTruthy();
    fireEvent.click(clipboardToggle!);

    expect(onChange).toHaveBeenCalledTimes(1);
    const cfg = onChange.mock.calls[0][0] as ContextConfig;
    expect(cfg.includeClipboardImage).toBe(true);

    // Re-render and toggle off
    rerender(<ContextBuilder config={cfg} onChange={onChange} />);
    const clipboardLabel2 = screen.getByText('Dołącz obraz z schowka').closest('label');
    const clipboardToggle2 = clipboardLabel2!.querySelector('input[type="checkbox"]');
    fireEvent.click(clipboardToggle2!);

    expect(onChange).toHaveBeenCalledTimes(2);
    const cfg2 = onChange.mock.calls[1][0] as ContextConfig;
    expect(cfg2.includeClipboardImage).toBe(false);
  });

  it('toggles includeLastAgentOutput flag via Inne section', async () => {
    vi.stubGlobal('nexusBridge', {
      getWorkspaceEntities: vi.fn().mockResolvedValue({
        nodes: [],
        tasks: [],
        drafts: [],
      }),
    });

    let currentConfig = { ...DEFAULT_CONTEXT_CONFIG };
    const onChange = vi.fn((cfg: ContextConfig) => {
      currentConfig = cfg;
    });

    const { rerender } = render(<ContextBuilder config={currentConfig} onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByText('Inne')).toBeTruthy();
    });

    // Find the last agent output toggle label and click its checkbox
    const outputLabel = screen.getByText('Dołącz output ostatniego agenta').closest('label');
    expect(outputLabel).toBeTruthy();
    const outputToggle = outputLabel!.querySelector('input[type="checkbox"]');
    expect(outputToggle).toBeTruthy();
    fireEvent.click(outputToggle!);

    expect(onChange).toHaveBeenCalledTimes(1);
    const cfg = onChange.mock.calls[0][0] as ContextConfig;
    expect(cfg.includeLastAgentOutput).toBe(true);

    // Re-render and toggle off
    rerender(<ContextBuilder config={cfg} onChange={onChange} />);
    const outputLabel2 = screen.getByText('Dołącz output ostatniego agenta').closest('label');
    const outputToggle2 = outputLabel2!.querySelector('input[type="checkbox"]');
    fireEvent.click(outputToggle2!);

    expect(onChange).toHaveBeenCalledTimes(2);
    const cfg2 = onChange.mock.calls[1][0] as ContextConfig;
    expect(cfg2.includeLastAgentOutput).toBe(false);
  });
});
