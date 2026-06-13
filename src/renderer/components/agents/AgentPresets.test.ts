// @vitest-environment node
// ================================================================
// NEXUS — AgentPresets: Tests
// ================================================================

import { describe, it, expect } from 'vitest';
import { AGENT_PRESETS, AgentPreset } from './AgentPresets';

// Mock crypto.randomUUID for deterministic IDs
import { vi } from 'vitest';
vi.stubGlobal('crypto', {
  randomUUID: () => '00000000-0000-0000-0000-000000000000',
});

describe('AGENT_PRESETS', () => {
  // ------------------------------------------------------------------
  // Test 1: Eksportuje dokładnie 4 presety
  // ------------------------------------------------------------------
  it('eksportuje dokładnie 4 presety', () => {
    expect(AGENT_PRESETS).toHaveLength(4);
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
  // Test 4: Streszczacz ma trigger.hotkey = 'Ctrl+Shift+S'
  // ------------------------------------------------------------------
  it('Streszczacz ma hotkey Ctrl+Shift+S', () => {
    const preset = AGENT_PRESETS.find((p) => p.id === 'summarizer')!;
    const agent = preset.create();
    expect(agent.trigger.hotkey).toBe('Ctrl+Shift+S');
  });

  // ------------------------------------------------------------------
  // Test 5: Korektor ma trigger.hotkey = 'Ctrl+Shift+K'
  // ------------------------------------------------------------------
  it('Korektor ma hotkey Ctrl+Shift+K', () => {
    const preset = AGENT_PRESETS.find((p) => p.id === 'proofreader')!;
    const agent = preset.create();
    expect(agent.trigger.hotkey).toBe('Ctrl+Shift+K');
  });

  // ------------------------------------------------------------------
  // Test 6: Brainstormer ma temperature = 0.9
  // ------------------------------------------------------------------
  it('Brainstormer ma temperature = 0.9', () => {
    const preset = AGENT_PRESETS.find((p) => p.id === 'brainstormer')!;
    const agent = preset.create();
    expect(agent.model.temperature).toBe(0.9);
  });

  // ------------------------------------------------------------------
  // Test 7: Analityk ma maxTokens = 8192
  // ------------------------------------------------------------------
  it('Analityk ma maxTokens = 8192', () => {
    const preset = AGENT_PRESETS.find((p) => p.id === 'analyst')!;
    const agent = preset.create();
    expect(agent.model.maxTokens).toBe(8192);
  });
});
