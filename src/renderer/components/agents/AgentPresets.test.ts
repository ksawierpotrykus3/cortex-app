// ============================================================================
// NEXUS — AgentPresets: Tests (#24 — 12 presetów)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { AGENT_PRESETS, AgentPreset } from './AgentPresets';

// Mock crypto.randomUUID for deterministic IDs
import { vi } from 'vitest';
vi.stubGlobal('crypto', {
  randomUUID: () => '00000000-0000-0000-0000-000000000000',
});

describe('AGENT_PRESETS', () => {
  // ------------------------------------------------------------------
  // Test 1: Eksportuje dokładnie 12 presetów (#24)
  // ------------------------------------------------------------------
  it('eksportuje dokładnie 13 presetów (#27 Playwright)', () => {
    expect(AGENT_PRESETS).toHaveLength(13);
  });

  // ------------------------------------------------------------------
  // Test 2: Każdy preset ma wymagane pola
  // ------------------------------------------------------------------
  it('każdy preset ma id, name, description, icon', () => {
    AGENT_PRESETS.forEach((preset: AgentPreset) => {
      expect(preset.id).toBeDefined();
      expect(typeof preset.id).toBe('string');
      expect(preset.name).toBeDefined();
      expect(typeof preset.name).toBe('string');
      expect(preset.description).toBeDefined();
      expect(typeof preset.description).toBe('string');
      expect(preset.icon).toBeDefined();
      expect(typeof preset.icon).toBe('string');
    });
  });

  // ------------------------------------------------------------------
  // Test 3: create() zwraca obiekt Agent z wypełnionymi polami
  // ------------------------------------------------------------------
  it('create() zwraca obiekt Agent z wymaganymi polami', () => {
    AGENT_PRESETS.forEach((preset: AgentPreset) => {
      const agent = preset.create();

      expect(agent.id).toBeDefined();
      expect(agent.name).toBe(preset.name);
      expect(agent.status).toBe('ACTIVE');
      expect(agent.promptTemplate).toBeDefined();
      expect(typeof agent.promptTemplate).toBe('string');
      expect(agent.trigger).toBeDefined();
      expect(agent.model).toBeDefined();
      expect(agent.model.provider).toBeDefined();
      expect(agent.model.modelName).toBe('gemini-2.0-flash');
    });
  });

  // ------------------------------------------------------------------
  // Test 4: Każdy preset ma unikalny hotkey
  // ------------------------------------------------------------------
  it('każdy preset ma unikalny hotkey (#24)', () => {
    const hotkeys = AGENT_PRESETS.map((p) => p.create().trigger.hotkey);
    const uniqueHotkeys = new Set(hotkeys);
    expect(uniqueHotkeys.size).toBe(hotkeys.length);
  });

  // ------------------------------------------------------------------
  // Test 5: Nowe presety mają poprawne hotkeye (#24)
  // ------------------------------------------------------------------
  it('Translator ma hotkey Ctrl+Shift+T', () => {
    const preset = AGENT_PRESETS.find((p) => p.id === 'translator')!;
    expect(preset.create().trigger.hotkey).toBe('Ctrl+Shift+T');
  });

  it('Researcher ma hotkey Ctrl+Shift+R', () => {
    const preset = AGENT_PRESETS.find((p) => p.id === 'researcher')!;
    expect(preset.create().trigger.hotkey).toBe('Ctrl+Shift+R');
  });

  it('Code Reviewer ma hotkey Ctrl+Shift+Q', () => {
    const preset = AGENT_PRESETS.find((p) => p.id === 'code-reviewer')!;
    expect(preset.create().trigger.hotkey).toBe('Ctrl+Shift+Q');
  });

  it('Code Generator ma hotkey Ctrl+Shift+G', () => {
    const preset = AGENT_PRESETS.find((p) => p.id === 'code-generator')!;
    expect(preset.create().trigger.hotkey).toBe('Ctrl+Shift+G');
  });

  it('Debugger ma hotkey Ctrl+Shift+D', () => {
    const preset = AGENT_PRESETS.find((p) => p.id === 'debugger')!;
    expect(preset.create().trigger.hotkey).toBe('Ctrl+Shift+D');
  });

  it('Redaktor ma hotkey Ctrl+Shift+E', () => {
    const preset = AGENT_PRESETS.find((p) => p.id === 'editor')!;
    expect(preset.create().trigger.hotkey).toBe('Ctrl+Shift+E');
  });

  it('Formatter ma hotkey Ctrl+Shift+F', () => {
    const preset = AGENT_PRESETS.find((p) => p.id === 'formatter')!;
    expect(preset.create().trigger.hotkey).toBe('Ctrl+Shift+F');
  });

  it('Nauczyciel ma hotkey Ctrl+Shift+H', () => {
    const preset = AGENT_PRESETS.find((p) => p.id === 'teacher')!;
    expect(preset.create().trigger.hotkey).toBe('Ctrl+Shift+H');
  });

  // ------------------------------------------------------------------
  // Test 6: Istniejące presety — szczegółowe wartości
  // ------------------------------------------------------------------
  it('Streszczacz ma temperature = 0.3', () => {
    const preset = AGENT_PRESETS.find((p) => p.id === 'summarizer')!;
    const agent = preset.create();
    expect(agent.model.temperature).toBe(0.3);
  });

  it('Brainstormer ma temperature = 0.9', () => {
    const preset = AGENT_PRESETS.find((p) => p.id === 'brainstormer')!;
    const agent = preset.create();
    expect(agent.model.temperature).toBe(0.9);
  });

  it('Analityk ma maxTokens = 8192', () => {
    const preset = AGENT_PRESETS.find((p) => p.id === 'analyst')!;
    const agent = preset.create();
    expect(agent.model.maxTokens).toBe(8192);
  });

  // ------------------------------------------------------------------
  // Test 7: Presety z contextConfig mają prekonfigurowane źródła (#24)
  // ------------------------------------------------------------------
  it('Researcher ma włączone źródła: notes, history', () => {
    const preset = AGENT_PRESETS.find((p) => p.id === 'researcher')!;
    const agent = preset.create();
    expect(agent.contextConfig).toBeDefined();
    const enabledSources = agent.contextConfig!.sources.filter(s => s.enabled).map(s => s.id);
    expect(enabledSources).toContain('notes');
    expect(enabledSources).toContain('history');
  });

  it('Nauczyciel ma włączone źródła: notes, history, changelog', () => {
    const preset = AGENT_PRESETS.find((p) => p.id === 'teacher')!;
    const agent = preset.create();
    expect(agent.contextConfig).toBeDefined();
    const enabledSources = agent.contextConfig!.sources.filter(s => s.enabled).map(s => s.id);
    expect(enabledSources).toContain('notes');
    expect(enabledSources).toContain('history');
    expect(enabledSources).toContain('changelog');
  });
});
