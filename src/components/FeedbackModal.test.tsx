// @vitest-environment jsdom
// ================================================================
// NEXUS #26 — FeedbackModal: Tests
// ================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import '@testing-library/jest-dom/vitest';
import { FeedbackModal } from './FeedbackModal';
import { ViewMode } from '../types';
import { useAgentStore } from '../renderer/store/agentStore';

// ============================================================
// Setup: mock agent store
// ============================================================
beforeEach(() => {
  useAgentStore.setState({
    agents: [
      { id: 'agent_1', name: 'Streszczacz' },
      { id: 'agent_2', name: 'Korektor' },
    ] as any,
  });
});

afterEach(() => {
  cleanup();
});

// ============================================================
// Default props helper
// ============================================================
const defaultProps = {
  viewMode: 'nexus' as ViewMode,
  selectedAgentId: null,
  selectedNodeId: null,
  selectedTaskId: null,
  selectedManuscriptId: null,
  projectId: null,
  lastAction: 'Widok: nexus',
  nodes: [
    { id: 'node_1', title: 'Q3 Plan' },
    { id: 'node_2', title: 'Notatka testowa' },
  ],
  tasks: [
    { id: 'task_1', title: 'Zrobić X' },
    { id: 'task_2', title: 'Zrobić Y' },
  ],
  manuscripts: [
    { id: 'ms_1', title: 'Rozdział 1' },
  ],
  onSave: vi.fn().mockResolvedValue({ success: true }),
};

// ============================================================
// Test 1: Happy path — formularz + entity picker + rating
// ============================================================
describe('FeedbackModal — Happy path', () => {
  it('wysyła pełny feedback z entity pickerem i ratingiem', async () => {
    const onSave = vi.fn().mockResolvedValue({ success: true });
    render(<FeedbackModal {...defaultProps} onSave={onSave} />);

    // Open the modal
    fireEvent.click(screen.getByTitle('Przekaż pomysł'));

    // Select entity type: Agent AI
    fireEvent.click(screen.getByLabelText('Agent AI'));

    // Wait for dropdown to appear and select an agent
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'agent_1' } });

    // Verify context shows the selected element
    await waitFor(() => {
      expect(screen.getAllByText('Streszczacz').length).toBeGreaterThanOrEqual(1);
    });

    // Fill title
    fireEvent.change(screen.getByPlaceholderText('Krótki tytuł zgłoszenia'), {
      target: { value: 'Test feedback' },
    });

    // Fill description
    fireEvent.change(screen.getByPlaceholderText('Opisz czego dotyczy zgłoszenie...'), {
      target: { value: 'Opis testowy' },
    });

    // Optional: fill suggestion
    fireEvent.change(screen.getByPlaceholderText('Jak mogłoby działać?'), {
      target: { value: 'Moja sugestia' },
    });

    // Set rating — click the 3rd star button in the stars container
    // Star buttons are the ones with just an SVG icon, inside the rating section
    const allButtons = screen.getAllByRole('button');
    // The Star buttons are small icon-buttons — find them by looking for buttons
    // that contain an SVG with class "lucide-star"
    const starContainers = screen.getByText('Ocena (opcjonalnie)').closest('div')!;
    const starBtns = starContainers.querySelectorAll('button');
    if (starBtns.length >= 3) {
      fireEvent.click(starBtns[2]); // 3rd star = rating 3
    }

    // Click save
    fireEvent.click(screen.getByText('Zapisz'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const saved = onSave.mock.calls[0][0];

    // Verify all fields
    expect(saved.title).toBe('Test feedback');
    expect(saved.context).toBe('Opis testowy');
    expect(saved.suggestion).toBe('Moja sugestia');
    expect(saved.entityType).toBe('agent');
    expect(saved.entityId).toBe('agent_1');
    expect(saved.entityLabel).toBe('Streszczacz');
    expect(saved.rating).toBe(3);
    expect(saved.status).toBe('new');

    // Context snapshot
    expect(saved.contextSnapshot).toBeDefined();
    expect(saved.contextSnapshot.viewMode).toBe('nexus');
    expect(saved.contextSnapshot.selectedAgentId).toBe('agent_1');
    expect(saved.contextSnapshot.lastAction).toBe('Widok: nexus');
  });
});

// ============================================================
// Test 2: Edge case — brak tytułu → przycisk disabled
// ============================================================
describe('FeedbackModal — Validation', () => {
  it('przycisk Zapisz jest disabled gdy brak tytułu', () => {
    render(<FeedbackModal {...defaultProps} />);

    // Open
    fireEvent.click(screen.getByTitle('Przekaż pomysł'));

    // Button should be disabled initially (no title, no description)
    const saveButton = screen.getByText('Zapisz');
    expect(saveButton).toBeDisabled();

    // Fill description but not title
    fireEvent.change(screen.getByPlaceholderText('Opisz czego dotyczy zgłoszenie...'), {
      target: { value: 'Opis testowy' },
    });
    expect(saveButton).toBeDisabled();

    // Fill title
    fireEvent.change(screen.getByPlaceholderText('Krótki tytuł zgłoszenia'), {
      target: { value: 'Tytuł' },
    });

    // Now button should be enabled
    expect(saveButton).not.toBeDisabled();
  });

  it('przycisk Zapisz jest disabled gdy brak opisu', () => {
    render(<FeedbackModal {...defaultProps} />);

    fireEvent.click(screen.getByTitle('Przekaż pomysł'));

    const saveButton = screen.getByText('Zapisz');
    expect(saveButton).toBeDisabled();

    // Fill only title
    fireEvent.change(screen.getByPlaceholderText('Krótki tytuł zgłoszenia'), {
      target: { value: 'Tytuł' },
    });
    expect(saveButton).toBeDisabled();

    // Now fill description
    fireEvent.change(screen.getByPlaceholderText('Opisz czego dotyczy zgłoszenie...'), {
      target: { value: 'Opis' },
    });
    expect(saveButton).not.toBeDisabled();
  });
});

