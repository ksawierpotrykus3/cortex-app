// ============================================================================
// NEXUS — PipelineExecutor (F6.12)
// Executes pipeline DAG via topological sort + node execution
// ============================================================================

import { Pipeline, WorkflowNode, PortConnection, AgentOutput, TriggerType, DryRunResult, DryRunNodeResult, DryRunConfig, DEFAULT_DRY_RUN_CONFIG, DownloadedFileRecord } from '../../shared/types/schema';
import { AgentOrchestrator } from './AgentOrchestrator';
import { evalCondition } from './ConditionEval';
import { StorageEngine } from '../storage/StorageEngine';

export type PipelineRunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'stopped';

export interface PipelineRunState {
  status: PipelineRunStatus;
  pipelineId: string;
  currentNodeId: string | null;
  nodeResults: Map<string, AgentOutput | string>;
  errors: Map<string, string>;
  progress: number; // 0-1
}

export class PipelineExecutor {
  private runs = new Map<string, PipelineRunState>();
  private abortController = new Map<string, AbortController>();
  private orchestrator: AgentOrchestrator;
  private storage: StorageEngine | null = null;

  // Auto-cleanup: max completed runs to prevent memory leak
  private readonly MAX_CACHED_RUNS = 50;
  private runInsertionOrder: string[] = [];

  constructor(orchestrator: AgentOrchestrator, storage?: StorageEngine) {
    this.orchestrator = orchestrator;
    if (storage) this.storage = storage;
  }

  private enforceRunLimit(): void {
    while (this.runs.size > this.MAX_CACHED_RUNS) {
      const oldest = this.runInsertionOrder.shift();
      if (oldest) {
        this.runs.delete(oldest);
        this.abortController.delete(oldest);
      }
    }
  }

  /**
   * Topological sort of DAG. Returns execution-order list of nodes.
   */
  topologicalSort(nodes: WorkflowNode[], connections: PortConnection[]): { sorted: WorkflowNode[]; cycles: string[] } {
    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const node of nodes) {
      adj.set(node.id, []);
      inDegree.set(node.id, 0);
    }

    for (const conn of connections) {
      const targets = adj.get(conn.sourceNodeId);
      if (targets) {
        targets.push(conn.targetNodeId);
      }
      inDegree.set(conn.targetNodeId, (inDegree.get(conn.targetNodeId) || 0) + 1);
    }

    // Detect cycles with DFS
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycles: string[] = [];

    function dfs(u: string): boolean {
      visited.add(u);
      recStack.add(u);
      for (const v of adj.get(u) || []) {
        if (!visited.has(v)) {
          if (dfs(v)) return true;
        } else if (recStack.has(v)) {
          cycles.push(`Cycle detected: ${u} → ${v}`);
          return true;
        }
      }
      recStack.delete(u);
      return false;
    }

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    if (cycles.length > 0) {
      return { sorted: [], cycles };
    }

    // Kahn's algorithm for topological sort
    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const sorted: WorkflowNode[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      const node = nodes.find(n => n.id === u);
      if (node) sorted.push(node);

      for (const v of adj.get(u) || []) {
        inDegree.set(v, (inDegree.get(v) || 0) - 1);
        if (inDegree.get(v) === 0) queue.push(v);
      }
    }

