// ============================================================================
// NEXUS — SandboxRunner (#7 MicroVM)
// Izolowane wykonywanie agentów w procesie potomnym (child_process.fork).
// Zapewnia:
//   - Izolację procesu (crash agenta nie zabija main)
//   - Limit pamięci i czasu wykonania
//   - Komunikację przez IPC (message passing)
//   - timeout bezpieczeństwa
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

  constructor() {
    // The worker script is in the same directory
    this.WORKER_SCRIPT = path.join(__dirname, 'SandboxWorker.js');
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

        // Send execution payload
        child.send({
          type: 'execute',
          payload: {
            agent: config.agent,
            context: config.context,
            triggerType: config.triggerType || TriggerType.MANUAL,
            providerApiKey: config.providerApiKey,
            providerBaseUrl: config.providerBaseUrl,
          },
        });

        // Listen for response
        child.on('message', (msg: any) => {
          if (msg.type === 'result') {
            clearTimeout(timer);
            if (child && !child.killed) child.kill();
            resolve({
              success: msg.success,
              output: msg.output,
              error: msg.error,
              executionMs: Date.now() - startTime,
            });
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
