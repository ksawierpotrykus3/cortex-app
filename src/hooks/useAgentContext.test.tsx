// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { useAgentContext } from './useAgentContext';

describe('useAgentContext', () => {
  const defaultOptions = {
    viewMode: 'nexus' as any,
    selectedNodeId: null,
    selectedAgentId: null,
    selectedTaskId: null,
    selectedManuscriptId: null,
    projectId: null,
    lastAction: 'Widok: nexus',
  };

  it('zwraca odpowiednie pola: contextLabel, selectedText, clipboardContent', () => {
    const { result } = renderHook(() => useAgentContext(defaultOptions));

    expect(result.current).toHaveProperty('contextLabel');
    expect(result.current).toHaveProperty('selectedText');
    expect(result.current).toHaveProperty('clipboardContent');
    expect(typeof result.current.contextLabel).toBe('string');
    expect(typeof result.current.selectedText).toBe('string');
    expect(typeof result.current.clipboardContent).toBe('string');
  });

  it('contextLabel zmienia sie gdy zmienia sie viewMode', () => {
    const { result, rerender } = renderHook(
      (opts) => useAgentContext(opts),
      { initialProps: defaultOptions }
    );

    // Dla 'nexus' -> 'Mapa mysli'
    expect(result.current.contextLabel).toContain('Mapa myśli');

    // Zmiana viewMode na 'git'
    rerender({
      ...defaultOptions,
      viewMode: 'git' as any,
      lastAction: 'Widok: git',
    });

    expect(result.current.contextLabel).toContain('Git');
  });

  it('selectedText jest pusty gdy nie ma zaznaczenia', () => {
    const { result } = renderHook(() => useAgentContext(defaultOptions));
    expect(result.current.selectedText).toBe('');
  });
});
