// ============================================================================
// NEXUS — WorkflowEngine Tests (#1)
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEngine } from './WorkflowEngine';
import {
  WorkflowDefinition,
  ConditionGroup,
  WorkflowAction,
} from '../../shared/types/workflow';
import { TriggerType, AgentOutput, Agent } from '../../shared/types/schema';

function createMockAgent(): any {
  return {
    id: 'agent-1',
    name: 'Test Agent',
    promptTemplate: 'Test prompt {{SCHOWEK}}',
    model: { provider: 'GEMINI', modelName: 'gemini-2.0-flash', temperature: 0.3, maxTokens: 2048, topP: 0.9 },
    status: 'ACTIVE',
  };
}

function createMockOutput(): any {
  return {
    id: 'output-1',
    agentId: 'agent-1',
    agentName: 'Test Agent',
    content: 'Test output content',
    tokensUsed: 150,
    executionMs: 500,
    rating: 8,
    approved: true,
    status: 'ACTIVE',
    triggerType: 'MANUAL',
    modelName: 'gemini-2.0-flash',
    tags: [],
    createdAt: new Date().toISOString(),
  };
}

function createMockOrchestrator() {
  return {
    getAgent: vi.fn().mockReturnValue(createMockAgent()),
    executeAgent: vi.fn().mockResolvedValue(createMockOutput()),
    buildContext: vi.fn().mockResolvedValue({ context: '', tokensUsed: 0 }),
    updateAgentStatus: vi.fn(),
    registerAgent: vi.fn(),
    getAgents: vi.fn().mockReturnValue([]),
  };
}

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;
  let orchestrator: ReturnType<typeof createMockOrchestrator>;

  beforeEach(() => {
    orchestrator = createMockOrchestrator();
    engine = new WorkflowEngine(orchestrator as any);
  });

  // ------------------------------------------------------------------
  // Test 1: evaluateTriggers — manual
  // ------------------------------------------------------------------
  it('zwraca workflow z triggerem manual', () => {
    const workflow: WorkflowDefinition = {
      id: 'wf-1',
      name: 'Test WF',
      description: '',
      mode: 'sandbox',
      trigger: { type: 'manual' },
      conditions: null,
      actions: [],
      createdAt: '',
      updatedAt: '',
      runCount: 0,
      lastRunAt: null,
    };

    const matched = engine.evaluateTriggers({ type: 'manual', agentId: 'agent-1' }, [workflow]);
    expect(matched).toHaveLength(1);
    expect(matched[0].id).toBe('wf-1');
  });

  // ------------------------------------------------------------------
  // Test 2: evaluateTriggers — on_approve z agentId
  // ------------------------------------------------------------------
  it('zwraca workflow po approve gdy agentId pasuje', () => {
    const workflow: WorkflowDefinition = {
      id: 'wf-1',
      name: 'Test WF',
      description: '',
      mode: 'sandbox',
      trigger: { type: 'on_approve' },
      conditions: null,
      actions: [],
      agentId: 'agent-1',
      createdAt: '',
      updatedAt: '',
      runCount: 0,
      lastRunAt: null,
    };

    const matched = engine.evaluateTriggers({ type: 'on_approve', agentId: 'agent-1' }, [workflow]);
    expect(matched).toHaveLength(1);
  });

  // ------------------------------------------------------------------
  // Test 3: evaluateTriggers — nie pasuje agentId
  // ------------------------------------------------------------------
  it('nie zwraca workflow gdy agentId nie pasuje', () => {
    const workflow: WorkflowDefinition = {
      id: 'wf-1',
      name: 'Test WF',
      description: '',
      mode: 'sandbox',
      trigger: { type: 'on_approve' },
      conditions: null,
      actions: [],
      agentId: 'agent-1',
      createdAt: '',
      updatedAt: '',
      runCount: 0,
      lastRunAt: null,
    };

    const matched = engine.evaluateTriggers({ type: 'on_approve', agentId: 'agent-2' }, [workflow]);
    expect(matched).toHaveLength(0);
  });

  // ------------------------------------------------------------------
  // Test 4: evaluateConditions — AND
  // ------------------------------------------------------------------
  it('ewaluuje AND: rating > 7 AND approved === true', () => {
    const group: ConditionGroup = {
      id: 'g1',
      logic: 'and',
      conditions: [
        { id: 'c1', source: { type: 'output_field', field: 'rating' }, operator: 'gte', value: 6 },
        { id: 'c2', source: { type: 'output_field', field: 'approved' }, operator: 'eq', value: true },
      ],
    };

    const result = engine.evaluateConditions(group, {
      output: createMockOutput(),
      agent: createMockAgent(),
      workflow: { id: '', name: '', description: '', mode: 'sandbox', trigger: { type: 'manual' }, conditions: null, actions: [], createdAt: '', updatedAt: '', runCount: 0, lastRunAt: null },
    });
    expect(result).toBe(true);
  });

  // ------------------------------------------------------------------
  // Test 5: evaluateConditions — OR (jeden false)
  // ------------------------------------------------------------------
  it('ewaluuje OR: rating > 10 OR approved === false — oba false', () => {
    const group: ConditionGroup = {
      id: 'g1',
      logic: 'or',
      conditions: [
        { id: 'c1', source: { type: 'output_field', field: 'rating' }, operator: 'gt', value: 10 },
        { id: 'c2', source: { type: 'output_field', field: 'approved' }, operator: 'eq', value: false },
      ],
    };

    const result = engine.evaluateConditions(group, {
      output: createMockOutput(),
      agent: createMockAgent(),
      workflow: { id: '', name: '', description: '', mode: 'sandbox', trigger: { type: 'manual' }, conditions: null, actions: [], createdAt: '', updatedAt: '', runCount: 0, lastRunAt: null },
    });
    expect(result).toBe(false);
  });

  // ------------------------------------------------------------------
  // Test 6: renderTemplate — podstawowe zmienne
  // ------------------------------------------------------------------
  it('renderuje szablon z {{output.content}}', () => {
    const output = createMockOutput();
    output.content = 'Hello World';

    const rendered = engine.renderTemplate('Content: {{output.content}}', {
      output,
      agent: createMockAgent(),
      workflow: { id: '', name: '', description: '', mode: 'sandbox', trigger: { type: 'manual' }, conditions: null, actions: [], createdAt: '', updatedAt: '', runCount: 0, lastRunAt: null },
    });
    expect(rendered).toBe('Content: Hello World');
  });

  // ------------------------------------------------------------------
  // Test 7: renderTemplate — funkcje
  // ------------------------------------------------------------------
  it('renderuje szablon z funkcją uppercase', () => {
    const rendered = engine.renderTemplate('{{uppercase("test")}}', {
      output: createMockOutput(),
      agent: createMockAgent(),
      workflow: { id: '', name: '', description: '', mode: 'sandbox', trigger: { type: 'manual' }, conditions: null, actions: [], createdAt: '', updatedAt: '', runCount: 0, lastRunAt: null },
    });
    expect(rendered).toBe('TEST');
  });

  // ------------------------------------------------------------------
  // Test 8: executeAction — sandbox mode daje dry_run
  // ------------------------------------------------------------------
  it('w trybie sandbox zwraca dry_run zamiast wykonania', async () => {
    const action: WorkflowAction = {
      id: 'a1',
      type: 'webhook',
      label: 'Test webhook',
      enabled: true,
      config: { url: 'https://example.com/webhook' },
      template: '{"content": "{{output.content}}"}',
    };

    const result = await engine.executeAction(action, {
      output: createMockOutput(),
      agent: createMockAgent(),
      workflow: { id: '', name: '', description: '', mode: 'sandbox', trigger: { type: 'manual' }, conditions: null, actions: [], createdAt: '', updatedAt: '', runCount: 0, lastRunAt: null },
    }, 'sandbox');
    expect(result.status).toBe('dry_run');
    expect(result.dryRunPreview).toContain('example.com');
  });

  // ------------------------------------------------------------------
  // Test 9: registerOperator — custom operator
  // ------------------------------------------------------------------
  it('używa zarejestrowanego custom operatora', () => {
    engine.registerOperator('starts_with', (a: string, b: string) => a.startsWith(b));

    const group: ConditionGroup = {
      id: 'g1',
      logic: 'and',
      conditions: [
        { id: 'c1', source: { type: 'output_content' }, operator: 'starts_with' as any, value: 'Test' },
      ],
    };

    const result = engine.evaluateConditions(group, {
      output: createMockOutput(),
      agent: createMockAgent(),
      workflow: { id: '', name: '', description: '', mode: 'sandbox', trigger: { type: 'manual' }, conditions: null, actions: [], createdAt: '', updatedAt: '', runCount: 0, lastRunAt: null },
    });
    expect(result).toBe(true);
  });
});