// ============================================================
// Test 3: Error case — IPC błąd → pokazuje błąd w UI
// ============================================================
describe('FeedbackModal — Error handling', () => {
  it('pokazuje komunikat błędu gdy onSave zwraca błąd', async () => {
    const onSave = vi.fn().mockResolvedValue({ success: false, error: 'IPC failure' });
    render(<FeedbackModal {...defaultProps} onSave={onSave} />);

    fireEvent.click(screen.getByTitle('Przekaż pomysł'));

    // Fill required fields
    fireEvent.change(screen.getByPlaceholderText('Krótki tytuł zgłoszenia'), {
      target: { value: 'Tytuł' },
    });
    fireEvent.change(screen.getByPlaceholderText('Opisz czego dotyczy zgłoszenie...'), {
      target: { value: 'Opis' },
    });

    fireEvent.click(screen.getByText('Zapisz'));

    await waitFor(() => {
      expect(screen.getByText('IPC failure')).toBeInTheDocument();
    });
  });

  it('pokazuje komunikat gdy onSave rzuca wyjątkiem', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Network error'));
    render(<FeedbackModal {...defaultProps} onSave={onSave} />);

    fireEvent.click(screen.getByTitle('Przekaż pomysł'));

    fireEvent.change(screen.getByPlaceholderText('Krótki tytuł zgłoszenia'), {
      target: { value: 'Tytuł' },
    });
    fireEvent.change(screen.getByPlaceholderText('Opisz czego dotyczy zgłoszenie...'), {
      target: { value: 'Opis' },
    });

    fireEvent.click(screen.getByText('Zapisz'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('przywraca formularz po błędzie (można spróbować ponownie)', async () => {
    const onSave = vi.fn().mockResolvedValue({ success: false, error: 'Fail' });
    render(<FeedbackModal {...defaultProps} onSave={onSave} />);

    fireEvent.click(screen.getByTitle('Przekaż pomysł'));

    fireEvent.change(screen.getByPlaceholderText('Krótki tytuł zgłoszenia'), {
      target: { value: 'Tytuł' },
    });
    fireEvent.change(screen.getByPlaceholderText('Opisz czego dotyczy zgłoszenie...'), {
      target: { value: 'Opis' },
    });

    fireEvent.click(screen.getByText('Zapisz'));

    // Wait for error
    await waitFor(() => {
      expect(screen.getByText('Fail')).toBeInTheDocument();
    });

    // Fields should still be filled (not reset on error)
    expect((screen.getByPlaceholderText('Krótki tytuł zgłoszenia') as HTMLInputElement).value).toBe('Tytuł');
  });
});

// ============================================================
// Test 4: Kontekst — contextSnapshot zawiera poprawny viewMode
// ============================================================
describe('FeedbackModal — Context snapshot', () => {
  it('contextSnapshot zawiera poprawny viewMode i lastAction', async () => {
    const onSave = vi.fn().mockResolvedValue({ success: true });

    render(
      <FeedbackModal
        {...defaultProps}
        viewMode="agents"
        lastAction="Uruchomienie agenta Streszczacz"
        selectedAgentId="agent_1"
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByTitle('Przekaż pomysł'));

    // Verify context block shows the right info
    expect(screen.getByText('Widok:')).toBeInTheDocument();
    expect(screen.getByText('agents')).toBeInTheDocument();
    expect(screen.getByText('Ostatnia akcja:')).toBeInTheDocument();
    expect(screen.getByText('Uruchomienie agenta Streszczacz')).toBeInTheDocument();

    // Fill and save
    fireEvent.change(screen.getByPlaceholderText('Krótki tytuł zgłoszenia'), {
      target: { value: 'Tytuł' },
    });
    fireEvent.change(screen.getByPlaceholderText('Opisz czego dotyczy zgłoszenie...'), {
      target: { value: 'Opis' },
    });

    fireEvent.click(screen.getByText('Zapisz'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const saved = onSave.mock.calls[0][0];
    expect(saved.contextSnapshot.viewMode).toBe('agents');
    expect(saved.contextSnapshot.lastAction).toBe('Uruchomienie agenta Streszczacz');
    expect(saved.contextSnapshot.selectedAgentId).toBe('agent_1');
    expect(saved.contextSnapshot.projectId).toBeNull();
  });

  it('contextSnapshot zawiera aktualny projekt gdy wybrany node należy do projektu', async () => {
    const onSave = vi.fn().mockResolvedValue({ success: true });

    render(
      <FeedbackModal
        {...defaultProps}
        viewMode="nexus"
        projectId="Q3 Planning"
        lastAction="Przeglądanie notatki: Q3 Plan"
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByTitle('Przekaż pomysł'));

    // Verify project context
    expect(screen.getByText('Q3 Planning')).toBeInTheDocument();

    // Fill and save
    fireEvent.change(screen.getByPlaceholderText('Krótki tytuł zgłoszenia'), {
      target: { value: 'Tytuł' },
    });
    fireEvent.change(screen.getByPlaceholderText('Opisz czego dotyczy zgłoszenie...'), {
      target: { value: 'Opis' },
    });

    fireEvent.click(screen.getByText('Zapisz'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const saved = onSave.mock.calls[0][0];
    expect(saved.contextSnapshot.projectId).toBe('Q3 Planning');
    expect(saved.contextSnapshot.viewMode).toBe('nexus');
  });
});
