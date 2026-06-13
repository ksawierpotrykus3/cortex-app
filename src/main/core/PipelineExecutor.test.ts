// ============================================================================
// NEXUS — PipelineExecutor Tests (F6.12)
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineExecutor } from './PipelineExecutor';
import { Pipeline, WorkflowNode, PortConnection } from '../../shared/types/schema';

// === Mock AgentOrchestrator ================================================
function createMockOrchestrator() {
  return {
    getAgent: vi.fn().mockReturnValue({
      id: 'agent-1',
      name: 'Test Agent',
      promptTemplate: 'Przeanalizuj: {{SCHOWEK}}',
      model: { provider: 'GEMINI' as const, modelName: 'gemini-2.0-flash', temperature: 0.3, maxTokens: 2048, topP: 0.9 },
    }),
    executeAgent: vi.fn().mockResolvedValue({
      id: 'output-1',
      agentId: 'agent-1',
      agentName: 'Test Agent',
      status: 'ACTIVE',
      content: 'Wynik analizy',
      tokensUsed: 100,
      executionMs: 500,
      triggerType: 'MANUAL',
      modelName: 'gemini-2.0-flash',
      rating: 0,
      approved: null,
      tags: [],
      createdAt: new Date().toISOString(),
    }),
    buildContext: vi.fn().mockResolvedValue({ context: '', tokensUsed: 0 }),
    updateAgentStatus: vi.fn(),
    registerAgent: vi.fn(),
    getAgents: vi.fn().mockReturnValue([]),
  };
}

describe('PipelineExecutor', () => {
  let executor: PipelineExecutor;
  let orchestrator: ReturnType<typeof createMockOrchestrator>;

  beforeEach(() => {
    orchestrator = createMockOrchestrator();
    executor = new PipelineExecutor(orchestrator as any);
  });

  // ------------------------------------------------------------------
  // Test 1: topologicalSort zwraca puste dla pustego pipeline'u
  // ------------------------------------------------------------------
  it('zwraca pustą listę dla pipeline\'u bez nodów', () => {
    const result = executor.topologicalSort([], []);
    expect(result.sorted).toHaveLength(0);
    expect(result.cycles).toHaveLength(0);
  });

  // ------------------------------------------------------------------
  // Test 2: topologiczne sortowanie pojedynczego łańcucha
  // ------------------------------------------------------------------
  it('sortuje liniowy łańcuch nodów topologicznie', () => {
    const nodes: WorkflowNode[] = [
      { id: 'a', type: 'llm-agent', name: 'A', config: {}, position: { x: 0, y: 0 } },
      { id: 'b', type: 'llm-agent', name: 'B', config: {}, position: { x: 100, y: 0 } },
      { id: 'c', type: 'llm-agent', name: 'C', config: {}, position: { x: 200, y: 0 } },
    ];
    const connections: PortConnection[] = [
      { id: 'c1', sourceNodeId: 'a', sourcePort: 'output', targetNodeId: 'b', targetPort: 'input' },
      { id: 'c2', sourceNodeId: 'b', sourcePort: 'output', targetNodeId: 'c', targetPort: 'input' },
    ];

    const result = executor.topologicalSort(nodes, connections);
    expect(result.cycles).toHaveLength(0);
    expect(result.sorted).toHaveLength(3);
    expect(result.sorted[0].id).toBe('a');
    expect(result.sorted[1].id).toBe('b');
    expect(result.sorted[2].id).toBe('c');
  });

  // ------------------------------------------------------------------
  // Test 3: wykrywa cykle
  // ------------------------------------------------------------------
  it('wykrywa cykl w DAG', () => {
    const nodes: WorkflowNode[] = [
      { id: 'a', type: 'llm-agent', name: 'A', config: {}, position: { x: 0, y: 0 } },
      { id: 'b', type: 'llm-agent', name: 'B', config: {}, position: { x: 100, y: 0 } },
    ];
    const connections: PortConnection[] = [
      { id: 'c1', sourceNodeId: 'a', sourcePort: 'output', targetNodeId: 'b', targetPort: 'input' },
      { id: 'c2', sourceNodeId: 'b', sourcePort: 'output', targetNodeId: 'a', targetPort: 'input' },
    ];

    const result = executor.topologicalSort(nodes, connections);
    expect(result.sorted).toHaveLength(0);
    expect(result.cycles.length).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------
  // Test 4: getPredecessors zwraca połączenia wchodzące
  // ------------------------------------------------------------------
  it('znajduje poprzedników node\'a', () => {
    const connections: PortConnection[] = [
      { id: 'c1', sourceNodeId: 'a', sourcePort: 'output', targetNodeId: 'b', targetPort: 'input' },
      { id: 'c2', sourceNodeId: 'b', sourcePort: 'output', targetNodeId: 'c', targetPort: 'input' },
    ];

    const preds = executor.getPredecessors('b', connections);
    expect(preds).toHaveLength(1);
    expect(preds[0].sourceNodeId).toBe('a');
  });

  // ------------------------------------------------------------------
  // Test 5: buildNodeContext zbiera outputy poprzedników
  // ------------------------------------------------------------------
  it('buduje kontekst z outputów poprzedników', () => {
    const connections: PortConnection[] = [
      { id: 'c1', sourceNodeId: 'a', sourcePort: 'output', targetNodeId: 'b', targetPort: 'input' },
    ];
    const nodeResults = new Map<string, string>();
    nodeResults.set('a', 'Output z A');

    const context = executor.buildNodeContext('b', connections, nodeResults);
    expect(context).toContain('Output z A');
    expect(context).toContain('a');
  });

  // ------------------------------------------------------------------
  // Test 6: execute zwraca błąd na cykl
  // ------------------------------------------------------------------
  it('odrzuca pipeline z cyklem', async () => {
    const pipeline: Pipeline = {
      id: 'pipe-1',
      name: 'Cyclic',
      description: '',
      nodes: [
        { id: 'a', type: 'llm-agent', name: 'A', config: {}, position: { x: 0, y: 0 }, agentId: 'agent-1' },
        { id: 'b', type: 'llm-agent', name: 'B', config: {}, position: { x: 100, y: 0 }, agentId: 'agent-1' },
      ],
      connections: [
        { id: 'c1', sourceNodeId: 'a', sourcePort: 'output', targetNodeId: 'b', targetPort: 'input' },
        { id: 'c2', sourceNodeId: 'b', sourcePort: 'output', targetNodeId: 'a', targetPort: 'input' },
      ],
      createdAt: '',
      updatedAt: '',
      isHeadless: false,
    };

    const result = await executor.execute(pipeline);
    expect(result.success).toBe(false);
    expect(result.error).toContain('cycle');
  });
});
