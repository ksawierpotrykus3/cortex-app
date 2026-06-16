// ============================================================================
// NEXUS — ElectronIpcBridge (Phase 1)
// Rejestruje IPC handlery dla agentów: CRUD, execute, stop
// Używa ipcMain.handle (invoke/promise) dla komend
// ============================================================================

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import {
  Agent, AgentOutput, AgentStatus, ProviderAuthConfig,
  GitConfig, DEFAULT_GIT_CONFIG, GitStatusResult, GitStatusEntry,
  GitLogEntry, GitBranchInfo, ContextSource, ContextConfig, DEFAULT_CONTEXT_CONFIG,
  TriggerType, Pipeline, FeedbackEntry, WorkspaceEntity,
  KillSwitchState, DEFAULT_KILLSWITCH, SearchConfig, SearchResult, DryRunConfig, DryRunResult, DEFAULT_DRY_RUN_CONFIG,
} from '../../shared/types/schema';
import { WorkflowDefinition, WorkflowMode } from '../../shared/types/workflow';
import { AgentOrchestrator } from '../core/AgentOrchestrator';
import { PipelineExecutor } from '../core/PipelineExecutor';
import { WorkflowEngine } from '../core/WorkflowEngine';
import { KillSwitch } from '../core/KillSwitch';
import { SearchEngine } from '../core/SearchEngine';
import { StorageEngine } from '../storage/StorageEngine';
import { ProviderRegistry } from '../ai/ProviderRegistry';
import { IAIProvider } from '../ai/IAIProvider';

/** Zastępuje access token w URL-u placeholderem [REDACTED] */
function sanitizeUrl(url: string, token: string | undefined): string {
  if (!token) return url;
  return url.replace(token, '[REDACTED]');
}

/** #S6: Sanityzacja nazwy brancha — tylko dozwolone znaki */
function sanitizeBranchName(name: string): string {
  // Git branch: litery, cyfry, . - _ /
  return name.replace(/[^a-zA-Z0-9._\-\/]/g, '');
}

/** #S6: Sanityzacja ścieżki pliku dla git diff */
function sanitizeGitPath(file: string): string {
  // Pozwala tylko na bezpieczne znaki w ścieżce
  if (/[/\\]\.\.([/\\]|$)/.test(file)) return '';
  return file.replace(/[^a-zA-Z0-9._\-\/\\@]/g, '');
}

/** Wykonuje komendę git przez spawn — bezpiecznie, bez shell injection */
function gitSpawn(args: string[], opts: { cwd?: string; env?: Record<string, string> }): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env } as Record<string, string>,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false, // BEZ shell = brak shell injection
    });
    let stdout = '';
    let stderr = '';
    proc.stdout!.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf-8'); });
    proc.stderr!.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf-8'); });
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `git exit code ${code}`));
    });
    proc.on('error', reject);
  });
}

export class ElectronIpcBridge {
  private ipc: typeof ipcMain;
  private orchestrator: AgentOrchestrator;
  private storage: StorageEngine;
  private providerRegistry: ProviderRegistry;

  /** Zwraca pierwszy skonfigurowany provider AI lub null */
  private getPrimaryAIProvider(): IAIProvider | null {
    // Try Google Gemini first (najpopularniejszy)
    const gemini = this.providerRegistry['providers']?.get('Google Gemini');
    if (gemini) return gemini;
    // Fallback: pierwszy lepszy skonfigurowany
    for (const [, adapter] of this.providerRegistry['providers'] ?? []) {
      if (adapter.isConfigured()) return adapter;
    }
    // Ostateczność: pierwszy z listy (nawet bez klucza)
    const first = this.providerRegistry['providers']?.values().next().value;
    if (first) return first;
    return null;
  }
  private pipelineExecutor: PipelineExecutor;
  private workflowEngine: WorkflowEngine;
  private killSwitch: KillSwitch;
  private searchEngine: SearchEngine;
  private gitConfig: GitConfig = { ...DEFAULT_GIT_CONFIG };
  private repoPath: string = '';

  // Git Scheduler timers (#23)
  private pullTimer: ReturnType<typeof setInterval> | null = null;
  private pushTimer: ReturnType<typeof setInterval> | null = null;
  private pullIntervalMs: number = 0;
  private pushIntervalMs: number = 0;
  private scheduleOnlyBranch: string = '';

  constructor(
    ipcInstance: typeof ipcMain,
    orchestrator: AgentOrchestrator,
    storage: StorageEngine,
    providerRegistry: ProviderRegistry,
    repoPath?: string
  ) {
    this.ipc = ipcInstance;
    this.orchestrator = orchestrator;
    this.storage = storage;
    this.providerRegistry = providerRegistry;
    this.pipelineExecutor = new PipelineExecutor(orchestrator, this.storage);
    this.workflowEngine = new WorkflowEngine(orchestrator);
    this.killSwitch = new KillSwitch();
    this.searchEngine = new SearchEngine(this.getPrimaryAIProvider() ?? undefined);
    if (repoPath) { this.repoPath = repoPath; }
  }

  // =========================================================================
  // Git Helpers
  // =========================================================================

  /** Wykonuje komendę git w repozytorium przez spawn — BRAK shell injection */
  private async gitExec(args: string[]): Promise<{ stdout: string; stderr: string }> {
    const opts: { cwd?: string; env?: Record<string, string> } = {};
    if (this.repoPath) { opts.cwd = this.repoPath; }

    // Set git env vars from config
    const env: Record<string, string> = {};
    if (this.gitConfig.authorName) { env.GIT_AUTHOR_NAME = this.gitConfig.authorName; env.GIT_COMMITTER_NAME = this.gitConfig.authorName; }
    if (this.gitConfig.authorEmail) { env.GIT_AUTHOR_EMAIL = this.gitConfig.authorEmail; env.GIT_COMMITTER_EMAIL = this.gitConfig.authorEmail; }
    if (Object.keys(env).length > 0) opts.env = env;

    const stdout = await gitSpawn(args, opts);
    return { stdout, stderr: '' };
  }

