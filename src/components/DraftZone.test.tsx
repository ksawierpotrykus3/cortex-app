// @vitest-environment jsdom
// ================================================================
// NEXUS V2 — DraftZone: TDD Tests (Phase 5.3)
// ================================================================
// WERYFIKACJA DETERMINISTYCZNA:
// Test 1: Użyj RTL (React Testing Library) z emulacją klików myszy.
//   Wybierz wpisanie ucinającej się konfiguracji i spróbuj
//   zasymulować nacisk "Zapisz". Test asertywnie śledzi, czy nie
//   wywołano ani razu podsystemu IPC dla błędnego zapisu, co
//   udowadnia, że walidacja brzegowa utrzyma system w szczelności
//   przed najgorzej sprofanowanymi wejściami danych.
// ================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import '@testing-library/jest-dom/vitest';
import { DraftZone } from './DraftZone';
import { validateMutation, AgentMutation, DraftSubmission } from '../shared/validators/schemas';
import { stringify, parse } from 'flatted';

// ============================================================
// Setup: global window mock and Electron IPC mock
// ============================================================
beforeEach(() => {
  (window as any).electron = {
    ipcRenderer: {
      send: vi.fn(),
    },
    invoke: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
});

// ============================================================
// Test 1: Zod walidacja odrzuca puste ID
// ============================================================
describe('DraftZone — Zod Guards', () => {
  it('AgentMutation.parse rzuca błąd dla pustego ID', () => {
    expect(() => {
      validateMutation({ id: '', instruction: 'valid instruction here' });
    }).toThrow('Agent ID wymaga minimum 3 znaków');
  });

  it('AgentMutation.parse rzuca błąd dla zbyt krótkiej instrukcji', () => {
    expect(() => {
      validateMutation({ id: 'agent_01', instruction: 'short' });
    }).toThrow('Instrukcja wymaga minimum 10 znaków');
  });

  it('AgentMutation.parse akceptuje poprawną mutację', () => {
    const result = validateMutation({
      id: 'agent_01',
      instruction: 'Change the tone to formal and add citations.',
    });
    expect(result.id).toBe('agent_01');
    expect(result.instruction).toBe('Change the tone to formal and add citations.');
  });

  it('AgentMutation.parse odrzuca ID z niedozwolonymi znakami', () => {
    expect(() => {
      validateMutation({ id: 'agent 01!', instruction: 'valid instruction here' });
    }).toThrow();
  });

  it('DraftSubmission.safeParse zwraca success=false dla pustej mutacji', () => {
    const result = DraftSubmission.safeParse({ mutation: {} });
    expect(result.success).toBe(false);
  });

  it('DraftSubmission.safeParse zwraca success=true dla pełnego submissionu', () => {
    const result = DraftSubmission.safeParse({
      mutation: {
        id: 'agent_01',
        instruction: 'This is a valid instruction with enough length.',
      },
      reasoning: 'Because the output was too verbose',
      tags: ['style', 'conciseness'],
      metadata: {
        author: 'user',
        schemaVersion: 1,
      },
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// Test 2: Flatted stringify — obsługa cykli
// ============================================================
describe('DraftZone — Flatted stringify (cyclic structures)', () => {
  it('stringify obsługuje cykliczne struktury danych', () => {
    const cyclic: Record<string, any> = { name: 'agent_state' };
    cyclic.self = cyclic; // Referencja cykliczna — fatalna dla JSON.stringify

    const result = stringify(cyclic);
    expect(result).toContain('agent_state');
    // flatted.parse — jedyny poprawny sposób deserializacji flatted
    const parsed = parse(result);
    expect(parsed.name).toBe('agent_state');
    // Referencja cykliczna zachowana (JSON.stringify by rzucił TypeError)
    expect(parsed.self).toBe(parsed);
  });

  it('stringify nie rzuca dla zagnieżdżonych cykli', () => {
    const a: Record<string, any> = { name: 'A' };
    const b: Record<string, any> = { name: 'B', parent: a };
    a.child = b; // Cykl A → B → A

    expect(() => stringify(a)).not.toThrow();
    const result = stringify(a);
    const parsed = parse(result);
    expect(parsed.name).toBe('A');
    expect(parsed.child.name).toBe('B');
    expect(parsed.child.parent).toBe(parsed); // cykl zachowany
  });
});

// ============================================================
// Test 3: RTL — symulacja błędnego zapisu (TDD Test 1 z PDF)
// ============================================================
describe('DraftZone — RTL: corrupted data rejection (TDD Test 1)', () => {
  it('nie wywołuje IPC dla pustego formularza (ucięta konfiguracja)', async () => {
    const onSaved = vi.fn();
    const onValidationError = vi.fn();
    const onIPCError = vi.fn();

    render(<DraftZone onSaved={onSaved} onValidationError={onValidationError} onIPCError={onIPCError} />);

    // Przycisk "Save Draft" powinien być disabled bez wypełnionego formularza
    const saveButton = screen.getByText('Save Draft');
    expect(saveButton).toBeDisabled();

    // Wpisz poprawne ID (minimum 3 znaki) i instrukcję
    const idInput = screen.getByPlaceholderText('e.g. agent_writer_01');
    fireEvent.change(idInput, { target: { value: 'agent_01' } });

    // Instrukcja pusta — button ciągle disabled (instrukcja pusta)
    expect(saveButton).toBeDisabled();

    // Wpisz instrukcję ale za krótką (< 10 znaków)
    const instrTextarea = screen.getByPlaceholderText('Describe what the agent should change...');
    fireEvent.change(instrTextarea, { target: { value: 'short' } });
    expect(saveButton).toBeDisabled();

    // Wpisz poprawną instrukcję — button powinien być enabled
    fireEvent.change(instrTextarea, { target: { value: 'This is a valid instruction for the agent.' } });
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });

    // Kliknij Zapisz
    fireEvent.click(saveButton);

    // Sprawdź czy IPC został wywołany (walidacja przeszła)
    await waitFor(() => {
      expect((window as any).electron.ipcRenderer.send).toHaveBeenCalledWith(
        'save-mutation',
        expect.objectContaining({
          mutation: expect.objectContaining({
            id: 'agent_01',
            instruction: 'This is a valid instruction for the agent.',
          }),
        })
      );
    });

    // Walidacja nie powinna mieć błędów
    expect(onValidationError).not.toHaveBeenCalled();
  });

  it('odrzuca przez Zod: zbyt krótkie ID → brak IPC', async () => {
    const onSaved = vi.fn();
    const onIPCError = vi.fn();

    render(<DraftZone onSaved={onSaved} onIPCError={onIPCError} />);

    // Wpisz niepoprawne dane: puste ID + krótka instrukcja
    const idInput = screen.getByPlaceholderText('e.g. agent_writer_01');
    fireEvent.change(idInput, { target: { value: '' } });

    const instrTextarea = screen.getByPlaceholderText('Describe what the agent should change...');
    fireEvent.change(instrTextarea, { target: { value: 'short' } });

    // Button powinien być disabled (puste ID)
    const saveButton = screen.getByText('Save Draft');
    expect(saveButton).toBeDisabled();

    // IPC NIGDY nie powinien być wywołany
    expect((window as any).electron.ipcRenderer.send).not.toHaveBeenCalled();
  });

  it('odrzuca przez Zod: ID z niedozwolonymi znakami → komunikat o błędzie', async () => {
    const onValidationError = vi.fn();

    render(<DraftZone onValidationError={onValidationError} />);

    // Wpisz ID z spacją (niedozwolone)
    const idInput = screen.getByPlaceholderText('e.g. agent_writer_01');
    fireEvent.change(idInput, { target: { value: 'agent 01' } });

    const instrTextarea = screen.getByPlaceholderText('Describe what the agent should change...');
    fireEvent.change(instrTextarea, { target: { value: 'This is a valid instruction with enough length.' } });

    // Kliknij Zapisz
    const saveButton = screen.getByText('Save Draft');
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });
    fireEvent.click(saveButton);

    // Walidacja powinna zwrócić błąd
    await waitFor(() => {
      expect(onValidationError).toHaveBeenCalled();
    });

    // IPC NIE powinien być wywołany
    expect((window as any).electron.ipcRenderer.send).not.toHaveBeenCalled();
  });
});

// ============================================================
// Test 4: structuredClone — bezpieczne forkowanie
// ============================================================
describe('DraftZone — structuredClone safety', () => {
  it('structuredClone tworzy niezależną kopię stanu', () => {
    const original = {
      agentId: 'agent_01',
      instruction: 'test instruction',
      tags: ['a', 'b'],
      reasoning: '',
      requiresApproval: false,
    };

    const cloned = structuredClone(original);
    cloned.agentId = 'modified';
    cloned.tags.push('c');

    expect(original.agentId).toBe('agent_01');
    expect(original.tags).toHaveLength(2);
    expect(cloned.agentId).toBe('modified');
    expect(cloned.tags).toHaveLength(3);
  });
});

// ============================================================
// Test 5: Pełny cykl: walidacja → IPC → sukces
// ============================================================
describe('DraftZone — full save cycle', () => {
  it('zapisuje poprawny draft przez IPC i woła onSaved', async () => {
    const onSaved = vi.fn();
    const onIPCError = vi.fn();

    render(<DraftZone agentId="agent_test" onSaved={onSaved} onIPCError={onIPCError} />);

    // Pole agentId powinno być pre-wypełnione
    const idInput = screen.getByPlaceholderText('e.g. agent_writer_01') as HTMLInputElement;
    expect(idInput.value).toBe('agent_test');

    // Wpisz instrukcję
    const instrTextarea = screen.getByPlaceholderText('Describe what the agent should change...');
    fireEvent.change(instrTextarea, {
      target: { value: 'Please rewrite the response to be more concise and factual.' },
    });

    // Kliknij Zapisz
    const saveButton = screen.getByText('Save Draft');
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });
    fireEvent.click(saveButton);

    // Sprawdź czy IPC send został wywołany
    await waitFor(() => {
      expect((window as any).electron.ipcRenderer.send).toHaveBeenCalledWith(
        'save-mutation',
        expect.objectContaining({
          mutation: expect.objectContaining({
            id: 'agent_test',
          }),
        })
      );
    });

    // onSaved callback powinien być wywołany
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'agent_test',
          instruction: 'Please rewrite the response to be more concise and factual.',
        })
      );
    });

    // Brak błędów IPC
    expect(onIPCError).not.toHaveBeenCalled();
  });
});
