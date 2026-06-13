// @vitest-environment jsdom
// ============================================================================
// NEXUS — PermissionPanel Tests
// ============================================================================

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PermissionPanel } from './PermissionPanel';
import {
  PermissionSet,
  DEFAULT_PERMISSION_SET,
  TriggerType,
  OutputDestinationType,
} from '../../../shared/types/schema';

describe('PermissionPanel', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  // === Happy Path ==========================================================
  it('renders all trigger types with labels', () => {
    render(<PermissionPanel value={DEFAULT_PERMISSION_SET} onChange={vi.fn()} />);

    expect(screen.getByText('Ręczne (Manual)')).toBeTruthy();
    expect(screen.getByText('Skrót klawiszowy (Hotkey)')).toBeTruthy();
    const schowekButtons = screen.getAllByText('Schowek (Clipboard)');
    expect(schowekButtons.length).toBe(2); // one in triggers, one in destinations
    expect(screen.getByText('Output innego agenta')).toBeTruthy();
    const webhookButtons = screen.getAllByText('Webhook');
    expect(webhookButtons.length).toBe(2); // one in triggers, one in destinations
  });

  it('toggles a trigger on click', () => {
    const onChange = vi.fn();
    const perms: PermissionSet = { ...DEFAULT_PERMISSION_SET, allowedTriggers: [] };

    render(<PermissionPanel value={perms} onChange={onChange} />);

    fireEvent.click(screen.getByText('Ręczne (Manual)'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const newPerms = onChange.mock.calls[0][0] as PermissionSet;
    expect(newPerms.allowedTriggers).toContain(TriggerType.MANUAL);
  });

  it('removes trigger on second click', () => {
    const onChange = vi.fn();
    const perms: PermissionSet = {
      ...DEFAULT_PERMISSION_SET,
      allowedTriggers: [TriggerType.MANUAL],
    };

    render(<PermissionPanel value={perms} onChange={onChange} />);

    fireEvent.click(screen.getByText('Ręczne (Manual)'));

    const newPerms = onChange.mock.calls[0][0] as PermissionSet;
    expect(newPerms.allowedTriggers).not.toContain(TriggerType.MANUAL);
  });

  it('shows warning badge when no triggers allowed', () => {
    const perms: PermissionSet = { ...DEFAULT_PERMISSION_SET, allowedTriggers: [] };
    render(<PermissionPanel value={perms} onChange={vi.fn()} />);

    expect(screen.getByText(/Brak — agent nie może być uruchomiony/)).toBeTruthy();
  });

  // === Allowed Models ======================================================
  it('renders available models with toggle buttons', () => {
    const models = [
      { label: 'Google Gemini → gemini-2.0-flash', modelName: 'gemini-2.0-flash', providerLabel: 'Google Gemini' },
      { label: 'Google Gemini → gemini-1.5-pro', modelName: 'gemini-1.5-pro', providerLabel: 'Google Gemini' },
    ];

    render(<PermissionPanel value={DEFAULT_PERMISSION_SET} onChange={vi.fn()} availableModels={models} />);

    expect(screen.getByText('gemini-2.0-flash')).toBeTruthy();
    expect(screen.getByText('gemini-1.5-pro')).toBeTruthy();
  });

  it('toggles a model on click', () => {
    const onChange = vi.fn();
    const models = [
      { label: 'Test → test-model', modelName: 'test-model', providerLabel: 'Test' },
    ];

    render(<PermissionPanel value={DEFAULT_PERMISSION_SET} onChange={onChange} availableModels={models} />);

    fireEvent.click(screen.getByText('test-model'));

    const newPerms = onChange.mock.calls[0][0] as PermissionSet;
    expect(newPerms.allowedModels).toContain('test-model');
  });

  it('allows adding custom model via input', () => {
    const onChange = vi.fn();

    render(<PermissionPanel value={DEFAULT_PERMISSION_SET} onChange={onChange} />);

    const input = screen.getByPlaceholderText(/Wpisz własny model/);
    fireEvent.change(input, { target: { value: 'custom-model-123' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const newPerms = onChange.mock.calls[0][0] as PermissionSet;
    expect(newPerms.allowedModels).toContain('custom-model-123');
  });

  // === Allowed Destinations ================================================
  it('renders all destination types', () => {
    render(<PermissionPanel value={DEFAULT_PERMISSION_SET} onChange={vi.fn()} />);

    expect(screen.getByText('Changelog')).toBeTruthy();
    expect(screen.getByText('Plik (File)')).toBeTruthy();
    expect(screen.getByText('Inny agent')).toBeTruthy();
    expect(screen.getByText('Baza Wiedzy')).toBeTruthy();
  });

  it('toggles a destination on click', () => {
    const onChange = vi.fn();
    const perms: PermissionSet = { ...DEFAULT_PERMISSION_SET, allowedDestinations: [] };

    render(<PermissionPanel value={perms} onChange={onChange} />);

    fireEvent.click(screen.getByText('Changelog'));

    const newPerms = onChange.mock.calls[0][0] as PermissionSet;
    expect(newPerms.allowedDestinations).toContain(OutputDestinationType.CHANGELOG);
  });

  // === Limits ==============================================================
  it('renders maxTokensPerRun input', () => {
    render(<PermissionPanel value={DEFAULT_PERMISSION_SET} onChange={vi.fn()} />);

    expect(screen.getByText('Max tokenów / uruchomienie')).toBeTruthy();
  });

  it('renders maxRunsPerMinute input', () => {
    render(<PermissionPanel value={DEFAULT_PERMISSION_SET} onChange={vi.fn()} />);

    expect(screen.getByText('Max uruchomień / minutę')).toBeTruthy();
  });

  // === Toggles =============================================================
  it('toggles requireApproval', () => {
    const onChange = vi.fn();
    render(<PermissionPanel value={DEFAULT_PERMISSION_SET} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Przełącz wymagaj akceptacji outputu'));

    const newPerms = onChange.mock.calls[0][0] as PermissionSet;
    expect(newPerms.requireApproval).toBe(true);
  });

  it('toggles gitAccess', () => {
    const onChange = vi.fn();
    render(<PermissionPanel value={DEFAULT_PERMISSION_SET} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Przełącz Git Access'));

    const newPerms = onChange.mock.calls[0][0] as PermissionSet;
    expect(newPerms.gitAccess).toBe(true);
  });

  it('toggles gitWrite', () => {
    const onChange = vi.fn();
    render(<PermissionPanel value={DEFAULT_PERMISSION_SET} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Przełącz Git Write'));

    const newPerms = onChange.mock.calls[0][0] as PermissionSet;
    expect(newPerms.gitWrite).toBe(true);
  });

  // === Edge Cases ==========================================================
  it('uses DEFAULT_PERMISSION_SET when value is undefined', () => {
    render(<PermissionPanel onChange={vi.fn()} />);

    // Default has no triggers, so warning should show
    expect(screen.getByText(/Brak — agent nie może być uruchomiony/)).toBeTruthy();
  });

  it('shows message when no triggers added', () => {
    const perms: PermissionSet = { ...DEFAULT_PERMISSION_SET, allowedTriggers: [] };
    render(<PermissionPanel value={perms} onChange={vi.fn()} />);

    expect(screen.getByText(/Dodaj co najmniej jeden trigger/)).toBeTruthy();
  });

  it('displays previously added model tags with remove button', () => {
    const perms: PermissionSet = {
      ...DEFAULT_PERMISSION_SET,
      allowedModels: ['gemini-2.0-flash', 'custom-model'],
    };

    render(<PermissionPanel value={perms} onChange={vi.fn()} />);

    expect(screen.getByText('gemini-2.0-flash')).toBeTruthy();
    expect(screen.getByText('custom-model')).toBeTruthy();

    // Remove buttons should be present
    const removeButtons = screen.getAllByText('×');
    expect(removeButtons.length).toBe(2);
  });

  it('deduplicates models from availableModels', () => {
    const models = [
      { label: 'A → m1', modelName: 'm1', providerLabel: 'A' },
      { label: 'B → m1', modelName: 'm1', providerLabel: 'B' },
      { label: 'C → m2', modelName: 'm2', providerLabel: 'C' },
    ];

    render(<PermissionPanel value={DEFAULT_PERMISSION_SET} onChange={vi.fn()} availableModels={models} />);

    // m1 should appear only once
    const m1Buttons = screen.getAllByText('m1');
    expect(m1Buttons.length).toBe(1);
  });

  // === Error Case ==========================================================
  it('does not crash with null value', () => {
    render(<PermissionPanel value={null as unknown as PermissionSet} onChange={vi.fn()} />);

    // Should use DEFAULT_PERMISSION_SET as fallback
    expect(screen.getByText(/Brak — agent nie może być uruchomiony/)).toBeTruthy();
  });
});