  /** Parsuje git status --porcelain */
  private parseGitStatus(stdout: string): GitStatusEntry[] {
    const entries: GitStatusEntry[] = [];
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue;
      // staged = first char is not space AND not ? (untracked oznacza staged=false)
      const staged = line[0] !== ' ' && line[0] !== '?';
      const statusChar = line[1] !== ' ' ? line[1] : line[0];
      const filePath = line.substring(3).trim();
      let status: GitStatusEntry['status'] = 'modified';
      if (statusChar === '?' || statusChar === '!' || line.startsWith('??')) {
        status = 'untracked';
      } else if (statusChar === 'A') {
        status = 'added';
      } else if (statusChar === 'D') {
        status = 'deleted';
      } else if (statusChar === 'R') {
        status = 'renamed';
      }
      entries.push({ path: filePath, status, staged });
    }
    return entries;
  }

  /** Pobiera root repozytorium */
  private async getRepoRoot(): Promise<string> {
    const { stdout } = await this.gitExec(['rev-parse', '--show-toplevel']);
    return stdout.trim();
  }

  /** Ładuje GitConfig z JSON backupu (jeśli istnieje) */
  private loadGitConfig(): void {
    try {
      const configPath = path.join(this.repoPath || process.cwd(), '..', 'data', 'config', 'git-config.json');
      if (fs.existsSync(configPath)) {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.gitConfig = { ...DEFAULT_GIT_CONFIG, ...data };
        console.debug('[GitConfig] Loaded from disk');
      }
    } catch { /* ignore if not found */ }
  }

  /** Sprawdza permisje gita dla agenta (F6.7) */
  private checkGitPermission(agentId?: string, requireWrite: boolean = false): void {
    if (!agentId) return; // UI calls without agent context are always allowed
    const agent = this.orchestrator.getAgent(agentId);
    if (!agent) return; // Unknown agent — allow (should not happen)
    const perms = agent.permissions;
    if (!perms) return; // No permissions set — allow (legacy behavior)
    if (!perms.gitAccess) {
      throw new Error(`Agent ${agentId} (${agent.name}) nie ma uprawnień Git Access. Włącz w panelu Uprawnienia.`);
    }
    if (requireWrite && !perms.gitWrite) {
      throw new Error(`Agent ${agentId} (${agent.name}) nie ma uprawnień Git Write. Włącz w panelu Uprawnienia.`);
    }
  }

  /** Zapisuje GitConfig do JSON backupu */
  private persistGitConfig(): void {
    try {
      const configDir = path.join(this.repoPath || process.cwd(), '..', 'data', 'config');
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(configDir, 'git-config.json'),
        JSON.stringify(this.gitConfig, null, 2),
        'utf8'
      );
      console.debug('[GitConfig] Persisted to disk');
    } catch { /* ignore */ }
  }

  /**
   * Rejestruje wszystkie IPC handlery.
   */
  registerHandlers(): void {
    // === Feedback (#26) ====================================================
    this.ipc.handle('feedback:save', async (_event: IpcMainInvokeEvent, payload: { feedback: any }) => {
      try {
        const workspaceDir = path.join(this.repoPath || process.cwd(), '..');
        const feedbackDir = path.join(workspaceDir, 'data');
        if (!fs.existsSync(feedbackDir)) {
          fs.mkdirSync(feedbackDir, { recursive: true });
        }
        const feedbackFile = path.join(feedbackDir, 'feedback.jsonl');
        const entry = {
          ...payload.feedback,
          id: payload.feedback.id || (crypto.randomUUID?.() || `fb_${Date.now()}`),
          timestamp: payload.feedback.timestamp || new Date().toISOString(),
        };
        fs.appendFileSync(feedbackFile, JSON.stringify(entry) + '\n', 'utf8');
        console.debug('[Feedback] Saved:', entry.id);
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[Feedback] Save error:', msg);
        return { success: false, error: msg };
      }
    });

    // === Agent CRUD =======================================================
    this.ipc.handle('agent:create', async (_event: IpcMainInvokeEvent, payload: any) => {
      try {
        const agent: Agent = {
          id: crypto.randomUUID?.() || `agent_${Date.now()}`,
          ...payload,
          status: AgentStatus.ACTIVE,
          runCount: 0,
          errorCount: 0,
          rating: 0,
          tags: payload.tags || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        this.orchestrator.registerAgent(agent);
        this.storage.saveAgent(agent);

        return agent;
      } catch (err) {
        console.error('[agent:create]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('agent:update', async (_event: IpcMainInvokeEvent, payload: { id: string; updates: Partial<Agent> }) => {
      try {
        this.orchestrator.updateAgent(payload.id, payload.updates);

        const existing = this.storage.getAgent(payload.id);
        if (existing) {
          const updated = { ...existing, ...payload.updates, updatedAt: new Date().toISOString() };
          this.storage.saveAgent(updated);
          return updated;
        }

        const fromOrch = this.orchestrator.getAgent(payload.id);
        if (fromOrch) {
          const updated = { ...fromOrch, ...payload.updates, updatedAt: new Date().toISOString() };
          this.storage.saveAgent(updated);
          return updated;
        }

        return { success: false, error: `Agent ${payload.id} not found` };
      } catch (err) {
        console.error('[agent:update]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('agent:delete', async (_event: IpcMainInvokeEvent, payload: { id: string }) => {
      try {
        this.orchestrator.unregisterAgent(payload.id);
        this.storage.deleteAgent(payload.id);
        return { success: true };
      } catch (err) {
        console.error('[agent:delete]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('agent:get-all', async () => {
      try {
        const runtimeAgents = this.orchestrator.getAgents();
        const storedAgents = this.storage.getAllAgents();

        // Prefer runtime status
        const runtimeMap = new Map(runtimeAgents.map(a => [a.id, a]));
        const merged = storedAgents.map(stored => {
          const runtime = runtimeMap.get(stored.id);
          return runtime ? { ...stored, status: runtime.status, runCount: runtime.runCount } : stored;
        });

        // Add agents that are only in runtime
        for (const rAgent of runtimeAgents) {
          if (!merged.find(m => m.id === rAgent.id)) {
            merged.push(rAgent);
          }
        }

        return merged;
      } catch (err) {
        console.error('[agent:get-all]', err);
        return [];
      }
    });

    this.ipc.handle('agent:get', async (_event: IpcMainInvokeEvent, payload: { id: string }) => {
      try {
        const runtime = this.orchestrator.getAgent(payload.id);
        if (runtime) return runtime;
        return this.storage.getAgent(payload.id);
      } catch (err) {
        console.error('[agent:get]', err);
        return { success: false, error: String(err) };
      }
    });

    // === Agent Execution ==================================================
    this.ipc.handle('agent:execute', async (_event: IpcMainInvokeEvent, payload: { id: string; context?: string; triggerType?: TriggerType }) => {
      try {
        const output = await this.orchestrator.executeAgent(payload.id, payload.context, payload.triggerType);
        this.storage.saveOutput(output);
        return { success: true, output };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    this.ipc.handle('agent:stop', (_event: IpcMainInvokeEvent, payload: { id: string }) => {
      try {
        this.orchestrator.stopAgent(payload.id);
        return { success: true };
      } catch (err) {
        console.error('[agent:stop]', err);
        return { success: false, error: String(err) };
      }
    });

    // === Changelog Actions ================================================
    this.ipc.on('changelog:approve', (_event, payload: { entryId: string; agentId: string }) => {
      this.storage.appendLog({ action: 'approve', ...payload });
    });

    this.ipc.on('changelog:reject', (_event, payload: { entryId: string; agentId: string; reason?: string }) => {
      this.storage.appendLog({ action: 'reject', ...payload });
    });

    // === Agent Output Approve/Reject (F6.1) ===============================
    this.ipc.handle('agent:approve-output', async (_event, payload: { outputId: string; agentId: string }) => {
      try {
        const outputs = this.storage.getOutputs(payload.agentId, 100);
        const output = outputs.find(o => o.id === payload.outputId);
        if (output) {
          output.approved = true;
          this.storage.saveOutput(output);
          this.orchestrator.updateAgent(payload.agentId, { status: AgentStatus.ACTIVE });
          return { success: true };
        }
        throw new Error(`Output ${payload.outputId} not found`);
      } catch (err) {
        console.error('[agent:approve-output]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('agent:reject-output', async (_event, payload: { outputId: string; agentId: string }) => {
      try {
        const outputs = this.storage.getOutputs(payload.agentId, 100);
        const output = outputs.find(o => o.id === payload.outputId);
        if (output) {
          output.approved = false;
          this.storage.saveOutput(output);
          this.orchestrator.updateAgent(payload.agentId, { status: AgentStatus.ACTIVE });
          return { success: true };
        }
        throw new Error(`Output ${payload.outputId} not found`);
      } catch (err) {
        console.error('[agent:reject-output]', err);
        return { success: false, error: String(err) };
      }
    });

    // === Agent Output History (F6.3) =======================================
    this.ipc.handle('agent:get-outputs', async (_event, payload: { agentId: string; limit?: number; offset?: number }) => {
      try {
        return this.storage.getOutputs(payload.agentId, payload.limit || 100);
      } catch (err) {
        console.error('[agent:get-outputs]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('agent:get-output-stats', async (_event, payload: { agentId: string }) => {
      try {
        return this.storage.getOutputStats(payload.agentId);
      } catch (err) {
        console.error('[agent:get-output-stats]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('agent:delete-output', async (_event, payload: { id: string }) => {
      try {
        this.storage.deleteOutput(payload.id);
        return { success: true };
      } catch (err) {
        console.error('[agent:delete-output]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('agent:clear-outputs', async (_event, payload: { agentId: string }) => {
      try {
        this.storage.clearOutputs(payload.agentId);
        return { success: true };
      } catch (err) {
        console.error('[agent:clear-outputs]', err);
        return { success: false, error: String(err) };
      }
    });

    // === Provider Config (Phase 2) ========================================
    this.ipc.handle('provider:get-configs', () => {
      try {
        // #S3: Never expose apiKey to renderer
        const configs = this.providerRegistry.getConfigs();
        return configs.map(c => ({
          provider: c.provider,
          label: c.label,
          baseUrl: c.baseUrl,
          models: c.models,
          isBuiltin: c.isBuiltin,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          hasApiKey: !!c.apiKey,
        }));
      } catch (err) {
        console.error('[provider:get-configs]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('provider:set-api-key', (_event, payload: { label: string; apiKey: string }) => {
      try {
        this.providerRegistry.setApiKey(payload.label, payload.apiKey);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    this.ipc.handle('provider:test-connection', async (_event, payload: { label: string }) => {
      try {
        return this.providerRegistry.testConnection(payload.label);
      } catch (err) {
        console.error('[provider:test-connection]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('provider:get-models', () => {
      try {
        return this.providerRegistry.getAvailableModels();
      } catch (err) {
        console.error('[provider:get-models]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('provider:upsert-config', (_event, payload: { config: ProviderAuthConfig }) => {
      try {
        this.providerRegistry.upsertConfig(payload.config);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Browser operations (#27 Playwright)
    this.ipc.handle('browser:extract-dom', async (_event, payload: { url: string }) => {
      try {
        const { BrowserEngine } = await import('../core/BrowserEngine');
        const engine = new BrowserEngine();
        const result = await engine.extractCleanDOM(payload.url);
        await engine.close();
        return { success: true, ...result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    this.ipc.handle('browser:test-macro', async (_event, payload: { steps: any[]; inputs?: Record<string, any> }) => {
      try {
        const { BrowserEngine } = await import('../core/BrowserEngine');
        const engine = new BrowserEngine();
        const result = await engine.executeMacro(payload.steps, payload.inputs || {});
        await engine.close();
        return result;
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Browser: download file via Playwright and save to storage (#27)
    this.ipc.handle('browser:download-and-save', async (_event, payload: { url: string; steps: any[]; inputs?: Record<string, any>; metadata?: Record<string, any> }) => {
      try {
        const { BrowserEngine } = await import('../core/BrowserEngine');
        const engine = new BrowserEngine();
        const result = await engine.executeMacro(payload.steps, payload.inputs || {});

        // Save any downloaded files to storage
        if (result.success && result.files && result.files.length > 0) {
          const records = this.storage.saveDownloadedFiles(payload.url, result.files, {
            ...payload.metadata,
            browserAction: 'macro',
          });
          await engine.close();
          return { success: true, files: result.files, records };
        }

        await engine.close();
        return result;
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Browser: save existing files to storage (from any source)
    this.ipc.handle('browser:save-files', async (_event, payload: { sourceUrl: string; files: Array<{ name: string; path: string; mime: string }>; metadata?: Record<string, any> }) => {
      try {
        const records = this.storage.saveDownloadedFiles(payload.sourceUrl, payload.files, payload.metadata || {});
        return { success: true, records };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Browser: get downloaded files from storage
    this.ipc.handle('browser:get-downloaded-files', async (_event, payload?: { limit?: number; metadataKey?: string; metadataValue?: any }) => {
      try {
        if (payload?.metadataKey && payload?.metadataValue !== undefined) {
          return this.storage.getDownloadedFilesByMetadata(payload.metadataKey, payload.metadataValue, payload.limit || 50);
        }
        return this.storage.getDownloadedFiles(payload?.limit || 50);
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Browser: delete a downloaded file
    this.ipc.handle('browser:delete-file', async (_event, payload: { id: string }) => {
      try {
        const deleted = this.storage.deleteDownloadedFile(payload.id);
        return { success: deleted };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Logs: paginated log entries (A7 fix)
    this.ipc.handle('logs:get', async (_event, payload?: { cursor?: string | null; limit?: number }) => {
      try {
        const limit = payload?.limit || 50;
        // Get logs from storage — for now return empty (placeholder)
        // TODO: implement actual log storage and retrieval
        return { entries: [], nextCursor: null, hasMore: false };
      } catch (error) {
        console.error('[logs:get]', error);
        return { entries: [], nextCursor: null, hasMore: false };
      }
    });

    console.debug('[ElectronIpcBridge] Registered all IPC handlers');

    // Register pipeline handlers
    this.registerPipelineHandlers();
    // Register workflow handlers
    this.registerWorkflowHandlers();
    // Register context handlers
    this.registerContextHandlers();
    // Register workspace handlers (F6.2)
    this.registerWorkspaceHandlers();
    // Register kill switch handlers (#9)
    this.registerKillSwitchHandlers();
    // Register search handlers (AI Semantic Search)
    this.registerSearchHandlers();
    // Register dry-run handlers (#10)
    this.registerDryRunHandlers();
    // Register git handlers
    this.registerGitHandlers();
    // Register git scheduler handlers
    this.registerGitScheduleHandlers();
  }

  // =========================================================================
  // Pipeline DAG Handlers (F6.12)
  // =========================================================================

  private registerPipelineHandlers(): void {
    this.ipc.handle('pipeline:save', (_event: IpcMainInvokeEvent, payload: { pipeline: Pipeline }) => {
      try {
        this.storage.savePipeline(payload.pipeline);
        return { success: true };
      } catch (err) {
        console.error('[pipeline:save]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('pipeline:delete', (_event: IpcMainInvokeEvent, payload: { id: string }) => {
      try {
        this.storage.deletePipeline(payload.id);
        return { success: true };
      } catch (err) {
        console.error('[pipeline:delete]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('pipeline:get-all', () => {
      try {
        return this.storage.getAllPipelines();
      } catch (err) {
        console.error('[pipeline:get-all]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('pipeline:execute', async (_event: IpcMainInvokeEvent, payload: { id: string }) => {
      try {
        const pipeline = this.storage.getPipeline(payload.id);
        if (!pipeline) {
          return { success: false, error: `Pipeline ${payload.id} not found` };
        }
        const result = await this.pipelineExecutor.execute(pipeline);
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg };
      }
    });

    this.ipc.handle('pipeline:dry-run', async (_event: IpcMainInvokeEvent, payload: { pipeline: Pipeline; config?: DryRunConfig }) => {
      try {
        const result = this.pipelineExecutor.dryRun(payload.pipeline, payload.config);
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { pipelineId: payload.pipeline.id, nodes: [], status: 'failed' as const, totalDuration: 0 };
      }
    });

    this.ipc.handle('pipeline:status', (_event: IpcMainInvokeEvent, payload: { id: string }) => {
      try {
        return this.pipelineExecutor.getStatus(payload.id);
      } catch (err) {
        console.error('[pipeline:status]', err);
        return { success: false, error: String(err) };
      }
    });

    console.debug('[ElectronIpcBridge] Registered Pipeline DAG handlers (F6.12)');
  }

  // =========================================================================
  // Workflow Handlers (#1)
  // =========================================================================

  private registerWorkflowHandlers(): void {
    this.ipc.handle('workflow:save', (_event: IpcMainInvokeEvent, payload: { workflow: WorkflowDefinition }) => {
      try {
        this.storage.saveWorkflow(payload.workflow);
        return { success: true };
      } catch (err) {
        console.error('[workflow:save]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('workflow:delete', (_event: IpcMainInvokeEvent, payload: { id: string }) => {
      try {
        this.storage.deleteWorkflow(payload.id);
        return { success: true };
      } catch (err) {
        console.error('[workflow:delete]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('workflow:get-all', () => {
      try {
        return this.storage.getAllWorkflows();
      } catch (err) {
        console.error('[workflow:get-all]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('workflow:execute', async (_event: IpcMainInvokeEvent, payload: { id: string; mode?: WorkflowMode }) => {
      try {
        const workflow = this.storage.getWorkflow(payload.id);
        if (!workflow) {
          return { success: false, error: `Workflow ${payload.id} not found` };
        }

        // Override mode if provided
        if (payload.mode) {
          workflow.mode = payload.mode;
        }

        const agentId = workflow.agentId;
        if (!agentId) {
          return { success: false, error: 'No agent assigned to this workflow' };
        }

        const agent = this.orchestrator.getAgent(agentId);
        if (!agent) {
          return { success: false, error: `Agent ${agentId} not found` };
        }

        // Get the latest output for this agent
        const outputs = this.storage.getOutputs(agentId, 1);
        if (outputs.length === 0) {
          return { success: false, error: `No outputs found for agent ${agentId}` };
        }

        const result = await this.workflowEngine.execute(workflow, { output: outputs[0], agent });
        this.storage.saveWorkflowResult(result);
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg } as any;
      }
    });

    this.ipc.handle('workflow:result', (_event: IpcMainInvokeEvent, payload: { executionId: string }) => {
      try {
        return this.workflowEngine.getResult(payload.executionId);
      } catch (err) {
        console.error('[workflow:result]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('workflow:logs', (_event: IpcMainInvokeEvent, payload: { workflowId: string }) => {
      try {
        const results = this.storage.getWorkflowResults(payload.workflowId);
        // Transform results into flat log entries
        const logs = results.flatMap(r => r.logs || []);
        return logs;
      } catch (err) {
        console.error('[workflow:logs]', err);
        return { success: false, error: String(err) };
      }
    });

    console.debug('[ElectronIpcBridge] Registered Workflow handlers (#1)');
  }

  // =========================================================================
  // Context Builder Handlers (F6.2)
  // =========================================================================

  private registerContextHandlers(): void {
    this.ipc.handle('context:get-options', (_event: IpcMainInvokeEvent, payload: { agentId: string }) => {
      try {
        // Return available context sources from DEFAULT_CONTEXT_CONFIG
        return DEFAULT_CONTEXT_CONFIG.sources.map(s => ({
          ...s,
        }));
      } catch (err) {
        console.error('[context:get-options]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('context:fetch', async (_event: IpcMainInvokeEvent, payload: { agentId: string; contextConfig: ContextConfig }) => {
      try {
        const result = await this.orchestrator.buildContext(payload.agentId, payload.contextConfig);
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { context: `Context fetch error: ${msg}`, tokensUsed: 0, sourceBreakdown: [] };
      }
    });

    this.ipc.handle('context:search-nodes', async (_event: IpcMainInvokeEvent, payload: { query: string; filter?: string }) => {
      try {
        // Use StorageEngine FTS5 search for notes
        const results = await this.storage.search(payload.query, 20);
        return results.map(r => ({
          id: r.id,
          title: r.content.slice(0, 100),
          projectId: r.agentId,
        }));
      } catch {
        return [];
      }
    });

    this.ipc.handle('context:search-tasks', async (_event: IpcMainInvokeEvent, payload: { query: string; status?: string }) => {
      try {
        const results = await this.storage.search(payload.query, 20);
        let filtered = results;
        if (payload.status) {
          filtered = filtered.filter(r => r.status === payload.status);
        }
        return filtered.map(r => ({
          id: r.id,
          title: r.content.slice(0, 100),
          status: r.status || 'unknown',
        }));
      } catch {
        return [];
      }
    });

    console.debug('[ElectronIpcBridge] Registered Context Builder handlers');

    // Register workspace entities handler (F6.8)
    this.registerWorkspaceEntitiesHandler();
  }

  // =========================================================================
  // Workspace Sync Handlers (F6.2)
  // =========================================================================

  private registerWorkspaceHandlers(): void {
    this.ipc.handle('workspace:sync', (_event: IpcMainInvokeEvent, payload: { entities: any[] }) => {
      try {
        this.storage.syncWorkspaceEntities(payload.entities);
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg };
      }
    });

    this.ipc.handle('workspace:get-all', () => {
      try {
        return this.storage.getWorkspaceEntities();
      } catch (err) {
        console.error('[workspace:get-all]', err);
        return { success: false, error: String(err) };
      }
    });

    console.debug('[ElectronIpcBridge] Registered Workspace handlers (F6.2)');
  }

  // =========================================================================
  // KillSwitch Handlers (#9)
  // =========================================================================

  private registerKillSwitchHandlers(): void {
    // Register running processes as stoppables in KillSwitch
    this.orchestrator.getAgents().forEach(agent => {
      if (agent.status === 'ACTIVE') {
        this.killSwitch.register(`agent:${agent.id}`, agent.name, () => {
          this.orchestrator.stopAgent(agent.id);
        });
      }
    });

    // Listen for agent status changes to auto-register/unregister
    const originalStopAgent = this.orchestrator.stopAgent.bind(this.orchestrator);
    this.orchestrator.stopAgent = (agentId: string) => {
      originalStopAgent(agentId);
      this.killSwitch.unregister(`agent:${agentId}`);
    };

    // IPC handlers
    this.ipc.handle('killswitch:status', () => {
      try {
        // Re-register active agents dynamically
        this.orchestrator.getAgents().forEach(agent => {
          if (agent.status === 'RUNNING' || (agent as any).status === 'PROCESSING') {
            this.killSwitch.register(`agent:${agent.id}`, agent.name, () => {
              this.orchestrator.stopAgent(agent.id);
            });
          }
        });
        return this.killSwitch.getStatus();
      } catch (err) {
        console.error('[killswitch:status]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('killswitch:activate', (_event, payload?: { reason?: string }) => {
      try {
        const state = this.killSwitch.activate(payload?.reason);
        // Additional emergency: also stop pipeline + workflow engines
        const allPipelines = this.storage.getAllPipelines();
        for (const p of allPipelines) {
          this.pipelineExecutor.stop(p.id);
        }
        this.killSwitch.register('engine:all', 'All engines', () => {
          // No-op — already stopped above
        });
        return state;
      } catch (err) {
        console.error('[killswitch:activate]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('killswitch:deactivate', () => {
      try {
        return this.killSwitch.deactivate();
      } catch (err) {
        console.error('[killswitch:deactivate]', err);
        return { success: false, error: String(err) };
      }
    });

    console.debug('[ElectronIpcBridge] Registered KillSwitch handlers (#9)');
  }

  // =========================================================================
  // Semantic Search Handlers (AI Search)
  // =========================================================================

  private registerSearchHandlers(): void {
    this.ipc.handle('search:query', async (_event, payload: { query: string; entities: WorkspaceEntity[]; config?: Partial<SearchConfig> }) => {
      try {
        const results = await this.searchEngine.search(payload.query, payload.entities, payload.config);
        return results;
      } catch (error) {
        console.error('[ElectronIpcBridge] search:query error:', error);
        return [];
      }
    });

    this.ipc.handle('search:update-config', (_event, payload: { config: SearchConfig }) => {
      try {
        this.searchEngine.setConfig(payload.config);
        return { success: true };
      } catch (err) {
        console.error('[search:update-config]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('search:get-config', () => {
      try {
        return this.searchEngine.getConfig();
      } catch (err) {
        console.error('[search:get-config]', err);
        return { success: false, error: String(err) };
      }
    });

    console.debug('[ElectronIpcBridge] Registered Semantic Search handlers (AI)');
  }

  // =========================================================================
  // Dry-Run Handlers (#10)
  // =========================================================================

  private registerDryRunHandlers(): void {
    this.ipc.handle('workflow:dry-run', async (_event, payload: { workflow: WorkflowDefinition; config?: Partial<DryRunConfig> }) => {
      try {
        const cfg = { ...DEFAULT_DRY_RUN_CONFIG, ...payload.config };
        const steps: string[] = [];
        const warnings: string[] = [];

        // Simulate workflow execution
        const wf = payload.workflow;
        if (!wf.actions || wf.actions.length === 0) {
          warnings.push('Workflow nie ma żadnych akcji');
        }

        let estimatedTokens = 0;
        for (const action of wf.actions || []) {
          const stepDesc = `[${action.type}] ${action.label || action.type}`;
          steps.push(stepDesc);
          estimatedTokens += 200;
          if (action.type === 'execute_agent' && action.config?.agentId) {
            const agent = this.orchestrator.getAgent(action.config.agentId);
            if (!agent) {
              warnings.push(`Agent "${action.config.agentId}" nie istnieje (akcja "${action.label || action.type}")`);
            } else if (cfg.simulateAgentOutput) {
              estimatedTokens += agent.promptTemplate?.length || 200;
            }
          }
        }

        const estimatedDuration = Math.max(steps.length * 150, estimatedTokens);

        return { steps, warnings, estimatedDuration };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { steps: [], warnings: [msg], estimatedDuration: 0 };
      }
    });

    console.debug('[ElectronIpcBridge] Registered Dry-Run handlers (#10)');
  }

  // =========================================================================
  // Workspace Entities Handler (F6.8)
  // =========================================================================

  private registerWorkspaceEntitiesHandler(): void {
    this.ipc.handle('agent:get-workspace-entities', async () => {
      try {
        // Get all storage data for workspace entities
        const allOutputs = this.storage.getOutputs(undefined, 100) || [];
        const allAgents = this.storage.getAllAgents() || [];

        // Nodes: outputs that look like notes (from agent outputs)
        const nodes = allOutputs
          .filter(o => o.content && o.content.length < 1000)
          .slice(0, 20)
          .map(o => ({
            id: o.id,
            title: o.agentName
              ? `${o.agentName}: ${o.content.slice(0, 80)}${o.content.length > 80 ? '...' : ''}`
              : o.content.slice(0, 100),
          }));

        // Tasks: outputs with task-like status or tags
        const tasks = allOutputs
          .filter(o => o.tags?.includes('task') || o.error !== undefined)
          .slice(0, 20)
          .map(o => ({
            id: o.id,
            title: o.content.slice(0, 100),
          }));

        // Drafts: longer outputs from agents (manuscripts)
        const drafts = allOutputs
          .filter(o => o.content && o.content.length >= 1000)
          .slice(0, 20)
          .map(o => ({
            id: o.id,
            contentPreview: o.content.slice(0, 200),
          }));

        // Fallback: if empty, derive from agent names + outputs
        const nodesFallback = nodes.length > 0 ? nodes : allAgents.slice(0, 20).map(a => ({
          id: a.id,
          title: a.name,
        }));

        return {
          nodes: nodesFallback,
          tasks: tasks.length > 0 ? tasks : [],
          drafts: drafts.length > 0 ? drafts : [],
        };
      } catch (err) {
        console.warn('[F6.8] Error fetching workspace entities:', err);
        return { nodes: [], tasks: [], drafts: [] };
      }
    });

    console.debug('[ElectronIpcBridge] Registered Workspace Entities handler (F6.8)');
  }

  // =========================================================================
  // Git IPC Handlers (#23)
  // =========================================================================

  private registerGitHandlers(): void {
    // Load persisted config on init
    this.loadGitConfig();

    this.ipc.handle('git:get-config', () => {
      try {
        return { ...this.gitConfig };
      } catch (err) {
        console.error('[git:get-config]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('git:set-config', (_event, payload: { config: GitConfig }) => {
      try {
        this.gitConfig = { ...payload.config };
        // Sync scheduler-only-branch
        this.scheduleOnlyBranch = this.gitConfig.scheduleOnlyOnBranch || '';
        // Persist to storage
        this.persistGitConfig();
        // Auto-detect repo path if remoteUrl changed and is valid
        if (this.gitConfig.remoteUrl && !this.repoPath) {
          try {
            this.repoPath = process.cwd();
          } catch { /* ignore */ }
        }
        return { success: true };
      } catch (err) {
        console.error('[git:set-config]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('git:test-connection', async () => {
      try {
        if (!this.gitConfig.remoteUrl) {
          return { success: false, error: 'Brak URL repozytorium. Skonfiguruj w ustawieniach.' };
        }
        if (!this.repoPath) {
          return { success: false, error: 'Brak ścieżki repozytorium.' };
        }
        // Build remote URL with token
        const url = this.gitConfig.accessToken
          ? this.gitConfig.remoteUrl.replace('https://', `https://oauth2:${this.gitConfig.accessToken}@`)
          : this.gitConfig.remoteUrl;
        await this.gitExec(['ls-remote', '--heads', url]);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: sanitizeUrl(err.message || 'Connection failed', this.gitConfig.accessToken) };
      }
    });

    this.ipc.handle('git:status', async (_event, payload?: { agentId?: string }) => {
      try {
        this.checkGitPermission(payload?.agentId, false);
        const [branch, porcelain, aheadBehind] = await Promise.all([
          this.gitExec(['rev-parse', '--abbrev-ref', 'HEAD']),
          this.gitExec(['status', '--porcelain']),
          this.gitExec(['rev-list', '--count', '--left-right', 'HEAD...@{upstream}']).catch(() => ({ stdout: '0\t0', stderr: '' })),
        ]);

        const entries = this.parseGitStatus(porcelain.stdout);
        const parts = aheadBehind.stdout.trim().split('\t');
        const ahead = parseInt(parts[0] || '0');
        const behind = parseInt(parts[1] || '0');

        const result: GitStatusResult = {
          branch: branch.stdout.trim(),
          clean: entries.length === 0,
          entries,
          ahead,
          behind,
        };
        return result;
      } catch (err: any) {
        return {
          branch: 'unknown',
          clean: true,
          entries: [],
          ahead: 0,
          behind: 0,
          error: err.message || 'Git status failed',
        };
      }
    });

    this.ipc.handle('git:log', async (_event, payload?: { count?: number; agentId?: string }) => {
      try {
        this.checkGitPermission(payload?.agentId, false);
        const count = payload?.count || 20;
        const log = await this.gitExec(['log', '--oneline', '--graph', '--decorate', '--all', `-${count}`, '--format=%h%n%an%n%s%n%ai%n%D']);
        const lines = log.stdout.trim().split('\n');
        const entries: GitLogEntry[] = [];
        for (let i = 0; i < lines.length; i += 5) {
          if (i + 3 >= lines.length) break;
          entries.push({
            hash: lines[i].trim(),
            author: lines[i + 1].trim(),
            message: lines[i + 2].trim(),
            date: lines[i + 3].trim(),
            refs: lines[i + 4]?.trim() || '',
          });
        }
        return entries;
      } catch {
        return [];
      }
    });

    this.ipc.handle('git:commit', async (_event, payload: { message: string; all?: boolean; agentId?: string }) => {
      try {
        this.checkGitPermission(payload?.agentId, true);
        if (payload.all) {
          await this.gitExec(['add', '-A']);
        }
        // Commit message is passed as separate arg — no shell escaping needed
        const { stdout } = await this.gitExec(['commit', '-m', payload.message]);
        return { success: true, error: undefined };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    this.ipc.handle('git:push', async (_event, payload?: { branch?: string; agentId?: string }) => {
      try {
        this.checkGitPermission(payload?.agentId, true);
        const branch = payload?.branch || '';
        const remoteUrl = this.gitConfig.remoteUrl;
        if (!remoteUrl) {
          return { success: false, error: 'Brak URL remote. Skonfiguruj w ustawieniach.' };
        }
        // Build remote URL with token
        const url = this.gitConfig.accessToken
          ? remoteUrl.replace('https://', `https://oauth2:${this.gitConfig.accessToken}@`)
          : remoteUrl;
        const args = ['push', url, branch].filter(Boolean);
        await this.gitExec(args);
        return { success: true, error: undefined };
      } catch (err: any) {
        return { success: false, error: sanitizeUrl(err.message, this.gitConfig.accessToken) };
      }
    });

    this.ipc.handle('git:pull', async (_event, payload?: { branch?: string; agentId?: string }) => {
      try {
        // git:pull is an infra operation — no agent permission check needed
        // (unlike git:status/log/diff which require gitAccess)
        const remoteUrl = this.gitConfig.remoteUrl;
        if (!remoteUrl) {
          return { success: false, error: 'Brak URL remote. Skonfiguruj w ustawieniach.' };
        }
        const branch = payload?.branch || '';
        const url = this.gitConfig.accessToken
          ? remoteUrl.replace('https://', `https://oauth2:${this.gitConfig.accessToken}@`)
          : remoteUrl;
        await this.gitExec(['pull', url, branch].filter(Boolean));
        return { success: true, error: undefined };
      } catch (err: any) {
        return { success: false, error: sanitizeUrl(err.message || 'Pull failed', this.gitConfig.accessToken) };
      }
    });

    this.ipc.handle('git:branch-list', async () => {
      try {
        const { stdout } = await this.gitExec(['branch', '-a', '--format=%(refname:short)%00%(HEAD)%00%(upstream:short)%00%(upstream:track)']);
        const branches: GitBranchInfo[] = [];
        for (const line of stdout.split('\n')) {
          if (!line.trim()) continue;
          const parts = line.split('%00');
          const name = parts[0]?.trim() || '';
          const isCurrent = parts[1]?.trim() === '*';
          if (!name) continue;
          branches.push({
            name,
            current: isCurrent,
            upstream: parts[2]?.trim() || undefined,
            ahead: 0,
            behind: 0,
          });
        }
        return branches;
      } catch {
        return [];
      }
    });

    this.ipc.handle('git:branch-switch', async (_event, payload: { name: string }) => {
      try {
        await this.gitExec(['checkout', payload.name]);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    this.ipc.handle('git:branch-create', async (_event, payload: { name: string; from?: string }) => {
      try {
        const safeName = sanitizeBranchName(payload.name);
        if (!safeName) return { success: false, error: 'Invalid branch name' };
        const args = ['checkout', '-b', safeName];
        if (payload.from) {
          const safeFrom = sanitizeBranchName(payload.from);
          if (safeFrom) args.push(safeFrom);
        }
        await this.gitExec(args);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    this.ipc.handle('git:merge', async (_event, payload: { from: string; to: string; agentId?: string }) => {
      try {
        this.checkGitPermission(payload?.agentId, true);
        const safeFrom = sanitizeBranchName(payload.from);
        const safeTo = sanitizeBranchName(payload.to);
        if (!safeFrom || !safeTo) return { success: false, error: 'Invalid branch name' };
        await this.gitExec(['checkout', safeTo]);
        await this.gitExec(['merge', safeFrom, '--no-edit']);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    this.ipc.handle('git:diff', async (_event, payload?: { file?: string; from?: string; to?: string; agentId?: string }) => {
      try {
        this.checkGitPermission(payload?.agentId, false);
        const args: string[] = ['diff'];
        if (payload?.from && payload?.to) {
          const safeFrom = sanitizeBranchName(payload.from);
          const safeTo = sanitizeBranchName(payload.to);
          if (!safeFrom || !safeTo) return '';
          args.push(`${safeFrom}..${safeTo}`);
        } else if (payload?.from) {
          const safeFrom = sanitizeBranchName(payload.from);
          if (!safeFrom) return '';
          args.push(safeFrom);
        }
        if (payload?.file) {
          const safeFile = sanitizeGitPath(payload.file);
          if (safeFile) args.push('--', safeFile);
        }
        const { stdout } = await this.gitExec(args);
        return stdout;
      } catch {
        return '';
      }
    });

    console.debug('[ElectronIpcBridge] Registered Git IPC handlers');
  }

  // =========================================================================
  // Git Scheduler (#23 — cyclic pull/push)
  // =========================================================================

  private startPullSchedule(ms: number): void {
    this.stopPullSchedule();
    if (ms <= 0) return;
    this.pullIntervalMs = ms;
    this.pullTimer = setInterval(async () => {
      try {
        if (this.scheduleOnlyBranch) {
          const { stdout } = await this.gitExec(['rev-parse', '--abbrev-ref', 'HEAD']);
          const currentBranch = stdout.trim();
          if (currentBranch !== this.scheduleOnlyBranch) return; // skip
        }
        const remoteUrl = this.gitConfig.remoteUrl;
        if (!remoteUrl) return;
        const url = this.gitConfig.accessToken
          ? remoteUrl.replace('https://', `https://oauth2:${this.gitConfig.accessToken}@`)
          : remoteUrl;
        const args = ['pull', url, this.scheduleOnlyBranch].filter(Boolean);
        await this.gitExec(args);
        console.debug('[GitScheduler] Pull wykonany');
      } catch (err: any) {
        console.warn('[GitScheduler] Pull failed:', sanitizeUrl(err.message || 'unknown error', this.gitConfig.accessToken));
      }
    }, ms);
    console.debug(`[GitScheduler] Pull schedule started: every ${ms}ms`);
  }

  private stopPullSchedule(): void {
    if (this.pullTimer) {
      clearInterval(this.pullTimer);
      this.pullTimer = null;
    }
    this.pullIntervalMs = 0;
  }

  private startPushSchedule(ms: number): void {
    this.stopPushSchedule();
    if (ms <= 0) return;
    this.pushIntervalMs = ms;
    this.pushTimer = setInterval(async () => {
      try {
        if (this.scheduleOnlyBranch) {
          const { stdout } = await this.gitExec(['rev-parse', '--abbrev-ref', 'HEAD']);
          const currentBranch = stdout.trim();
          if (currentBranch !== this.scheduleOnlyBranch) return;
        }
        const remoteUrl = this.gitConfig.remoteUrl;
        if (!remoteUrl) return;
        const url = this.gitConfig.accessToken
          ? remoteUrl.replace('https://', `https://oauth2:${this.gitConfig.accessToken}@`)
          : remoteUrl;
        // Auto-commit before push if autoCommit enabled
        if (this.gitConfig.autoCommit) {
          await this.gitExec(['add', '-A']);
          await this.gitExec(['commit', '-m', `Nexus AI: auto-sync ${new Date().toISOString()}`]);
        }
        const args = ['push', url, this.scheduleOnlyBranch].filter(Boolean);
        await this.gitExec(args);
        console.debug('[GitScheduler] Push wykonany');
      } catch (err: any) {
        console.warn('[GitScheduler] Push failed:', sanitizeUrl(err.message || 'unknown error', this.gitConfig.accessToken));
      }
    }, ms);
    console.debug(`[GitScheduler] Push schedule started: every ${ms}ms`);
  }

  private stopPushSchedule(): void {
    if (this.pushTimer) {
      clearInterval(this.pushTimer);
      this.pushTimer = null;
    }
    this.pushIntervalMs = 0;
  }

  private stopAllSchedules(): void {
    this.stopPullSchedule();
    this.stopPushSchedule();
  }

  private registerGitScheduleHandlers(): void {
    this.ipc.handle('git:schedule-status', () => {
      try {
        return {
          pullActive: this.pullTimer !== null,
          pushActive: this.pushTimer !== null,
          pullIntervalMs: this.pullIntervalMs,
          pushIntervalMs: this.pushIntervalMs,
        };
      } catch (err) {
        console.error('[git:schedule-status]', err);
        return { success: false, error: String(err) };
      }
    });

    this.ipc.handle('git:schedule-toggle', (_event, payload: { action: 'pull' | 'push'; active: boolean }) => {
      try {
        if (payload.action === 'pull') {
          if (payload.active) {
            const ms = this.gitConfig.pullIntervalMs;
            if (ms > 0) this.startPullSchedule(ms);
          } else {
            this.stopPullSchedule();
          }
        }
        if (payload.action === 'push') {
          if (payload.active) {
            const ms = this.gitConfig.pushIntervalMs;
            if (ms > 0) this.startPushSchedule(ms);
          } else {
            this.stopPushSchedule();
          }
        }
        return { success: true };
      } catch (err) {
        console.error('[git:schedule-toggle]', err);
        return { success: false, error: String(err) };
      }
    });

    console.debug('[ElectronIpcBridge] Registered Git Scheduler handlers');
  }

  destroy(): void {
    // Remove all handlers
    const channels = [
      'agent:create', 'agent:update', 'agent:delete',
      'agent:get-all', 'agent:get',
      'agent:execute', 'agent:stop',
      'agent:approve-output', 'agent:reject-output',
      'agent:get-outputs', 'agent:get-output-stats',
      'agent:delete-output', 'agent:clear-outputs',
      'provider:get-configs', 'provider:set-api-key',
      'provider:test-connection', 'provider:get-models',
      'provider:upsert-config',

      // Context Builder (F6.2)
      'context:get-options', 'context:fetch', 'context:search-nodes', 'context:search-tasks',

      // Context Builder (F6.8)
      'agent:get-workspace-entities',

      // Browser operations (#27)
      'browser:extract-dom', 'browser:test-macro',
      'browser:download-and-save', 'browser:save-files',
      'browser:get-downloaded-files', 'browser:delete-file',

      // Logs pagination
      'logs:get',

      // Feedback (#26)
      'feedback:save',

      // Git
      'git:get-config', 'git:set-config', 'git:test-connection',
      'git:status', 'git:log', 'git:commit', 'git:push', 'git:pull',
      'git:branch-list', 'git:branch-switch', 'git:branch-create',
      'git:merge', 'git:diff',
      'git:schedule-status', 'git:schedule-toggle',

      // Pipeline
      'pipeline:save', 'pipeline:delete', 'pipeline:get-all',
      'pipeline:execute', 'pipeline:dry-run', 'pipeline:status',

      // Workflow
      'workflow:save', 'workflow:delete', 'workflow:get-all',
      'workflow:execute', 'workflow:result', 'workflow:logs',
      'workflow:dry-run',

      // Workspace
      'workspace:sync', 'workspace:get-all',

      // KillSwitch
      'killswitch:status', 'killswitch:activate', 'killswitch:deactivate',

      // Search
      'search:query', 'search:update-config', 'search:get-config',
    ];

    // Stop all git schedulers
    this.stopAllSchedules();

    for (const channel of channels) {
      this.ipc.removeHandler(channel);
    }

    this.ipc.removeAllListeners('changelog:approve');
    this.ipc.removeAllListeners('changelog:reject');

    console.debug('[ElectronIpcBridge] Destroyed');
  }
}