    return { sorted, cycles: [] };
  }

  /**
   * Znajduje poprzedników node'a w DAG.
   */
  getPredecessors(nodeId: string, connections: PortConnection[]): PortConnection[] {
    return connections.filter(c => c.targetNodeId === nodeId);
  }

  /**
   * Zbiera dane wejściowe dla node'a z outputów poprzedników.
   */
  buildNodeContext(
    nodeId: string,
    connections: PortConnection[],
    nodeResults: Map<string, AgentOutput | string>
  ): string {
    const preds = this.getPredecessors(nodeId, connections);
    const parts: string[] = [];

    for (const pred of preds) {
      const result = nodeResults.get(pred.sourceNodeId);
      if (result) {
        const content = typeof result === 'string' ? result : result.content;
        parts.push(`--- Output z ${pred.sourceNodeId} ---\n${content}`);
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Uruchamia pipeline.
   */
  async execute(pipeline: Pipeline): Promise<{ success: boolean; error?: string }> {
    const abortCtrl = new AbortController();
    this.abortController.set(pipeline.id, abortCtrl);

    const runState: PipelineRunState = {
      status: 'running',
      pipelineId: pipeline.id,
      currentNodeId: null,
      nodeResults: new Map(),
      errors: new Map(),
      progress: 0,
    };
    this.runs.set(pipeline.id, runState);
    this.runInsertionOrder.push(pipeline.id);
    this.enforceRunLimit();

    try {
      const { sorted, cycles } = this.topologicalSort(pipeline.nodes, pipeline.connections);

      if (cycles.length > 0) {
        runState.status = 'failed';
        return { success: false, error: `Pipeline contains cycles: ${cycles.join('; ')}` };
      }

      if (sorted.length === 0) {
        runState.status = 'failed';
        return { success: false, error: 'Pipeline has no executable nodes' };
      }

      for (let i = 0; i < sorted.length; i++) {
        if (abortCtrl.signal.aborted) {
          runState.status = 'stopped';
          return { success: false, error: 'Pipeline execution stopped' };
        }

        const node = sorted[i];
        runState.currentNodeId = node.id;
        runState.progress = i / sorted.length;

        // Build context from predecessors
        const predecessorContext = this.buildNodeContext(node.id, pipeline.connections, runState.nodeResults);

        // #6: IF/THEN — sprawdź warunek przed wykonaniem
        if (node.condition && node.condition.mode !== 'always') {
          const shouldSkip = evalCondition(node.condition, predecessorContext, runState);
          if (shouldSkip) {
            runState.nodeResults.set(node.id, `[SKIPPED] Condition "${node.condition.expression}" → skipped`);
            continue;
          }
        }

        switch (node.type) {
          case 'llm-agent': {
            if (!node.agentId) {
              runState.errors.set(node.id, 'No agentId specified for llm-agent node');
              continue;
            }

            const agent = this.orchestrator.getAgent(node.agentId);
            if (!agent) {
              runState.errors.set(node.id, `Agent ${node.agentId} not found`);
              runState.nodeResults.set(node.id, `[ERROR] Agent not found: ${node.agentId}`);
              continue;
            }

            let prompt = node.systemPrompt || agent.promptTemplate;
            if (predecessorContext) {
              prompt = `${prompt}\n\n--- Kontekst z poprzednich kroków ---\n\n${predecessorContext}`;
            }

            try {
              const output = await this.orchestrator.executeAgent(
                node.agentId,
                prompt,
                TriggerType.MANUAL,
                true
              );
              runState.nodeResults.set(node.id, output);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              runState.errors.set(node.id, msg);
              runState.nodeResults.set(node.id, `[ERROR] ${msg}`);
            }
            break;
          }

          case 'accumulator': {
            // Akumuluje wszystkie poprzednie outputy w jeden
            const allOutputs = Array.from(runState.nodeResults.entries())
              .map(([nid, res]) => {
                const content = typeof res === 'string' ? res : res.content;
                return `[${nid}]\n${content}`;
              })
              .join('\n\n---\n\n');

            const accumulated = node.config?.separator
              ? allOutputs.split('\n').join(node.config.separator)
              : allOutputs;

            runState.nodeResults.set(node.id, accumulated);
            break;
          }

          case 'router': {
            // Router przekazuje dane z pierwszego poprzednika
            const predResults = this.getPredecessors(node.id, pipeline.connections);
            if (predResults.length > 0) {
              const firstPred = predResults[0];
              const firstResult = runState.nodeResults.get(firstPred.sourceNodeId);
              if (firstResult) {
                runState.nodeResults.set(node.id, firstResult);
              }
            }
            break;
          }

          case 'browser-automate': {
            // #27 Playwright Browser Automate
            try {
              const { BrowserEngine } = await import('./BrowserEngine');
              const browser = new BrowserEngine();
              const steps = node.config?.steps || [];
              const inputs = node.config?.inputs || {};
              const result = await browser.executeMacro(steps, inputs);
              await browser.close();

              // Zapisz pobrane pliki do storage jeśli jest dostępny
              if (result.success && result.files && result.files.length > 0 && this.storage) {
                const pipelineName = pipeline.name || 'pipeline';
                const records = this.storage.saveDownloadedFiles(
                  inputs._url || '',
                  result.files,
                  { pipelineId: pipeline.id, pipelineName, nodeId: node.id, nodeName: node.name }
                );
                const fileInfo = records.map(r => `${r.originalName} (${r.sizeBytes} bytes)`).join(', ');
                runState.nodeResults.set(node.id, `[BROWSER] Download complete: ${fileInfo}`);
              } else {
                const outputText = result.text || result.extractedData?._screenshot || (result.success ? 'OK' : result.error || 'Failed');
                runState.nodeResults.set(node.id, outputText);
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              runState.errors.set(node.id, msg);
              runState.nodeResults.set(node.id, `[ERROR] ${msg}`);
            }
            break;
          }

          case 'condition': {
            // #6: Node warunkowy — ewaluuje wyrażenie i zapisuje wynik
            const condResult = evalCondition(
              { expression: node.config?.expression || '', mode: 'skip-when-false' },
              predecessorContext,
              runState,
            );
            runState.nodeResults.set(node.id, condResult ? '[CONDITION] TRUE' : '[CONDITION] FALSE');
            break;
          }

          default:
            runState.nodeResults.set(node.id, `[SKIPPED] Node type ${node.type} not implemented in executor`);
            break;
        }
      }

      runState.progress = 1;
      runState.status = runState.errors.size > 0 ? 'failed' : 'completed';
      return { success: runState.errors.size === 0, error: runState.errors.size > 0 ? 'Pipeline completed with errors' : undefined };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      runState.status = 'failed';
      return { success: false, error: msg };
    }
  }

  // #10: Dry-Run — symulacja wykonania pipeline bez uruchamiania agentów
  dryRun(pipeline: Pipeline, config?: Partial<DryRunConfig>): DryRunResult {
    const cfg = { ...DEFAULT_DRY_RUN_CONFIG, ...config };
    const nodes: DryRunNodeResult[] = [];
    const { sorted } = this.topologicalSort(pipeline.nodes, pipeline.connections);
    const startTime = Date.now();
    const contextMap = new Map<string, string>();

    for (const node of sorted) {
      const nodeConfig = pipeline.nodes.find(n => n.id === node.id);
      if (!nodeConfig) continue;

      const predecessorContext = this.buildNodeContext(node.id, pipeline.connections, contextMap as any);

      // Condition check
      let conditionResult: boolean | null = null;
      let skipped = false;
      if (nodeConfig.condition && nodeConfig.condition.mode !== 'always') {
        conditionResult = evalCondition(nodeConfig.condition, predecessorContext, { nodeResults: contextMap as any, currentNodeId: node.id });
        skipped = conditionResult === (nodeConfig.condition.mode === 'skip-when-true');
      }

      // Symuluj output
      let simulatedOutput: string;
      let estimatedTokens = 0;
      const estimatedDuration = Math.floor(Math.random() * 200) + 50; // 50-250ms

      if (skipped) {
        simulatedOutput = '[SKIPPED] Warunek nie został spełniony';
        estimatedTokens = 0;
      } else {
        switch (nodeConfig.type) {
          case 'llm-agent':
            simulatedOutput = cfg.simulateAgentOutput
              ? `[DRY-RUN] Agent "${nodeConfig.name}" otrzymałby prompt i zwrócił odpowiedź (${(predecessorContext.length || 100)} znaków inputu)`
              : '[DRY-RUN] LLM agent — pominięto (simulateAgentOutput = false)';
            estimatedTokens = Math.floor((predecessorContext.length || 100) / 4) + 50;
            break;
          case 'accumulator':
            simulatedOutput = `[DRY-RUN] Akumulator zebrałby dane z ${pipeline.connections.filter(c => c.sourceNodeId === node.id).length} połączeń`;
            estimatedTokens = 10;
            break;
          case 'router':
            simulatedOutput = `[DRY-RUN] Router przekazałby dane dalej (${predecessorContext.slice(0, 100)}...)`;
            estimatedTokens = 5;
            break;
          case 'human-in-the-loop':
            simulatedOutput = '[DRY-RUN] Czekałby na zatwierdzenie przez człowieka';
            estimatedTokens = 0;
            break;
          case 'condition':
            simulatedOutput = `[DRY-RUN] Warunek: ${nodeConfig.config?.expression || '—'} → ${conditionResult !== null ? (conditionResult ? 'TRUE' : 'FALSE') : 'nie oceniono'}`;
            estimatedTokens = 5;
            break;
          default:
            simulatedOutput = '[DRY-RUN] Nieznany typ noda';
            estimatedTokens = 5;
        }
      }

      // Store simulated context for downstream
      contextMap.set(node.id, simulatedOutput);

      nodes.push({
        nodeId: node.id,
        nodeName: nodeConfig.name,
        nodeType: nodeConfig.type,
        condition: nodeConfig.condition?.expression,
        conditionResult,
        skipped,
        simulatedOutput,
        estimatedTokens,
        estimatedDuration,
      });
    }

    const totalDuration = Date.now() - startTime;
    return {
      pipelineId: pipeline.id,
      nodes,
      status: 'success',
      totalDuration,
    };
  }

  /**
   * Zatrzymuje działający pipeline.
   */
  stop(pipelineId: string): void {
    const abortCtrl = this.abortController.get(pipelineId);
    if (abortCtrl) {
      abortCtrl.abort();
      this.abortController.delete(pipelineId);
    }

    const run = this.runs.get(pipelineId);
    if (run && run.status === 'running') {
      run.status = 'stopped';
    }
  }

  getStatus(pipelineId: string): { status: PipelineRunStatus; currentNodeId?: string; progress?: number } | null {
    const run = this.runs.get(pipelineId);
    if (!run) return null;
    return {
      status: run.status,
      currentNodeId: run.currentNodeId || undefined,
      progress: run.progress,
    };
  }

  cleanup(pipelineId: string): void {
    this.runs.delete(pipelineId);
    this.abortController.delete(pipelineId);
  }
}
