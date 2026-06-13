// @vitest-environment jsdom
// ============================================================================
// NEXUS — PipelineEditor Tests (F6.12)
// ============================================================================

import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import '@testing-library/jest-dom/vitest';
import { PipelineEditor } from './PipelineEditor';
import { Pipeline } from '../shared/types/schema';

function createPipeline(overrides: Partial<Pipeline> = {}): Pipeline {
  const now = new Date().toISOString();
  return {
    id: 'pipe-1',
    name: 'Test pipeline',
    description: 'Opis testowy',
    nodes: [],
    connections: [],
    createdAt: now,
    updatedAt: now,
    isHeadless: false,
    ...overrides,
  };
}

describe('PipelineEditor', () => {
  afterEach(() => {
    cleanup();
  });

  // ------------------------------------------------------------------
  // Test 1: Pokazuje pustą listę
  // ------------------------------------------------------------------
  it('pokazuje komunikat o braku pipeline\'ów gdy lista pusta', () => {
    render(
      <PipelineEditor
        pipelines={[]}
        onSavePipeline={vi.fn()}
        onDeletePipeline={vi.fn()}
        onExecutePipeline={vi.fn()}
        runningPipelineId={null}
      />
    );

    expect(screen.getByText('Brak pipeline\'ów')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // Test 2: Wyświetla pipeline na liście
  // ------------------------------------------------------------------
  it('wyświetla pipeline na liście', () => {
    const pipelines = [createPipeline({ name: 'Mój pipeline' })];

    render(
      <PipelineEditor
        pipelines={pipelines}
        onSavePipeline={vi.fn()}
        onDeletePipeline={vi.fn()}
        onExecutePipeline={vi.fn()}
        runningPipelineId={null}
      />
    );

    expect(screen.getByText('Mój pipeline')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // Test 3: Tworzy nowy pipeline przez przycisk
  // ------------------------------------------------------------------
  it('wywołuje onSavePipeline po kliknięciu "Nowy pipeline"', () => {
    const onSave = vi.fn();
    render(
      <PipelineEditor
        pipelines={[]}
        onSavePipeline={onSave}
        onDeletePipeline={vi.fn()}
        onExecutePipeline={vi.fn()}
        runningPipelineId={null}
      />
    );

    fireEvent.click(screen.getByText('Nowy pipeline'));
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as Pipeline;
    expect(saved.name).toBe('Nowy pipeline');
    expect(saved.nodes).toEqual([]);
  });

  // ------------------------------------------------------------------
  // Test 4: Wyświetla stan pustego edytora
  // ------------------------------------------------------------------
  it('pokazuje placeholder gdy żaden pipeline nie wybrany', () => {
    render(
      <PipelineEditor
        pipelines={[]}
        onSavePipeline={vi.fn()}
        onDeletePipeline={vi.fn()}
        onExecutePipeline={vi.fn()}
        runningPipelineId={null}
      />
    );

    expect(screen.getByText(/Wybierz pipeline z listy/)).toBeInTheDocument();
  });
});
