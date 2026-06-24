// ============================================================================
// NEXUS — SandboxRunner (#7 MicroVM)
// Izolowane wykonywanie agentów w procesie potomnym (child_process.fork).
// Zapewnia:
//   - Izolację procesu (crash agenta nie zabija main)
//   - Limit pamięci i czasu wykonania
//   - Komunikację przez IPC (message passing)
//   - timeout bezpieczeństwa
//   - Action Bridge — agent może wykonywać akcje przez IPC
// ============================================================================

import { fork, ChildProcess } from 'child_process';
import * as path from 'path';
import { Agent, AgentOutput, AgentStatus, TriggerType } from '../../shared/types/schema';

// === Sandbox Result ========================================================
export interface SandboxResult {
  success: boolean;
  output?: Partial<AgentOutput>;
  error?: string;
  executionMs: number;
}

// === Sandbox Config ========================================================
export interface SandboxConfig {
  agent: Agent;
  context: string;
  triggerType?: TriggerType;
  providerApiKey: string;
  providerBaseUrl: string;
  timeoutMs: number;        // Maksymalny czas wykonania (ms)
  memoryLimitMb?: number;   // Maksymalna pamięć (MB)
}

// === SandboxRunner =========================================================
export class SandboxRunner {
  private readonly DEFAULT_TIMEOUT_MS = 120_000; // 2 minuty
  private readonly WORKER_SCRIPT: string;
  private capabilityHandlers: Map<string, (params: any, agent: Agent) => Promise<any>> = new Map();

  constructor() {
    // The worker script is in the same directory
    this.WORKER_SCRIPT = path.join(__dirname, 'SandboxWorker.js');
    this.registerDefaultHandlers();
  }

  /**
   * Rejestruje handler dla akcji wywoływanej przez agenta w sandboxie.
   */
  registerHandler(action: string, handler: (params: any, agent: Agent) => Promise<any>): void {
    this.capabilityHandlers.set(action, handler);
  }

  /**
   * Rejestruje domyślne handlery dla podstawowych akcji (mocki).
   * W docelowej implementacji należy zastąpić prawdziwymi serwisami.
   */
  private registerDefaultHandlers(): void {
    this.capabilityHandlers.set('read:context', async (params, agent) => {
      // Context jest już wstrzykiwany przez payload — zwracamy info
      return { message: 'Context is injected via payload' };
    });

    this.capabilityHandlers.set('read:notes', async (params, agent) => {
      // Mock — w docelowej implementacji pobiera z bazy notatek
      return [
        { id: 'note-1', title: 'Przykładowa notatka', content: 'To jest przykładowa notatka z mapy myśli.' },
        { id: 'note-2', title: 'Pomysły do projektu', content: 'Lista pomysłów do zrealizowania w projekcie Nexus.' },
      ];
    });

    this.capabilityHandlers.set('read:tasks', async (params, agent) => {
      // Mock — w docelowej implementacji pobiera z menedżera zadań
      return [
        { id: 'task-1', title: 'Zaimplementuj Sandbox API bridge', status: 'done' },
        { id: 'task-2', title: 'Dodaj testy integracyjne', status: 'pending' },
      ];
    });

    this.capabilityHandlers.set('read:git', async (params, agent) => {
      // Mock — w docelowej implementacji wykonuje git status przez IPC do main
      return {
        branch: 'main',
        changes: 0,
        staged: 0,
        message: 'Git status — brak zmian (mock)',
      };
    });

    this.capabilityHandlers.set('write:git', async (params, agent) => {
      throw new Error('write:git wymaga implementacji — podłącz prawdziwy serwis git');
    });

    this.capabilityHandlers.set('write:notes', async (params, agent) => {
      // Mock — zwraca sukces
      return { success: true, id: `note-${Date.now()}`, message: 'Notatka utworzona (mock)' };
    });
  }

  /**
   * Uruchamia agenta w sandboxie (izolowany proces).
   * Zwraca wynik lub błąd.
   */
  async runInSandbox(config: SandboxConfig): Promise<SandboxResult> {
    const startTime = Date.now();
    const timeout = config.timeoutMs || this.DEFAULT_TIMEOUT_MS;

    return new Promise((resolve) => {
      let child: ChildProcess | null = null;
      const timer = setTimeout(() => {
        // Timeout — zabij proces
        if (child && !child.killed) {
          child.kill('SIGKILL');
        }
        resolve({
          success: false,
          error: `Sandbox timeout after ${timeout}ms`,
          executionMs: Date.now() - startTime,
        });
      }, timeout);

      try {
        child = fork(this.WORKER_SCRIPT, [], {
          stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
          execArgv: ['--no-warnings'],
          env: {
            ...process.env,
            NEXUS_SANDBOX: '1',
          },
        });

        // Memory limit via V8
        if (config.memoryLimitMb) {
          child.send({ type: 'config', memoryLimitMb: config.memoryLimitMb });
        }

        // Send execution payload with capabilities
        const agent = config.agent;
        const caps = (agent as any).capabilities || [];

        child.send({
          type: 'execute',
          payload: {
            agent: config.agent,
            context: config.context,
            triggerType: config.triggerType || TriggerType.MANUAL,
            providerApiKey: config.providerApiKey,
            providerBaseUrl: config.providerBaseUrl,
            capabilities: caps,
          },
        });

        // Listen for response and action requests
        child.on('message', async (msg: any) => {
          if (msg.type === 'result') {
            clearTimeout(timer);
            if (child && !child.killed) child.kill();
            resolve({
              success: msg.success,
              output: msg.output,
              error: msg.error,
              executionMs: Date.now() - startTime,
            });
            return;
          }

          if (msg.type === 'action_request') {
            const handler = this.capabilityHandlers.get(msg.action);
            if (!handler) {
              child?.send({ type: 'action_response', id: msg.id, error: `Unknown action: ${msg.action}` });
              return;
            }
            try {
              // Sprawdź czy agent ma capability dla tej akcji
              const hasCap = caps.some((c: any) => c.capability === msg.action || c.capability === 'admin');
              if (!hasCap) {
                child?.send({ type: 'action_response', id: msg.id, error: `Agent does not have capability: ${msg.action}` });
                return;
              }
              const result = await handler(msg.params, agent);
              child?.send({ type: 'action_response', id: msg.id, result });
            } catch (err) {
              child?.send({ type: 'action_response', id: msg.id, error: err instanceof Error ? err.message : String(err) });
            }
            return;
          }
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          resolve({
            success: false,
            error: `Sandbox process error: ${err.message}`,
            executionMs: Date.now() - startTime,
          });
        });

        child.on('exit', (code) => {
          clearTimeout(timer);
          if (code !== 0) {
            resolve({
              success: false,
              error: `Sandbox process exited with code ${code}`,
              executionMs: Date.now() - startTime,
            });
          }
        });

      } catch (err) {
        clearTimeout(timer);
        const msg = err instanceof Error ? err.message : String(err);
        resolve({
          success: false,
          error: `Failed to spawn sandbox: ${msg}`,
          executionMs: Date.now() - startTime,
        });
      }
    });
  }
}
